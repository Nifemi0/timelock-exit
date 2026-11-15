# Roadmap

Deadline: **5 December 2026, 21:00 (UTC+1)**. Plan to submit on 4 December and keep the last day as buffer.

## Where things stand (14 Nov)

- [x] Idea chosen and checked against the 23 existing entries and Reactive's 10 official demos
- [x] Contracts written: `ExitGuard`, `TimelockSentinel`, demo vault and token
- [x] Test suite written (16 tests, full loop included)
- [x] Everything compiles with solc 0.8.30
- [x] Tests run and passing: 16 of 16 (Foundry 1.9.0)
- [x] Deployed to testnet and full loop proven (15 Nov): exit about 1 s after queueing
- [x] Frontend built: five pages in `web/`, running on demo data
- [x] Frontend connected to deployed contracts (read side checked; wallet transactions from the UI not yet tested)
- [ ] Demo video
- [ ] Registered and submitted on DoraHacks

## Phase 1: make it real (14 to 20 Nov)

- [x] Install Foundry, run `forge test -vv`, fix anything that fails
- [ ] Register on DoraHacks
- [ ] Create the public GitHub repo and push
- [x] Get Base Sepolia ETH and lREACT
- [x] Deploy and run the full loop once, following [DEPLOYMENT.md](DEPLOYMENT.md)
- [x] Record all addresses and the five transaction hashes in the README
- [x] Resolve the open items in [ARCHITECTURE.md](ARCHITECTURE.md#not-yet-verified-on-a-live-network) (EVM version, gas limit, proxy address, subscribing from `react()`)

Execution is the gate criterion: entries without on-chain reactive transactions and callbacks are not scored further. Nothing else matters until this phase is done.

## Phase 2: frontend (21 to 27 Nov)

Direction in [DESIGN.md](DESIGN.md). Built ahead of schedule; see [web/README.md](../web/README.md).

- [x] Landing, Overview, Guards, Activity and How it works pages
- [x] Demo mode with sample data, checked at desktop and phone widths
- [ ] Fill in `web/.env.local` after deployment and test the live-data path end to end
- [ ] Deploy as a static site

## Phase 3: depth (28 to 30 Nov)

Pick based on time left. In priority order:

- [ ] Selector presets in the UI (upgrade, ownership transfer, role grant, fee change)
- [ ] Human-readable decoding for common calldata
- [ ] Per-user gas tank so the operator does not fund every callback
- [ ] Compound-style timelock support (`QueueTransaction`)

## Phase 4: submission (1 to 4 Dec)

- [ ] Record the demo video (under 3 minutes) from [DEMO_SCRIPT.md](DEMO_SCRIPT.md)
- [ ] Final README pass: addresses, hashes, screenshots
- [ ] Fill in and submit [SUBMISSION.md](SUBMISSION.md) on DoraHacks
- [ ] Fresh-clone check: `git clone --recurse-submodules`, `forge build`, `forge test` on a clean machine

## After the buildathon

- Attestation mirror (the second idea): cross-chain EAS attestations with revocation
- Mainnet deployment against real vaults and timelocks
- Batched callbacks to lift the 50-guards-per-timelock cap
