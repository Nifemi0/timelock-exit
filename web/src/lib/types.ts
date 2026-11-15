import type { Address, Hex } from 'viem'

export interface Guard {
  armed: boolean
  timelock?: Address
  anyCallToVault: boolean
  selectors: Hex[]
  /** Whether the reactive contract has mirrored this guard yet. Undefined when unknown. */
  synced?: boolean
}

export type QueueStatus = 'pending' | 'executed' | 'cancelled'

export interface QueueItem {
  /** Operation id plus call index: unique per queued call. */
  key: string
  operationId: Hex
  title: string
  call: string
  target: Address
  selector: Hex | null
  /** Unix seconds. */
  queuedAt: number
  executesAt: number
  status: QueueStatus
  matched: boolean
  txHash: Hex
}

export interface ExitRecord {
  operationId: Hex
  outcome: 'exited' | 'skipped'
  skipReason?: string
  shares: bigint
  assets: bigint
  /** Unix seconds. */
  at: number
  /** Callback transaction on the destination chain. */
  txHash: Hex
  /** Reactive transaction on Reactive Network, when it could be found. */
  reactiveTx?: Hex
}

export interface Position {
  symbol: string
  decimals: number
  vaultName: string
  tokenBalance: bigint
  shares: bigint
  /** What the shares would redeem for right now. */
  assets: bigint
  /** Vault-share allowance granted to ExitGuard. */
  shareAllowance: bigint
  /** Token allowance granted to the vault. */
  tokenAllowance: bigint
}

export interface AppData {
  mode: 'demo' | 'live'
  guard: Guard
  queue: QueueItem[]
  exits: ExitRecord[]
  position: Position
  loading: boolean
  error?: string
}
