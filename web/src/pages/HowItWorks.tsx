import { Cap } from '../components/bits'
import { addresses, explorer } from '../lib/config'

const mono = { fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: 0.9 } as const
const name = { fontFamily: 'Geist, sans-serif', fontSize: 22, fontWeight: 300, letterSpacing: -0.5 } as const

function Flow() {
  return (
    <svg viewBox="0 0 1272 300" role="img" aria-label="Flow: the timelock on Base Sepolia emits an event, the sentinel on Reactive Network matches it, and ExitGuard on Base Sepolia redeems the shares">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 10 5 0 10" fill="none" stroke="#8C8C8C" strokeWidth="1.5" />
        </marker>
        <marker id="arrow-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 10 5 0 10" fill="none" stroke="#2F6BFF" strokeWidth="1.5" />
        </marker>
      </defs>

      <rect x="24" y="40" width="320" height="96" fill="none" stroke="#242424" />
      <text x="44" y="68" fill="#8C8C8C" {...mono}>[ BASE SEPOLIA ]</text>
      <text x="44" y="108" fill="#fff" {...name}>TimelockController</text>

      <rect x="24" y="176" width="320" height="96" fill="none" stroke="#242424" />
      <text x="44" y="204" fill="#8C8C8C" {...mono}>[ BASE SEPOLIA ]</text>
      <text x="44" y="244" fill="#fff" {...name}>ExitGuard</text>

      <rect x="476" y="108" width="320" height="96" fill="none" stroke="#2F6BFF" />
      <text x="496" y="136" fill="#2F6BFF" {...mono}>[ REACTIVE NETWORK ]</text>
      <text x="496" y="176" fill="#fff" {...name}>TimelockSentinel</text>

      <rect x="928" y="108" width="320" height="96" fill="none" stroke="#242424" />
      <text x="948" y="136" fill="#8C8C8C" {...mono}>[ YOUR WALLET ]</text>
      <text x="948" y="176" fill="#fff" {...name}>Assets returned</text>

      <path d="M344 88 H410 V140 H474" fill="none" stroke="#8C8C8C" markerEnd="url(#arrow)" />
      <text x="356" y="78" fill="#8C8C8C" {...mono}>CALLSCHEDULED</text>

      <path d="M344 224 H410 V172 H474" fill="none" stroke="#8C8C8C" markerEnd="url(#arrow)" />
      <text x="356" y="246" fill="#8C8C8C" {...mono}>GUARDARMED</text>

      <path d="M636 204 V258 H346" fill="none" stroke="#2F6BFF" markerEnd="url(#arrow-b)" />
      <text x="470" y="278" fill="#2F6BFF" {...mono}>CALLBACK: EXIT( )</text>

      <path d="M184 272 V290 H1088 V206" fill="none" stroke="#8C8C8C" markerEnd="url(#arrow)" strokeDasharray="4 4" />
      <text x="820" y="282" fill="#8C8C8C" {...mono}>REDEEM TO OWNER</text>
    </svg>
  )
}

function ContractRow({ label, chain, value, where }: { label: string; chain: string; value?: string; where: 'base' | 'lasna' }) {
  return (
    <tr>
      <td>{label}</td>
      <td>
        <span className="tag">{chain}</span>
      </td>
      <td>
        <code>
          {value ? (
            <a href={`${explorer[where]}/address/${value}`} target="_blank" rel="noreferrer">
              {value} ↗
            </a>
          ) : (
            'Not deployed yet'
          )}
        </code>
      </td>
    </tr>
  )
}

export function HowItWorks() {
  return (
    <>
      <section className="hero solo">
        <div className="lead">
          <span className="tag">// How it works</span>
          <h1 className="display sm">
            Two events in,
            <br />
            <em>one callback out.</em>
          </h1>
          <p className="lede">
            A reactive contract listens to two event streams on Base Sepolia and answers with a single action. There is
            no server, bot or keeper anywhere in the loop.
          </p>
        </div>
      </section>

      <section className="diagram">
        <Flow />
      </section>

      <div className="cols three band">
        <div className="step">
          <span className="n">01 · Registry sync</span>
          <h3>Your guard is mirrored.</h3>
          <p>You arm a guard on ExitGuard. It emits an event; the sentinel reacts, stores your rule, and subscribes to that timelock. You never transact on Reactive Network.</p>
        </div>
        <div className="step">
          <span className="n">02 · Queue watching</span>
          <h3>Every queued call is decoded.</h3>
          <p>When governance schedules an operation, the sentinel reads its target and function selector on-chain and checks them against each guard on that timelock.</p>
        </div>
        <div className="step">
          <span className="n">03 · Exit</span>
          <h3>A match becomes a redemption.</h3>
          <p>The sentinel requests a callback. ExitGuard redeems your approved shares with you as owner and receiver. The timelock is still counting down.</p>
        </div>
      </div>

      <section>
        <Cap name="Contracts" />
        <div className="scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Chain</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              <ContractRow label="TimelockSentinel" chain="Reactive Lasna" value={addresses.sentinel} where="lasna" />
              <ContractRow label="ExitGuard" chain="Base Sepolia" value={addresses.exitGuard} where="base" />
              <ContractRow label="Demo timelock" chain="Base Sepolia" value={addresses.timelock} where="base" />
              <ContractRow label="Demo vault" chain="Base Sepolia" value={addresses.vault} where="base" />
              <ContractRow label="Demo token" chain="Base Sepolia" value={addresses.token} where="base" />
            </tbody>
          </table>
        </div>
      </section>

      <div className="cols two">
        <section>
          <Cap name="Trust model" />
          <ul className="list">
            <li>
              <span className="n">A</span>
              <span>
                <b>ExitGuard</b> can redeem your approved shares to you. It has no way to send them anywhere else and
                never holds funds.
              </span>
            </li>
            <li>
              <span className="n">B</span>
              <span>
                <b>The sentinel</b> can ask for an exit for a registered guard. It cannot choose who receives the assets.
              </span>
            </li>
            <li>
              <span className="n">C</span>
              <span>
                <b>Reactive Network</b> can deliver or withhold events. The worst case is a missed exit, which leaves you
                where you would be without the tool.
              </span>
            </li>
            <li>
              <span className="n">D</span>
              <span>
                <b>Callbacks are checked twice:</b> the caller must be Reactive's callback proxy, and the request must
                come from the authorised sentinel.
              </span>
            </li>
          </ul>
        </section>
        <section>
          <Cap name="Limits" />
          <ul className="list">
            <li>
              <span className="n">A</span>
              <span>
                <b>OpenZeppelin timelocks only.</b> Compound-style timelocks are not watched yet.
              </span>
            </li>
            <li>
              <span className="n">B</span>
              <span>
                <b>ERC-4626 vaults only.</b> If a vault limits withdrawals, the exit redeems what the vault allows.
              </span>
            </li>
            <li>
              <span className="n">C</span>
              <span>
                <b>50 guards per timelock</b> and 8 function selectors per guard.
              </span>
            </li>
            <li>
              <span className="n">D</span>
              <span>
                <b>Testnet and unaudited.</b> Built for the Reactive Omni Buildathon.
              </span>
            </li>
          </ul>
        </section>
      </div>
    </>
  )
}
