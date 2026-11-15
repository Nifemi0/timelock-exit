import type { AppData } from './types'
import { selectorsFor } from './rules'

/**
 * Sample data shown while contract addresses are not configured. Every value
 * here is invented; the UI labels the whole app as demo data in this mode.
 * Times are anchored to page load so the countdown and rail are live.
 */
const loadedAt = Math.floor(Date.now() / 1000)
const queuedAt = loadedAt - 8
const delay = 300

export const demoData: AppData = {
  mode: 'demo',
  loading: false,
  guard: {
    armed: true,
    timelock: '0x4b2e7a09c1d35f8e6a2b4c7d9e0f1a2b3c4d91c0',
    anyCallToVault: false,
    selectors: selectorsFor(['fee', 'upgrade', 'owner']),
    synced: true,
  },
  queue: [
    {
      key: 'demo-fee',
      operationId: '0x3fa8d1c4b7e2905f6a3c8d1e4b7a2c5f8e1d4b7a0c3f6e9d2b5a8c1f4e7dc21d',
      title: 'Exit fee → 99%',
      call: 'setExitFee(9900)',
      target: '0x9d04c2e6a8b1f3d5e7a9c0b2d4f6e8a1c3b577be',
      selector: selectorsFor(['fee'])[0],
      queuedAt,
      executesAt: queuedAt + delay,
      status: 'pending',
      matched: true,
      txHash: '0x5e1f8c2a7d4b9e3f6a1c5d8b2e7f4a9c3d6b1e8f5a2c7d4b9e3f6a1c5d8ba07c',
    },
    {
      key: 'demo-treasury',
      operationId: '0x81b0c4e7a2d5f8b1c4e7a0d3f6b9c2e5a8d1f4b7c0e3a6d9f2b5c8e1a4d70e44',
      title: 'Treasury address change',
      call: 'setTreasury(0x2c1a…b803)',
      target: '0x9d04c2e6a8b1f3d5e7a9c0b2d4f6e8a1c3b577be',
      selector: '0xf0f44260',
      queuedAt: loadedAt - 269,
      executesAt: loadedAt + 31,
      status: 'pending',
      matched: false,
      txHash: '0x2b7e4a9c1d6f3b8e5a2c7d4f9b1e6a3c8d5f2b7e4a9c1d6f3b8e5a2c7d4f19aa',
    },
  ],
  exits: [
    {
      operationId: '0x3fa8d1c4b7e2905f6a3c8d1e4b7a2c5f8e1d4b7a0c3f6e9d2b5a8c1f4e7dc21d',
      outcome: 'exited',
      shares: 1000n * 10n ** 18n,
      assets: 1000n * 10n ** 18n,
      at: queuedAt + 3,
      txHash: '0x07aa3d6f9c2e5b8a1d4f7c0e3b6a9d2f5c8e1b4a7d0f3c6e9b2a5d8f1c4ee9d5',
      reactiveTx: '0xc93d5a8e1b4f7c0d3a6e9b2f5c8d1a4e7b0c3f6a9d2e5b8c1f4a7d0e3b6c41b2',
    },
  ],
  position: {
    symbol: 'dUSD',
    decimals: 18,
    vaultName: 'Demo Vault',
    tokenBalance: 1000n * 10n ** 18n,
    shares: 0n,
    assets: 0n,
    shareAllowance: 2n ** 256n - 1n,
    tokenAllowance: 0n,
  },
}
