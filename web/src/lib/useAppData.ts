import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'
import { useSearchParams } from 'react-router-dom'
import { getAddress, isAddress, type Address } from 'viem'
import { live } from './config'
import { demoData } from './demo'
import { fetchExits, fetchGuard, fetchPosition, fetchQueue } from './chain'
import type { AppData, Guard } from './types'

const NO_GUARD: Guard = { armed: false, anyCallToVault: false, selectors: [] }

const EMPTY: AppData = {
  mode: 'live',
  loading: true,
  guard: NO_GUARD,
  queue: [],
  exits: [],
  position: {
    symbol: '',
    decimals: 18,
    vaultName: 'Vault',
    tokenBalance: 0n,
    shares: 0n,
    assets: 0n,
    shareAllowance: 0n,
    tokenAllowance: 0n,
  },
}

export const APP_QUERY_KEY = 'app-data'

/**
 * The address whose guard and exits are shown. An explicit `?account=0x…` in the URL wins,
 * read-only, so a shared link shows the same position to everyone, wallet or not. Without
 * it, the connected wallet is shown.
 */
export function useViewedAddress(): { address?: Address; readOnly: boolean } {
  const { address } = useAccount()
  const [params] = useSearchParams()
  const param = params.get('account')
  if (param && isAddress(param)) {
    const viewed = getAddress(param)
    return { address: viewed, readOnly: !address || viewed !== getAddress(address) }
  }
  return address ? { address, readOnly: false } : { readOnly: false }
}

/** Everything the pages render: demo data until contracts are configured, then live chain reads. */
export function useAppData(): AppData {
  const { address } = useViewedAddress()

  const query = useQuery({
    queryKey: [APP_QUERY_KEY, address ?? null],
    enabled: live !== undefined,
    // Fast enough to show an exit within seconds, slow enough to stay inside free RPC limits.
    refetchInterval: 6_000,
    queryFn: async (): Promise<AppData> => {
      const a = live!
      const guard = address ? await fetchGuard(a, address) : NO_GUARD
      const [queue, exits, position] = await Promise.all([
        fetchQueue(a, guard),
        address ? fetchExits(a, address) : Promise.resolve([]),
        fetchPosition(a, address),
      ])
      return { mode: 'live', loading: false, guard, queue, exits, position }
    },
  })

  if (!live) return demoData
  if (query.data) return query.error ? { ...query.data, error: messageOf(query.error) } : query.data
  return query.error ? { ...EMPTY, loading: false, error: messageOf(query.error) } : EMPTY
}

function messageOf(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.split('\n')[0].slice(0, 160)
}

/** Current unix time in seconds, updated every second. */
export function useNow(): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}
