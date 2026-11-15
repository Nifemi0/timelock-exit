import { Link } from 'react-router-dom'
import { Cap } from '../components/bits'
import { Rail } from '../components/Rail'
import { demoData } from '../lib/demo'
import { useNow } from '../lib/useAppData'

export function Landing() {
  const now = useNow()
  // The landing page always illustrates the idea with the sample scenario.
  const sample = demoData.queue[0]
  const sampleExit = demoData.exits[0]

  return (
    <>
      <section className="hero solo">
        <div className="lead" style={{ paddingTop: 64, paddingBottom: 72 }}>
          <span className="tag">[ Governance watch for depositors ]</span>
          <h1 className="display">
            Leave before
            <br />
            the upgrade <em>lands.</em>
          </h1>
          <p className="lede">
            Protocols queue admin changes behind a timelock so you have time to leave. <b>Nobody reads the queue.</b>{' '}
            Timelock Exit reads it for you and redeems your deposit the moment a change you care about is queued.
          </p>
          <div className="cta">
            <Link className="btn fill" to="/app">
              Launch app
            </Link>
            <Link className="btn" to="/how-it-works">
              How it works
            </Link>
          </div>
        </div>
      </section>

      <section className="rail">
        <div className="rail-head">
          <span className="tag">// Illustration: a five-minute timelock</span>
          <span className="tag">Sample scenario</span>
        </div>
        <Rail
          queuedAt={sample.queuedAt}
          executesAt={sample.executesAt}
          exitAt={sampleExit.at}
          now={now}
          effect={sample.title}
        />
      </section>

      <div className="cols three band">
        <div className="step">
          <span className="n">01</span>
          <h3>Arm a guard.</h3>
          <p>Pick the vault and the kinds of change that should pull you out. One transaction, on the chain your funds are already on.</p>
        </div>
        <div className="step">
          <span className="n">02</span>
          <h3>Close the tab.</h3>
          <p>A reactive contract subscribes to the protocol's timelock and watches every queued call. No bot, no server, no alerts.</p>
        </div>
        <div className="step">
          <span className="n">03</span>
          <h3>Get out first.</h3>
          <p>When a matching change is queued, your shares are redeemed straight to your wallet, long before the delay runs out.</p>
        </div>
      </div>

      <div className="cols two">
        <section>
          <Cap name="Why it matters" />
          <ul className="list">
            <li>
              <span className="n">A</span>
              <span>
                <b>A timelock only protects people who are watching.</b> The delay is there so depositors can leave, but
                the queue is raw calldata on a block explorer.
              </span>
            </li>
            <li>
              <span className="n">B</span>
              <span>
                <b>Professional teams watch by hand.</b> Funds that deposit into other protocols run their own monitoring
                and scan scheduled calls manually.
              </span>
            </li>
            <li>
              <span className="n">C</span>
              <span>
                <b>Everyone else finds out afterwards.</b> By the time a fee change or upgrade is news, it has already
                executed.
              </span>
            </li>
          </ul>
        </section>
        <section>
          <Cap name="What it will not do" />
          <ul className="list">
            <li>
              <span className="n">A</span>
              <span>
                <b>It never holds your funds.</b> The guard can only redeem shares you approved, and only to you.
              </span>
            </li>
            <li>
              <span className="n">B</span>
              <span>
                <b>It does not need the protocol's permission.</b> It works with any standard OpenZeppelin timelock and
                any ERC-4626 vault.
              </span>
            </li>
            <li>
              <span className="n">C</span>
              <span>
                <b>It does not judge the change.</b> It exits on the rules you set, so narrow rules mean fewer false
                exits.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
