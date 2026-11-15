import type { ReactNode } from 'react'
import type { Hex } from 'viem'
import { explorer } from '../lib/config'
import { short } from '../lib/format'

/** Link to a transaction on the right explorer. Demo hashes are shown but not linked. */
export function TxLink({ hash, chain, linked }: { hash?: Hex; chain: 'base' | 'lasna'; linked: boolean }) {
  if (!hash) return <span className="none">not found</span>
  if (!linked) return <span className="none">{short(hash)}</span>
  return (
    <a href={`${explorer[chain]}/tx/${hash}`} target="_blank" rel="noreferrer">
      {short(hash)} ↗
    </a>
  )
}

export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path d="M1 1h20v7M21 14v7H1V1" stroke="#fff" strokeWidth="1.5" />
      <path d="M8 11h13m0 0-3.5-3.5M21 11l-3.5 3.5" stroke="#2F6BFF" strokeWidth="1.5" />
    </svg>
  )
}

/** Section caption: `// NAME` on the left, optional detail on the right. */
export function Cap({ name, children }: { name: string; children?: ReactNode }) {
  return (
    <div className="cap">
      <span className="tag w">// {name}</span>
      {children}
    </div>
  )
}
