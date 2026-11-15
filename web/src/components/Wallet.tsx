import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { short } from '../lib/format'

/** Header wallet cell: connect with a browser wallet, or show the address and disconnect on click. */
export function Wallet() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()

  if (isConnected && address) {
    return (
      <button className="wallet tag w" onClick={() => disconnect()} title="Disconnect wallet">
        {short(address)}
      </button>
    )
  }

  const connector = connectors[0]
  return (
    <button
      className="wallet tag w"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      title={error ? error.message.split('\n')[0] : 'Connect a browser wallet'}
    >
      {isPending ? 'Connecting' : error ? 'No wallet found' : 'Connect wallet'}
    </button>
  )
}
