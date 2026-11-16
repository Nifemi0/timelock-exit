import { createPublicClient, decodeEventLog, decodeFunctionData, http, type Abi, type Address, type Hex } from 'viem'
import { baseExplorerApi, baseRpc, destination, historyFromBlock, lasna, lookbackBlocks, type LiveAddresses } from './config'
import { exitGuardAbi, knownCallsAbi, sentinelAbi, timelockAbi, tokenAbi, vaultAbi } from './abis'
import { short } from './format'
import type { ExitRecord, Guard, Position, QueueItem, QueueStatus } from './types'

/**
 * Chain access for live mode.
 *
 * State (balances, guards, timelock status) is read from RPC. Event history comes from
 * the Blockscout explorer API, which returns every log since deployment in one call; a
 * plain RPC block scan is the fallback, but public RPCs cap log ranges, so it only covers
 * recent blocks. The Reactive-side transaction for an exit is found by jumping to the
 * Lasna block nearest the exit's timestamp and searching a small window around it.
 */

const base = createPublicClient({ chain: destination, transport: http(baseRpc) })
const reactive = createPublicClient({ chain: lasna, transport: http() })

const CHUNK = 9_000n
const SKIP_REASONS = ['Guard not armed', 'Nothing to redeem', 'Redeem failed']

interface RawLog {
  topics: [Hex, ...Hex[]]
  data: Hex
  blockNumber: bigint
  transactionHash: Hex
  /** Unix seconds, when the source provides it. */
  timestamp?: number
}

// ---------------------------------------------------------------------------
// Event history
// ---------------------------------------------------------------------------

interface ExplorerLog {
  topics: Array<Hex | null>
  data: Hex
  blockNumber: Hex
  timeStamp: Hex
  transactionHash: Hex
}

async function explorerLogs(address: Address): Promise<RawLog[]> {
  const url = `${baseExplorerApi}?module=logs&action=getLogs&fromBlock=${historyFromBlock}&toBlock=latest&address=${address}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Explorer returned ${res.status}`)
  const body = (await res.json()) as { status: string; message: string; result: ExplorerLog[] | string }
  if (body.status !== '1') {
    if (/no records/i.test(body.message)) return []
    throw new Error(`Explorer: ${body.message}`)
  }
  return (body.result as ExplorerLog[]).map(l => ({
    topics: l.topics.filter((t): t is Hex => t !== null) as [Hex, ...Hex[]],
    data: l.data,
    blockNumber: BigInt(l.blockNumber),
    transactionHash: l.transactionHash,
    timestamp: Number(BigInt(l.timeStamp)),
  }))
}

async function rpcLogs(address: Address): Promise<RawLog[]> {
  const latest = await base.getBlockNumber()
  const from = latest > lookbackBlocks ? latest - lookbackBlocks : 0n
  const windows: Array<[bigint, bigint]> = []
  for (let start = from; start <= latest; start += CHUNK) {
    const end = start + CHUNK - 1n
    windows.push([start, end > latest ? latest : end])
  }
  const logs = (
    await Promise.all(windows.map(([fromBlock, toBlock]) => base.getLogs({ address, fromBlock, toBlock })))
  ).flat()
  return logs.map(l => ({
    topics: l.topics as [Hex, ...Hex[]],
    data: l.data,
    blockNumber: l.blockNumber,
    transactionHash: l.transactionHash,
  }))
}

/** Every log a contract emitted since deployment: explorer first, recent RPC scan as fallback. */
async function history(address: Address): Promise<RawLog[]> {
  try {
    return await explorerLogs(address)
  } catch {
    return rpcLogs(address)
  }
}

/** Decode the logs that match `eventName`, skipping anything else the contract emitted. */
function decoded<const TAbi extends Abi>(abi: TAbi, eventName: string, logs: RawLog[]) {
  const out: Array<{ log: RawLog; args: Record<string, unknown> }> = []
  for (const log of logs) {
    try {
      const event = decodeEventLog({ abi, data: log.data, topics: log.topics, strict: true })
      if (event.eventName === eventName) out.push({ log, args: event.args as Record<string, unknown> })
    } catch {
      // A different event from the same contract.
    }
  }
  return out
}

const blockTimes = new Map<bigint, number>()
async function timeOf(log: RawLog): Promise<number> {
  if (log.timestamp !== undefined) return log.timestamp
  const cached = blockTimes.get(log.blockNumber)
  if (cached !== undefined) return cached
  const block = await base.getBlock({ blockNumber: log.blockNumber })
  const seconds = Number(block.timestamp)
  blockTimes.set(log.blockNumber, seconds)
  return seconds
}

// ---------------------------------------------------------------------------
// Decoding helpers
// ---------------------------------------------------------------------------

function describe(data: Hex): { title: string; call: string } {
  if (data.length < 10) return { title: 'Plain transfer', call: 'no calldata' }
  try {
    const { functionName, args } = decodeFunctionData({ abi: knownCallsAbi, data })
    const shown = (args ?? []).map(a => (typeof a === 'string' && a.length > 20 ? short(a) : String(a))).join(', ')
    const call = `${functionName}(${shown})`
    switch (functionName) {
      case 'setExitFee':
        return { title: `Exit fee → ${Number(args[0]) / 100}%`, call }
      case 'setTreasury':
        return { title: 'Treasury address change', call }
      case 'transferOwnership':
        return { title: 'Ownership transfer', call }
      case 'grantRole':
        return { title: 'Role granted', call }
      default:
        return { title: 'Contract upgrade', call }
    }
  } catch {
    return { title: 'Unrecognised call', call: data.slice(0, 10) }
  }
}

function matches(guard: Guard, vault: Address, target: Address, selector: Hex | null): boolean {
  if (!guard.armed) return false
  if (guard.anyCallToVault && target.toLowerCase() === vault.toLowerCase()) return true
  return selector !== null && guard.selectors.some(s => s.toLowerCase() === selector.toLowerCase())
}

const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase()

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

export async function fetchGuard(a: LiveAddresses, user: Address): Promise<Guard> {
  const [timelock, anyCallToVault, armed, selectors] = await base.readContract({
    address: a.exitGuard,
    abi: exitGuardAbi,
    functionName: 'guardOf',
    args: [user, a.vault],
  })
  if (!armed) return { armed: false, anyCallToVault: false, selectors: [] }

  let synced: boolean | undefined
  try {
    synced = await reactive.readContract({
      address: a.sentinel,
      abi: sentinelAbi,
      functionName: 'isGuarded',
      args: [timelock, user, a.vault],
    })
  } catch {
    synced = undefined
  }
  return { armed, timelock, anyCallToVault, selectors: [...selectors], synced }
}

export async function fetchQueue(a: LiveAddresses, guard: Guard): Promise<QueueItem[]> {
  const scheduled = decoded(timelockAbi, 'CallScheduled', await history(a.timelock))

  const items = await Promise.all(
    scheduled.map(async ({ log, args }): Promise<QueueItem> => {
      const id = args.id as Hex
      const index = args.index as bigint
      const target = args.target as Address
      const data = args.data as Hex
      const delay = args.delay as bigint
      const [timestamp, queuedAt] = await Promise.all([
        base.readContract({ address: a.timelock, abi: timelockAbi, functionName: 'getTimestamp', args: [id] }),
        timeOf(log),
      ])
      // TimelockController: 0 = unset (cancelled), 1 = done, anything else = ready time.
      const status: QueueStatus = timestamp === 0n ? 'cancelled' : timestamp === 1n ? 'executed' : 'pending'
      const selector = data.length >= 10 ? (data.slice(0, 10) as Hex) : null
      return {
        key: `${id}-${index}`,
        operationId: id,
        ...describe(data),
        target,
        selector,
        queuedAt,
        executesAt: status === 'pending' ? Number(timestamp) : queuedAt + Number(delay),
        status,
        matched: matches(guard, a.vault, target, selector),
        txHash: log.transactionHash,
      }
    }),
  )
  return items.sort((x, y) => y.queuedAt - x.queuedAt)
}

/** Reactive transactions never change once found, so they are cached for the session. */
const reactiveCache = new Map<string, Hex>()

/**
 * Find the sentinel's ExitRequested transaction for each exit. Lasna has no log API with
 * long ranges, so estimate the Lasna block from the exit's timestamp (interpolating
 * between the head and a block 100,000 earlier) and search 3,000 blocks around it.
 */
async function reactiveTxs(a: LiveAddresses, user: Address, exits: Array<{ operationId: Hex; at: number }>): Promise<Map<Hex, Hex>> {
  const found = new Map<Hex, Hex>()
  const missing = exits.filter(e => {
    const hit = reactiveCache.get(`${user}:${e.operationId}`)
    if (hit) found.set(e.operationId, hit)
    return !hit
  })
  if (missing.length === 0) return found

  try {
    const head = await reactive.getBlock()
    const refNumber = head.number > 100_000n ? head.number - 100_000n : 0n
    const ref = await reactive.getBlock({ blockNumber: refNumber })
    const secondsPerBlock = Math.max(0.1, Number(head.timestamp - ref.timestamp) / Math.max(1, Number(head.number - refNumber)))

    await Promise.all(
      missing.map(async exit => {
        const behind = BigInt(Math.max(0, Math.round((Number(head.timestamp) - exit.at) / secondsPerBlock)))
        const estimate = head.number > behind ? head.number - behind : 0n
        const fromBlock = estimate > 2_000n ? estimate - 2_000n : 0n
        const toBlock = estimate + 1_000n < head.number ? estimate + 1_000n : head.number
        const logs = await reactive.getContractEvents({
          address: a.sentinel,
          abi: sentinelAbi,
          eventName: 'ExitRequested',
          args: { user },
          fromBlock,
          toBlock,
          strict: true,
        })
        const match = logs.find(l => same(l.args.operationId, exit.operationId))
        if (match) {
          found.set(exit.operationId, match.transactionHash)
          reactiveCache.set(`${user}:${exit.operationId}`, match.transactionHash)
        }
      }),
    )
  } catch {
    // The reactive-side hash is a nice-to-have; the exit itself is proven on the destination chain.
  }
  return found
}

export async function fetchExits(a: LiveAddresses, user: Address): Promise<ExitRecord[]> {
  const logs = await history(a.exitGuard)
  const mine = (args: Record<string, unknown>) => same(args.user as string, user) && same(args.vault as string, a.vault)

  const exited = decoded(exitGuardAbi, 'Exited', logs).filter(e => mine(e.args))
  const skipped = decoded(exitGuardAbi, 'ExitSkipped', logs).filter(e => mine(e.args))

  const records = await Promise.all([
    ...exited.map(
      async ({ log, args }): Promise<ExitRecord> => ({
        operationId: args.operationId as Hex,
        outcome: 'exited',
        shares: args.shares as bigint,
        assets: args.assets as bigint,
        at: await timeOf(log),
        txHash: log.transactionHash,
      }),
    ),
    ...skipped.map(
      async ({ log, args }): Promise<ExitRecord> => ({
        operationId: args.operationId as Hex,
        outcome: 'skipped',
        skipReason: SKIP_REASONS[Number(args.reason)] ?? 'Unknown reason',
        shares: 0n,
        assets: 0n,
        at: await timeOf(log),
        txHash: log.transactionHash,
      }),
    ),
  ])

  const reactiveByOp = await reactiveTxs(a, user, records)
  return records
    .map(r => ({ ...r, reactiveTx: reactiveByOp.get(r.operationId) }))
    .sort((x, y) => y.at - x.at)
}

export async function fetchPosition(a: LiveAddresses, user: Address | undefined): Promise<Position> {
  const [symbol, decimals, shareName] = await Promise.all([
    base.readContract({ address: a.token, abi: tokenAbi, functionName: 'symbol' }),
    base.readContract({ address: a.token, abi: tokenAbi, functionName: 'decimals' }),
    base.readContract({ address: a.vault, abi: vaultAbi, functionName: 'name' }),
  ])
  // ERC-4626 vaults name their share token ("Demo Vault Share"); show the vault's name.
  const vaultName = shareName.replace(/\s+shares?$/i, '')
  const empty = { symbol, decimals, vaultName, tokenBalance: 0n, shares: 0n, assets: 0n, shareAllowance: 0n, tokenAllowance: 0n }
  if (!user) return empty

  const [tokenBalance, shares, shareAllowance, tokenAllowance] = await Promise.all([
    base.readContract({ address: a.token, abi: tokenAbi, functionName: 'balanceOf', args: [user] }),
    base.readContract({ address: a.vault, abi: vaultAbi, functionName: 'balanceOf', args: [user] }),
    base.readContract({ address: a.vault, abi: vaultAbi, functionName: 'allowance', args: [user, a.exitGuard] }),
    base.readContract({ address: a.token, abi: tokenAbi, functionName: 'allowance', args: [user, a.vault] }),
  ])
  const assets =
    shares > 0n
      ? await base.readContract({ address: a.vault, abi: vaultAbi, functionName: 'previewRedeem', args: [shares] })
      : 0n
  return { ...empty, tokenBalance, shares, assets, shareAllowance, tokenAllowance }
}
