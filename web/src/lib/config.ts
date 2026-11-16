import { defineChain, type Address } from 'viem'
import { baseSepolia } from 'viem/chains'

export const lasna = defineChain({
  id: 5318007,
  name: 'Reactive Lasna',
  nativeCurrency: { name: 'lREACT', symbol: 'lREACT', decimals: 18 },
  rpcUrls: { default: { http: ['https://lasna-rpc.rnk.dev/'] } },
  blockExplorers: { default: { name: 'Reactscan', url: 'https://lasna.reactscan.net' } },
  testnet: true,
})

export const destination = baseSepolia

const env = import.meta.env

function address(value: string | undefined): Address | undefined {
  return value && /^0x[0-9a-fA-F]{40}$/.test(value) ? (value as Address) : undefined
}

export const addresses = {
  exitGuard: address(env.VITE_EXIT_GUARD),
  sentinel: address(env.VITE_SENTINEL),
  vault: address(env.VITE_VAULT),
  timelock: address(env.VITE_TIMELOCK),
  token: address(env.VITE_TOKEN),
}

export type LiveAddresses = { [K in keyof typeof addresses]: Address }

/** Present only when every contract address is configured. */
export const live: LiveAddresses | undefined =
  addresses.exitGuard && addresses.sentinel && addresses.vault && addresses.timelock && addresses.token
    ? (addresses as LiveAddresses)
    : undefined

/**
 * The official endpoint (sepolia.base.org) limits eth_getLogs to 200 blocks, which
 * breaks history reads. PublicNode allowed 50,000-block ranges when tested on 15 Nov 2026.
 */
export const baseRpc: string = env.VITE_BASE_SEPOLIA_RPC || 'https://base-sepolia-rpc.publicnode.com'

/**
 * First Base Sepolia block to read history from. Defaults to just before the
 * 15 Nov 2026 deployment (the timelock was created in block 59288812).
 */
export const historyFromBlock = BigInt(Number(env.VITE_FROM_BLOCK) > 0 ? Number(env.VITE_FROM_BLOCK) : 59_288_000)

export const explorer = {
  base: 'https://sepolia.basescan.org',
  lasna: 'https://lasna.reactscan.net',
}

export const repoUrl = 'https://github.com/Nifemi0/timelock-exit'
