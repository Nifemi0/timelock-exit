import { useEffect, useState } from 'react'
import { maxUint256, parseUnits } from 'viem'
import { useAccount } from 'wagmi'
import { writeContract } from 'wagmi/actions'
import { Cap } from '../components/bits'
import { exitGuardAbi, tokenAbi, vaultAbi } from '../lib/abis'
import { destination, live } from '../lib/config'
import { amount, short } from '../lib/format'
import { MAX_SELECTORS, presets, presetsIn, selectorsFor, type RuleId } from '../lib/rules'
import { useAppData } from '../lib/useAppData'
import { useTx } from '../lib/useTx'
import { wagmiConfig } from '../lib/wagmi'

const chainId = destination.id

export function Guards() {
  const data = useAppData()
  const { address } = useAccount()
  const { state, run, note } = useTx()
  const { guard, position } = data

  const [rules, setRules] = useState<RuleId[]>([])
  const [anyCall, setAnyCall] = useState(false)
  const [deposit, setDeposit] = useState('')

  // Start the form from the guard that is already on-chain, once it has loaded.
  const guardKey = `${guard.armed}:${guard.anyCallToVault}:${guard.selectors.join(',')}`
  useEffect(() => {
    setRules(guard.armed ? presetsIn(guard.selectors) : ['fee', 'upgrade', 'owner'])
    setAnyCall(guard.armed ? guard.anyCallToVault : false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardKey])

  const selectors = selectorsFor(rules)
  const hasRule = anyCall || selectors.length > 0
  const busy = state.pending !== undefined
  const canSend = live !== undefined && address !== undefined && !busy
  const approved = position.shareAllowance > 0n && position.shareAllowance >= position.shares

  const blocked = !live
    ? 'Demo mode: connect deployed contracts to send transactions.'
    : !address
      ? 'Connect a wallet to send transactions.'
      : undefined

  const toggle = (id: RuleId) => setRules(r => (r.includes(id) ? r.filter(x => x !== id) : [...r, id]))

  const picked = presets.filter(p => rules.includes(p.id)).map(p => p.label.toLowerCase())
  const sentence = anyCall
    ? picked.length > 0
      ? `Exit me when any change to the vault, or a ${picked.join(', or a ')} anywhere, is queued.`
      : 'Exit me when any change to the vault is queued.'
    : picked.length > 0
      ? `Exit me when a ${picked.join(', or a ')} is queued.`
      : 'Pick at least one kind of change.'

  async function arm() {
    const a = live
    if (!a || !address) return note(blocked ?? '')
    await run(guard.armed ? 'Guard updated' : 'Guard armed', () =>
      writeContract(wagmiConfig, {
        chainId,
        address: a.exitGuard,
        abi: exitGuardAbi,
        functionName: 'arm',
        args: [a.vault, a.timelock, anyCall, selectors],
      }),
    )
  }

  async function approveShares() {
    const a = live
    if (!a || !address) return note(blocked ?? '')
    await run('Shares approved', () =>
      writeContract(wagmiConfig, {
        chainId,
        address: a.vault,
        abi: vaultAbi,
        functionName: 'approve',
        args: [a.exitGuard, maxUint256],
      }),
    )
  }

  async function disarm() {
    const a = live
    if (!a || !address) return note(blocked ?? '')
    await run('Guard disarmed', () =>
      writeContract(wagmiConfig, {
        chainId,
        address: a.exitGuard,
        abi: exitGuardAbi,
        functionName: 'disarm',
        args: [a.vault],
      }),
    )
  }

  async function mint() {
    const a = live
    if (!a || !address) return note(blocked ?? '')
    await run('1,000 test tokens minted', () =>
      writeContract(wagmiConfig, {
        chainId,
        address: a.token,
        abi: tokenAbi,
        functionName: 'mint',
        args: [address, parseUnits('1000', position.decimals)],
      }),
    )
  }

  async function depositTokens() {
    const a = live
    if (!a || !address) return note(blocked ?? '')
    let value: bigint
    try {
      value = parseUnits(deposit.trim(), position.decimals)
    } catch {
      return note('Enter an amount to deposit.')
    }
    if (value <= 0n) return note('Enter an amount to deposit.')
    if (value > position.tokenBalance) return note(`You only have ${amount(position.tokenBalance, position.decimals)} ${position.symbol}.`)

    if (position.tokenAllowance < value) {
      const ok = await run('Deposit approved', () =>
        writeContract(wagmiConfig, {
          chainId,
          address: a.token,
          abi: tokenAbi,
          functionName: 'approve',
          args: [a.vault, value],
        }),
      )
      if (!ok) return
    }
    const ok = await run('Deposited', () =>
      writeContract(wagmiConfig, {
        chainId,
        address: a.vault,
        abi: vaultAbi,
        functionName: 'deposit',
        args: [value, address],
      }),
    )
    if (ok) setDeposit('')
  }

  return (
    <>
      <section className="hero solo">
        <div className="lead">
          <span className="tag">// Guards</span>
          <h1 className="display sm">
            One standing
            <br />
            <em>instruction.</em>
          </h1>
          <p className="lede">
            Choose which queued changes should pull you out of {position.vaultName}. Your shares stay in your wallet;
            the guard can only redeem them back to you.
          </p>
        </div>
      </section>

      <div className="status" role="status" aria-live="polite">
        {state.pending && <span className="tag w">[ Confirm in wallet ] {state.pending}</span>}
        {state.done && <span className="tag b">[ Done ] {state.done}</span>}
        {state.error &&
          (state.error === blocked ? (
            <span className="tag w">[ Not sent ] {state.error}</span>
          ) : (
            <span className="tag a">[ Error ] {state.error}</span>
          ))}
        {!state.pending && !state.done && !state.error && <span className="tag">{blocked ?? 'Ready.'}</span>}
      </div>

      <div className="cols two">
        <section>
          <Cap name="Rules">
            <span className={guard.armed ? 'tag b' : 'tag'}>
              <span className={guard.armed ? 'sq' : 'sq off'} style={{ marginRight: 8 }} />
              {guard.armed ? (guard.synced === false ? 'Armed, syncing' : 'Armed') : 'Not armed'}
            </span>
          </Cap>

          {presets.map(p => {
            const on = rules.includes(p.id)
            return (
              <button
                type="button"
                key={p.id}
                className={on ? 'rule' : 'rule no'}
                onClick={() => toggle(p.id)}
                aria-pressed={on}
              >
                <span className="box">{on ? '[x]' : '[ ]'}</span>
                {p.label}
                <span className="hint">{p.hint}</span>
              </button>
            )
          })}
          <button
            type="button"
            className={anyCall ? 'rule' : 'rule no'}
            onClick={() => setAnyCall(v => !v)}
            aria-pressed={anyCall}
          >
            <span className="box">{anyCall ? '[x]' : '[ ]'}</span>
            Any change to the vault
            <span className="hint">every call targeting it</span>
          </button>

          <div className="cell">
            <span className="tag">[ Your instruction ]</span>
            <h2 className="title" style={{ marginTop: 12 }}>
              {sentence}
            </h2>
            <p className="body">
              {selectors.length} of {MAX_SELECTORS} function selectors used. Named changes are caught on any contract,
              so an upgrade routed through a proxy admin still counts.
            </p>
          </div>

          <div className="act">
            <button className="btn fill" onClick={arm} disabled={!hasRule || (live !== undefined && !canSend)}>
              {guard.armed ? 'Update guard' : 'Arm guard'}
            </button>
            <button className="btn" onClick={disarm} disabled={!guard.armed || (live !== undefined && !canSend)}>
              Disarm
            </button>
          </div>
        </section>

        <section>
          <Cap name="Position">
            <span className="tag">{address ? short(address) : 'No wallet'}</span>
          </Cap>
          <div className="kv">
            <span className="tag">In wallet</span>
            <span>
              {amount(position.tokenBalance, position.decimals)} {position.symbol}
            </span>
          </div>
          <div className="kv">
            <span className="tag">In {position.vaultName}</span>
            <span>
              {amount(position.assets, position.decimals)} {position.symbol}
            </span>
          </div>
          <div className="kv">
            <span className="tag">Shares approved to guard</span>
            <span className={approved ? '' : 'dimmed'}>{approved ? 'All' : position.shareAllowance > 0n ? 'Partial' : 'None'}</span>
          </div>
          <div className="act">
            <button className="btn fill" onClick={approveShares} disabled={approved || (live !== undefined && !canSend)}>
              {approved ? 'Shares approved' : 'Approve shares'}
            </button>
          </div>

          <Cap name="Test funds">
            <span className="tag">Testnet only</span>
          </Cap>
          <div className="field">
            <label className="tag" htmlFor="deposit">
              Deposit
            </label>
            <input
              id="deposit"
              inputMode="decimal"
              placeholder="0.00"
              value={deposit}
              onChange={e => setDeposit(e.target.value.replace(/[^0-9.]/g, ''))}
            />
            <span className="tag">{position.symbol}</span>
          </div>
          <div className="act">
            <button className="btn" onClick={mint} disabled={live !== undefined && !canSend}>
              Mint 1,000
            </button>
            <button className="btn" onClick={depositTokens} disabled={live !== undefined && !canSend}>
              Deposit
            </button>
          </div>
          <div className="cell">
            <p className="body" style={{ marginTop: 0 }}>
              An unapproved guard cannot redeem anything. Approval lets the guard call redeem on your shares, with you
              as the only possible recipient.
            </p>
          </div>
        </section>
      </div>
    </>
  )
}
