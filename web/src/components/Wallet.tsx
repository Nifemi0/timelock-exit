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
  const hasWallet = typeof window !== 'undefined' && 'ethereum' in window
  const rejected = !!error && /reject|denied|cancel/i.test(error.message)
  const label = isPending
    ? 'Connecting'
    : !hasWallet
      ? 'No wallet found'
      : rejected
        ? 'Connect wallet'
        : error
          ? 'Retry connect'
          : 'Connect wallet'
  return (
    <button
      className="wallet tag w"
      disabled={!connector || isPending}
      onClick={() => connector && connect({ connector })}
      title={
        !hasWallet
          ? 'Install a browser wallet such as MetaMask'
          : rejected
            ? 'The connection request was declined. Click to try again.'
            : error
              ? error.message.split('\n')[0]
              : 'Connect a browser wallet'
      }
    >
      {label}
    </button>
  )
}
