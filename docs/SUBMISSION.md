# DoraHacks submission

Buildathon page: https://dorahacks.io/hackathon/reactive-omni-buildathon/detail

## Rules to stay inside

- Repository public and open-source at submission time
- Everything built during the event (5 Nov to 5 Dec 2026). Dependencies are fine; prior work as the submission is not
- On Base Sepolia, use timestamps and not block counts for timers (blocks are 200ms). This project has no block-count timers; the timelock delay is timestamp-based
- Prizes are denominated in USD and paid in REACT

## Required items

- [x] Public repository link
- [x] Deployed contract addresses
- [x] Transaction hashes showing the full loop, from origin event to callback
- [ ] Demo video under three minutes

## Track

**Set It and Forget It.** The brief asks for "a tool you'd actually keep running", "a clear personal purpose" and "a creative take on event-driven logic".

Do not enter "Every Second Counts": it requires latency measurements, and this project's value does not depend on speed.

## Fill in before submitting

| Field | Value |
|---|---|
| Repository | https://github.com/Nifemi0/timelock-exit |
| Demo video | |
| Live app | https://timelock-exit.vercel.app (proven exit: https://timelock-exit.vercel.app/app?account=0x5f5cE7c47f5382e4198870D1904650BF1b88232F) |
| TimelockSentinel (Reactive Lasna) | 0xa00b864fFBC6992195fFB649F5BC36a50fBD6D59 |
| ExitGuard (Base Sepolia) | 0x85703e534Fd619eE55484D59259F84fC0340Cd2a |
| Demo TimelockController (Base Sepolia) | 0x65503cE4DeC92399b0d1dc08e2b53fc47c03901e |
| DemoVault (Base Sepolia) | 0x8687F31ebF4e4CCf7d0c1D6082eE7F34D91BB5D2 |
| Tx 1: guard armed (origin, Base Sepolia) | 0x88c0686c360505948693de77c32cbffb5351023a4a198b9334feb6aeae3d04dd |
| Tx 2: guard mirrored (reactive, Lasna) | 0xabb7559927a43e48872701fa0ea16403785480819523b5b5b69b31bebe973e46 |
| Tx 3: change queued (origin, Base Sepolia) | 0xc8346cfae930df95651e1e51538b19c79c8ab25325c69547fec2eef079b11a32 |
| Tx 4: exit requested (reactive, Lasna) | 0xe88744158aa14cdc8d08737cc25b18425a029d4ff08b907ea80b21a331607a79 |
| Tx 5: exit delivered (callback, Base Sepolia) | 0x1680900f6cec81d1493cbc4f9f62eea7fddbc1871b896c016f5dfa82b8359869 |
| Measured latency | About 1 s from queueing (block 59289096) to exit (block 59289104), with a 300 s timelock delay |

## Draft submission text

**Name:** Timelock Exit

**One line:** Leave before the upgrade lands: a reactive contract reads a protocol's timelock queue for you and redeems your deposit the moment a change you care about is queued.

**Description:**

Protocols put admin changes behind a timelock so depositors have time to leave. That only protects people who are watching the queue, and almost nobody is.

Timelock Exit lets a depositor leave one standing instruction: "if a change like this is queued on this timelock, redeem my vault shares back to me." A reactive contract on Reactive Network subscribes to `CallScheduled` on the protocol's unmodified OpenZeppelin `TimelockController`, decodes the queued call, matches it against each depositor's rule, and calls back to redeem their ERC-4626 shares, long before the delay expires.

Reactive does two jobs. It mirrors the guard registry from destination-chain events, so users only transact on the chain their funds are on and the contract subscribes to and unsubscribes from timelocks at runtime. And it turns a governance event into an on-chain action with no bot or server.

The destination contract never holds funds: it can only redeem a user's approved shares to that same user.

**How it maps to the judging criteria:**

- *Execution:* full loop on Base Sepolia and Lasna; hashes above.
- *Integration:* the reactive contract maintains state, manages dynamic subscriptions, decodes calldata and applies per-user rules. Remove it and nothing works.
- *Usefulness:* replaces monitoring that professional teams run by hand today.
- *Craft:* 16 tests including the end-to-end loop, documented trust model and limitations, step-by-step deployment guide.

## Before you click submit

- [ ] Every address and hash in the table opens on its explorer
- [ ] README "Deployed addresses" matches the table
- [ ] Video is under 3:00 and publicly viewable without login
- [ ] `.env` is not in the repository history
- [ ] Fresh clone builds and tests pass
