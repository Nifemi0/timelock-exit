import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { baseRpc, destination, lasna } from './config'

export const wagmiConfig = createConfig({
  chains: [destination, lasna],
  connectors: [injected()],
  transports: {
    [destination.id]: http(baseRpc),
    [lasna.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig
  }
}
