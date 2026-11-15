import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getAccount, switchChain, waitForTransactionReceipt } from 'wagmi/actions'
import type { Hex } from 'viem'
import { destination } from './config'
import { wagmiConfig } from './wagmi'
import { APP_QUERY_KEY } from './useAppData'

export interface TxState {
  /** Label of the transaction currently being sent or confirmed. */
  pending?: string
  /** Label of the last transaction that confirmed. */
  done?: string
  error?: string
}

/** Sends one transaction at a time on the destination chain and refreshes app data once it confirms. */
export function useTx() {
  const [state, setState] = useState<TxState>({})
  const queryClient = useQueryClient()

  const run = useCallback(
    async (label: string, send: () => Promise<Hex>): Promise<boolean> => {
      setState({ pending: label })
      try {
        if (getAccount(wagmiConfig).chainId !== destination.id) {
          await switchChain(wagmiConfig, { chainId: destination.id })
        }
        const hash = await send()
        await waitForTransactionReceipt(wagmiConfig, { hash })
        await queryClient.invalidateQueries({ queryKey: [APP_QUERY_KEY] })
        setState({ done: label })
        return true
      } catch (error) {
        const text = error instanceof Error ? error.message : String(error)
        setState({ error: text.split('\n')[0].slice(0, 140) })
        return false
      }
    },
    [queryClient],
  )

  const note = useCallback((error: string) => setState({ error }), [])

  return { state, run, note }
}
