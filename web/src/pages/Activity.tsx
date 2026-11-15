import { Cap, TxLink } from '../components/bits'
import { amount, clock, stamp } from '../lib/format'
import { useAppData, useNow } from '../lib/useAppData'
import type { QueueItem } from '../lib/types'

function statusOf(item: QueueItem, now: number): string {
  if (item.status === 'executed') return 'Executed'
  if (item.status === 'cancelled') return 'Cancelled'
  return now >= item.executesAt ? 'Executable' : `In ${clock(item.executesAt - now)}`
}

export function Activity() {
  const data = useAppData()
  const now = useNow()
  const linked = data.mode === 'live'
  const { position } = data
  const originOf = (operationId: string) => data.queue.find(q => q.operationId === operationId)

  return (
    <>
      <section className="hero solo">
        <div className="lead">
          <span className="tag">// Activity</span>
          <h1 className="display sm">
            Every exit,
            <br />
            <em>on the record.</em>
          </h1>
          <p className="lede">
            Each exit is three transactions on two chains. All of them are public, and all of them are linked here.
          </p>
        </div>
      </section>

      <section className="band" style={{ borderBottom: 0 }}>
        <Cap name="Exits">
          <span className="tag">{data.exits.length} recorded</span>
        </Cap>
        {data.exits.length === 0 ? (
          <div className="empty">No exits yet. When your guard fires, it is recorded here.</div>
        ) : (
          <div className="scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Trigger</th>
                  <th>Result</th>
                  <th>When</th>
                  <th>01 Queued</th>
                  <th>02 Matched</th>
                  <th>03 Redeemed</th>
                </tr>
              </thead>
              <tbody>
                {data.exits.map(exit => {
                  const origin = originOf(exit.operationId)
                  return (
                    <tr key={exit.txHash} className={exit.outcome === 'exited' ? '' : 'off'}>
                      <td>{origin?.title ?? 'Queued change'}</td>
                      <td>
                        {exit.outcome === 'exited'
                          ? `${amount(exit.assets, position.decimals)} ${position.symbol} returned`
                          : `Skipped: ${exit.skipReason}`}
                      </td>
                      <td className="num">{stamp(exit.at)}</td>
                      <td>
                        <code>
                          <TxLink hash={origin?.txHash} chain="base" linked={linked} />
                        </code>
                      </td>
                      <td>
                        <code>
                          <TxLink hash={exit.reactiveTx} chain="lasna" linked={linked} />
                        </code>
                      </td>
                      <td>
                        <code>
                          <TxLink hash={exit.txHash} chain="base" linked={linked} />
                        </code>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <Cap name="Timelock history">
          <span className="tag">{data.queue.length} queued calls</span>
        </Cap>
        {data.queue.length === 0 ? (
          <div className="empty">Nothing has been queued on this timelock in the lookback window.</div>
        ) : (
          <div className="scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Change</th>
                  <th>Call</th>
                  <th>Queued</th>
                  <th>Status</th>
                  <th>Your rules</th>
                  <th>Transaction</th>
                </tr>
              </thead>
              <tbody>
                {data.queue.map(item => (
                  <tr key={item.key} className={item.matched ? '' : 'off'}>
                    <td>{item.title}</td>
                    <td>
                      <code>{item.call}</code>
                    </td>
                    <td className="num">{stamp(item.queuedAt)}</td>
                    <td className="num">{statusOf(item, now)}</td>
                    <td>
                      <span className={item.matched ? 'tag b' : 'tag'}>{item.matched ? 'Matched' : 'Not in rules'}</span>
                    </td>
                    <td>
                      <code>
                        <TxLink hash={item.txHash} chain="base" linked={linked} />
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
