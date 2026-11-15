import { createPublicClient, decodeFunctionData, http, type Address, type Hex } from 'viem'
import { baseRpc, destination, lasna, lookbackBlocks, type LiveAddresses } from './config'
import { exitGuardAbi, knownCallsAbi, sentinelAbi, timelockAbi, tokenAbi, vaultAbi } from './abis'
import { short } from './format'
import type { ExitRecord, Guard, Position, QueueItem, QueueStatus } from './types'

/**
 * Read-side chain access. These paths have been type-checked but not yet run
 * against deployed contracts; see docs/ROADMAP.md.
 */

const base = createPublicClient({ chain: destination, transport: http(baseRpc) })
const reactive = createPublicClient({ chain: lasna, transport: http() })

const CHUNK = 9_000n
const SKIP_REASONS = ['Guard not armed', 'Nothing to redeem', 'Redeem failed']

function ranges(from: bigint, to: bigint): Array<[bigint, bigint]> {
  const out: Array<[bigint, bigint]> = []
  for (let start = from; start <= to; start += CHUNK) {
    const end = start + CHUNK - 1n
    out.push([start, end > to ? to : end])
  }
  return out
}

async function lookback(latest: bigint): Promise<Array<[bigint, bigint]>> {
  return ranges(latest > lookbackBlocks ? latest - lookbackBlocks : 0n, latest)
}

const blockTimes = new Map<bigint, number>()
async function timeOf(blockNumber: bigint): Promise<number> {
  const cached = blockTimes.get(blockNumber)
  if (cached !== undefined) return cached
  const block = await base.getBlock({ blockNumber })
  const seconds = Number(block.timestamp)
  blockTimes.set(blockNumber, seconds)
  return seconds
}

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
  const latest = await base.getBlockNumber()
  const logs = (
    await Promise.all(
      (await lookback(latest)).map(([fromBlock, toBlock]) =>
        base.getContractEvents({
          address: a.timelock,
          abi: timelockAbi,
          eventName: 'CallScheduled',
          fromBlock,
          toBlock,
          strict: true,
        }),
      ),
    )
  ).flat()

  const items = await Promise.all(
    logs.map(async (log): Promise<QueueItem> => {
      const { id, index, target, data, delay } = log.args
      const [timestamp, queuedAt] = await Promise.all([
        base.readContract({ address: a.timelock, abi: timelockAbi, functionName: 'getTimestamp', args: [id] }),
        timeOf(log.blockNumber),
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

async function reactiveTxs(a: LiveAddresses, user: Address): Promise<Map<Hex, Hex>> {
  const found = new Map<Hex, Hex>()
  try {
    const latest = await reactive.getBlockNumber()
    const logs = (
      await Promise.all(
        (await lookback(latest)).map(([fromBlock, toBlock]) =>
          reactive.getContractEvents({
            address: a.sentinel,
            abi: sentinelAbi,
            eventName: 'ExitRequested',
            args: { user },
            fromBlock,
            toBlock,
            strict: true,
          }),
        ),
      )
    ).flat()
    for (const log of logs) found.set(log.args.operationId, log.transactionHash)
  } catch {
    // The reactive-side hash is a nice-to-have; the exit itself is proven on the destination chain.
  }
  return found
}

export async function fetchExits(a: LiveAddresses, user: Address): Promise<ExitRecord[]> {
  const latest = await base.getBlockNumber()
  const windows = await lookback(latest)
  const args = { user, vault: a.vault }

  const [exited, skipped, reactiveByOp] = await Promise.all([
    Promise.all(
      windows.map(([fromBlock, toBlock]) =>
        base.getContractEvents({ address: a.exitGuard, abi: exitGuardAbi, eventName: 'Exited', args, fromBlock, toBlock, strict: true }),
      ),
    ).then(r => r.flat()),
    Promise.all(
      windows.map(([fromBlock, toBlock]) =>
        base.getContractEvents({ address: a.exitGuard, abi: exitGuardAbi, eventName: 'ExitSkipped', args, fromBlock, toBlock, strict: true }),
      ),
    ).then(r => r.flat()),
    reactiveTxs(a, user),
  ])

  const records = await Promise.all([
    ...exited.map(
      async (log): Promise<ExitRecord> => ({
        operationId: log.args.operationId,
        outcome: 'exited',
        shares: log.args.shares,
        assets: log.args.assets,
        at: await timeOf(log.blockNumber),
        txHash: log.transactionHash,
        reactiveTx: reactiveByOp.get(log.args.operationId),
      }),
    ),
    ...skipped.map(
      async (log): Promise<ExitRecord> => ({
        operationId: log.args.operationId,
        outcome: 'skipped',
        skipReason: SKIP_REASONS[log.args.reason] ?? 'Unknown reason',
        shares: 0n,
        assets: 0n,
        at: await timeOf(log.blockNumber),
        txHash: log.transactionHash,
        reactiveTx: reactiveByOp.get(log.args.operationId),
      }),
    ),
  ])
  return records.sort((x, y) => y.at - x.at)
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
