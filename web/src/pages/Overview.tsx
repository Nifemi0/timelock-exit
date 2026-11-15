import { Link, useLocation } from 'react-router-dom'
import { Cap, TxLink } from '../components/bits'
import { Rail } from '../components/Rail'
import { amount, clock, duration, short } from '../lib/format'
import { presets, presetsIn } from '../lib/rules'
import { useAppData, useNow } from '../lib/useAppData'
import type { AppData, ExitRecord, QueueItem } from '../lib/types'

interface Focus {
  item?: QueueItem
  exit?: ExitRecord
}

/** The queued change the page is about: a pending match first, then the latest exit, then anything pending. */
function pickFocus(data: AppData): Focus {
  const exitFor = (item: QueueItem) =>
    data.exits.find(e => e.outcome === 'exited' && e.operationId === item.operationId)

  const pendingMatch = data.queue.find(q => q.status === 'pending' && q.matched)
  if (pendingMatch) return { item: pendingMatch, exit: exitFor(pendingMatch) }

  const lastExit = data.exits.find(e => e.outcome === 'exited')
  if (lastExit) return { item: data.queue.find(q => q.operationId === lastExit.operationId), exit: lastExit }

  return { item: data.queue.find(q => q.status === 'pending') }
}

export function Overview() {
  const data = useAppData()
  const { search } = useLocation()
  const now = useNow()
  const { item, exit } = pickFocus(data)
  const { guard, position } = data
  const linked = data.mode === 'live'

  const inFlight = !!item && item.matched && item.status === 'pending' && !exit
  const latency = exit && item ? duration(exit.at - item.queuedAt) : undefined
  const ticked = presetsIn(guard.selectors)

  let headline = (
    <>
      No guard
      <br />
      <em>armed.</em>
    </>
  )
  let lede = <>Arm a guard to have your vault shares redeemed the moment a change you care about is queued.</>

  if (data.loading) {
    headline = (
      <>
        Reading
        <br />
        <em>the chain.</em>
      </>
    )
    lede = <>Loading the timelock queue and your guard.</>
  } else if (exit) {
    headline = (
      <>
        Out before
        <br />
        it <em>landed.</em>
      </>
    )
    lede = (
      <>
        <b>
          {amount(exit.assets, position.decimals)} {position.symbol}
        </b>{' '}
        returned to your wallet.{' '}
        {item ? `"${item.title}" was queued on ${position.vaultName}; your guard redeemed your shares before it could take effect.` : 'Your guard redeemed your shares.'}
      </>
    )
  } else if (inFlight) {
    headline = (
      <>
        Exit
        <br />
        <em>in flight.</em>
      </>
    )
    lede = <>A queued change matches your rules. The exit has been requested and should confirm within seconds.</>
  } else if (guard.armed) {
    headline = (
      <>
        Watching
        <br />
        <em>the queue.</em>
      </>
    )
    lede = (
      <>
        Nothing queued matches your rules.{' '}
        <b>
          {amount(position.assets, position.decimals)} {position.symbol}
        </b>{' '}
        is in {position.vaultName} and guarded.
      </>
    )
  }

  const pending = data.queue.filter(q => q.status === 'pending')

  return (
    <>
      <section className="hero">
        <div className="lead">
          <span className="tag">// Status</span>
          <h1 className="display">{headline}</h1>
          <p className="lede">{lede}</p>
          {data.error && <p className="tag a" style={{ marginTop: 18 }}>[ Read error ] {data.error}</p>}
          {!guard.armed && !data.loading && (
            <div className="cta">
              <Link className="btn fill" to={{ pathname: '/app/guards', search }}>
                Arm a guard
              </Link>
            </div>
          )}
        </div>
        <div className="stats">
          <div className="stat">
            <span className="tag">[ Change executes in ]</span>
            <span className="num">{item && item.status === 'pending' ? clock(item.executesAt - now) : '--:--'}</span>
          </div>
          <div className="stat">
            <span className="tag">[ Exit latency ]</span>
            <span className="num">
              {latency ? (
                <>
                  {latency.value}
                  <small>{latency.unit}</small>
                </>
              ) : (
                '--'
              )}
            </span>
          </div>
        </div>
      </section>

      <section className="rail">
        <div className="rail-head">
          <span className="tag">// Timelock window</span>
          <span className="tag">{item ? `Delay ${clock(item.executesAt - item.queuedAt)}` : 'Idle'}</span>
        </div>
        <Rail
          queuedAt={item?.queuedAt}
          executesAt={item?.executesAt}
          exitAt={exit?.at}
          now={now}
          effect={item?.title}
          inFlight={inFlight}
        />
      </section>

      <div className="cols">
        <section>
          <Cap name="Queue">
            <span className="tag">{guard.timelock ? `Timelock ${short(guard.timelock)}` : `${pending.length} pending`}</span>
          </Cap>
          {pending.length === 0 && <div className="empty">Nothing is queued on this timelock.</div>}
          {pending.map(q => {
            const fired = data.exits.some(e => e.outcome === 'exited' && e.operationId === q.operationId)
            return (
              <div className={q.matched ? 'q' : 'q off'} key={q.key}>
                <strong>{q.title}</strong>
                <span className="num">{now >= q.executesAt ? 'Ready' : clock(q.executesAt - now)}</span>
                <code>{q.call}</code>
                <span className={q.matched ? 'tag b' : 'tag'}>
                  {fired ? 'Guard fired' : q.matched ? 'Matches rules' : 'Not in rules'}
                </span>
              </div>
            )
          })}
        </section>

        <section>
          <Cap name="Proof">
            <span className="tag">{exit ? '3 transactions' : 'No exit yet'}</span>
          </Cap>
          {!exit && <div className="empty">When your guard fires, the three transactions that prove it appear here.</div>}
          {exit && (
            <>
              <div className="tx">
                <span className="n">01</span>
                <span className="what">Change queued</span>
                <TxLink hash={item?.txHash} chain="base" linked={linked} />
                <span className="tag where">Base Sepolia</span>
              </div>
              <div className="tx">
                <span className="n">02</span>
                <span className="what">Rule matched</span>
                <TxLink hash={exit.reactiveTx} chain="lasna" linked={linked} />
                <span className="tag where">Reactive Network</span>
              </div>
              <div className="tx">
                <span className="n">03</span>
                <span className="what">Shares redeemed</span>
                <TxLink hash={exit.txHash} chain="base" linked={linked} />
                <span className="tag where">Base Sepolia</span>
              </div>
            </>
          )}
        </section>

        <section>
          <Cap name="Guard">
            <span className={guard.armed ? 'tag b' : 'tag'}>
              <span className={guard.armed ? 'sq' : 'sq off'} style={{ marginRight: 8 }} />
              {guard.armed ? (guard.synced === false ? 'Syncing' : 'Armed') : 'Not armed'}
            </span>
          </Cap>
          {presets.map(p => {
            const on = guard.armed && ticked.includes(p.id)
            return (
              <div className={on ? 'rule' : 'rule no'} key={p.id}>
                <span className="box">{on ? '[x]' : '[ ]'}</span>
                {p.label}
              </div>
            )
          })}
          <div className={guard.armed && guard.anyCallToVault ? 'rule' : 'rule no'}>
            <span className="box">{guard.armed && guard.anyCallToVault ? '[x]' : '[ ]'}</span>
            Any change to the vault
          </div>
          <div className="kv">
            <span className="tag">Vault</span>
            <span>{position.vaultName}</span>
          </div>
          <div className="kv">
            <span className="tag">Shares approved</span>
            <span>
              {position.shareAllowance === 0n ? 'None' : position.shareAllowance >= position.shares ? 'All' : 'Partial'}
            </span>
          </div>
          <div className="act">
            <Link className="btn fill" to={{ pathname: '/app/guards', search }}>
              {guard.armed ? 'Edit rules' : 'Arm guard'}
            </Link>
            <Link className="btn" to={{ pathname: '/app/activity', search }}>
              Activity
            </Link>
          </div>
        </section>
      </div>
    </>
  )
}
