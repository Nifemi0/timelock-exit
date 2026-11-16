# Timelock Exit

**Leave before the upgrade lands.** Timelock Exit watches a protocol's governance timelock for you. The moment a change you care about is queued, it redeems your deposit back to your wallet, before the delay expires and the change takes effect.

**Live app: https://timelock-exit.vercel.app** · see the proven exit at [/app?account=0x5f5c…232F](https://timelock-exit.vercel.app/app?account=0x5f5cE7c47f5382e4198870D1904650BF1b88232F)

Built for the [Reactive Omni Buildathon](https://dorahacks.io/hackathon/reactive-omni-buildathon/detail), "Set It and Forget It" track.

> **Status: deployed to testnet and proven end to end on 15 Nov 2026.** A queued 99% exit-fee change was matched on Reactive Lasna and the depositor's 1,000 dUSD was redeemed on Base Sepolia **about 1 second after queueing**, with nearly 5 minutes of the timelock delay still left. 16 of 16 local tests pass (Foundry 1.9.0, solc 0.8.30). See [docs/ROADMAP.md](docs/ROADMAP.md).

## The problem

Most DeFi protocols put admin changes behind a timelock: a fee change, an upgrade or an ownership transfer is queued on-chain and can only execute after a delay. That delay exists so depositors can leave if they disagree.

It only protects people who are watching. The queue is a public notice that almost nobody reads. Teams that take this seriously run their own monitoring infrastructure and scan `CallScheduled` logs by hand. Everyone else finds out after the change has executed.

## What Timelock Exit does

1. You deposit into an ERC-4626 vault as usual.
2. You arm a guard: which timelock to watch and which queued changes should trigger an exit.
3. You approve your vault shares to `ExitGuard`.
4. You close the tab.

When a matching operation is queued, a reactive contract sees the `CallScheduled` event and calls back to redeem your shares, straight to your wallet. No bot, no server, no alert you have to act on.

## How it works

```
        Base Sepolia                         Reactive Lasna                    Base Sepolia
 ┌───────────────────────┐            ┌──────────────────────┐          ┌────────────────────┐
 │ TimelockController    │ CallSched- │  TimelockSentinel    │ callback │  ExitGuard         │
 │ (the protocol's own)  │ ─uled────▶ │  matches the queued  │ ───────▶ │  redeems your      │
 └───────────────────────┘            │  call against rules  │          │  shares to you     │
 ┌───────────────────────┐ GuardArmed │                      │          └────────────────────┘
 │ ExitGuard             │ ─────────▶ │  mirrors the guard   │
 │ (you arm a guard)     │            │  registry from logs  │
 └───────────────────────┘            └──────────────────────┘
```

| Contract | Chain | Role |
|---|---|---|
| [`ExitGuard`](src/ExitGuard.sol) | Base Sepolia | Holds guards, receives the callback, redeems shares to their owner. Never holds user funds. |
| [`TimelockSentinel`](src/TimelockSentinel.sol) | Reactive Lasna | Mirrors guards from `ExitGuard` events, subscribes to each watched timelock, requests exits. |
| [`DemoVault`](src/demo/DemoVault.sol), [`MockToken`](src/demo/MockToken.sol) | Base Sepolia | Demo scaffolding: a vault whose timelock can raise the exit fee to 99%. |

The timelock itself is an unmodified OpenZeppelin `TimelockController`. Timelock Exit needs no cooperation from the protocol it watches.

Reactive Network does two jobs here, and both are essential:

- **Registry sync.** Users only ever transact on the chain their money is on. The sentinel learns about guards by reacting to `GuardArmed` / `GuardDisarmed` events, and subscribes to or unsubscribes from timelocks at runtime as guards come and go.
- **Queue watching.** `CallScheduled` is decoded on-chain, matched against each guard's rule, and turned into a callback.

More detail in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Exit rules

A guard exits when either condition holds:

- **Any call to the vault.** The queued operation targets the vault contract itself.
- **Selector watch list.** The queued operation calls one of up to 8 function selectors, on any target. This catches changes routed through another contract, such as an upgrade via a `ProxyAdmin` or an ownership transfer.

## Quick start

Requires [Foundry](https://book.getfoundry.sh/getting-started/installation).

```bash
git clone --recurse-submodules https://github.com/Nifemi0/timelock-exit
```

```bash
forge build
```

```bash
forge test -vv
```

To deploy and run the full loop on testnet, follow [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Repository layout

```
src/
  ExitGuard.sol           destination-chain callback contract
  TimelockSentinel.sol    reactive contract
  demo/                   demo vault and faucet token
test/
  TimelockExit.t.sol      end-to-end tests; the test plays Reactive Network
  mocks/MockSystem.sol    test double for the Reactive system contract
script/
  DeployDemoStack.s.sol   deploys token + timelock + vault for the demo
web/                      frontend: five pages, see web/README.md
docs/
  ARCHITECTURE.md         design, trust model, limitations
  DEPLOYMENT.md           step-by-step testnet deployment
  DEMO_SCRIPT.md          shot list for the 3-minute video
  DESIGN.md               frontend design direction
  ROADMAP.md              plan to the 5 Dec deadline
  SUBMISSION.md           DoraHacks checklist and submission text
```

## Deployed addresses

| Contract | Chain | Address |
|---|---|---|
| TimelockSentinel | Reactive Lasna (5318007) | [`0xa00b864fFBC6992195fFB649F5BC36a50fBD6D59`](https://lasna.reactscan.net/address/0xa00b864fFBC6992195fFB649F5BC36a50fBD6D59) |
| ExitGuard | Base Sepolia (84532) | [`0x85703e534Fd619eE55484D59259F84fC0340Cd2a`](https://sepolia.basescan.org/address/0x85703e534Fd619eE55484D59259F84fC0340Cd2a) |
| Demo TimelockController (300 s delay) | Base Sepolia | [`0x65503cE4DeC92399b0d1dc08e2b53fc47c03901e`](https://sepolia.basescan.org/address/0x65503cE4DeC92399b0d1dc08e2b53fc47c03901e) |
| DemoVault | Base Sepolia | [`0x8687F31ebF4e4CCf7d0c1D6082eE7F34D91BB5D2`](https://sepolia.basescan.org/address/0x8687F31ebF4e4CCf7d0c1D6082eE7F34D91BB5D2) |
| MockToken (dUSD) | Base Sepolia | [`0x035570BDDb0FAc4cB065e6900eA800AAE5174a7A`](https://sepolia.basescan.org/address/0x035570BDDb0FAc4cB065e6900eA800AAE5174a7A) |

### The full loop, on-chain

| # | Step | Chain | Transaction |
|---|---|---|---|
| 1 | Guard armed (`GuardArmed`) | Base Sepolia | [`0x88c0…04dd`](https://sepolia.basescan.org/tx/0x88c0686c360505948693de77c32cbffb5351023a4a198b9334feb6aeae3d04dd) |
| 2 | Guard mirrored, timelock subscribed (`GuardSynced`, `TimelockWatched`) | Reactive Lasna | [`0xabb7…3e46`](https://lasna.reactscan.net/tx/0xabb7559927a43e48872701fa0ea16403785480819523b5b5b69b31bebe973e46) |
| 3 | `setExitFee(9900)` queued (`CallScheduled`) | Base Sepolia | [`0xc834…1a32`](https://sepolia.basescan.org/tx/0xc8346cfae930df95651e1e51538b19c79c8ab25325c69547fec2eef079b11a32) |
| 4 | Rule matched, exit requested (`ExitRequested`) | Reactive Lasna | [`0xe887…7a79`](https://lasna.reactscan.net/tx/0xe88744158aa14cdc8d08737cc25b18425a029d4ff08b907ea80b21a331607a79) |
| 5 | Shares redeemed to the depositor (`Exited`) | Base Sepolia | [`0x1680…9869`](https://sepolia.basescan.org/tx/0x1680900f6cec81d1493cbc4f9f62eea7fddbc1871b896c016f5dfa82b8359869) |

**Second run, through the hosted app (16 Nov 2026).** A separate MetaMask wallet minted, deposited, approved and armed a guard using only the app's buttons. A queued `setExitFee(9800)` ([`0x9943…6dde`](https://sepolia.basescan.org/tx/0x99431590f4254ad977a4729729715dcc75880191348b41bb15c8dea062dc6dde)) was matched on Lasna ([`0x26ac…e3ca`](https://lasna.reactscan.net/tx/0x26acefc4124270cc0bf78e66c49f1630fc83d28f671171f6e0ec0504e191e3ca)) and the 1,000 dUSD were redeemed about 2 seconds later. The first wallet's guard fired on the same change and emitted `ExitSkipped` (nothing left to redeem), as designed.

Step 3 is in block 59289096 and step 5 in block 59289104: 8 blocks, about 1 second by block timestamp. The change could not execute until 300 seconds after step 3.

The live app shows this position read-only at [timelock-exit.vercel.app/app?account=0x5f5c…232F](https://timelock-exit.vercel.app/app?account=0x5f5cE7c47f5382e4198870D1904650BF1b88232F).

## Known limitations

- OpenZeppelin `TimelockController` only. Compound-style timelocks (`QueueTransaction`) are not watched yet.
- ERC-4626 vaults only, and only for the liquid part of a position: if the vault has a withdrawal queue or a redeem limit, the exit redeems what the vault allows.
- At most 50 guards per timelock and 8 selectors per guard.
- Callback delivery is paid from `ExitGuard`'s own balance, funded by the operator. Per-user gas accounting is on the roadmap.
- Unaudited hackathon code. Testnet only.

## License

[MIT](LICENSE). Dependencies keep their own licenses.
