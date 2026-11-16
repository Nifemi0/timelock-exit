# Timelock Exit

Hackathon entry for the Reactive Omni Buildathon ("Set It and Forget It" track). Deadline 5 Dec 2026, 21:00 UTC+1. Plan and status: `docs/ROADMAP.md`.

## Commands

- Build: `forge build`
- Test: `forge test -vv`
- Single test: `forge test --match-test test_FullLoop -vvvv`
- Deploy: follow `docs/DEPLOYMENT.md` step by step; do not improvise the order

## Things that are easy to break

- **Event shapes are coupled across contracts.** `TimelockSentinel` hard-codes the topic hashes and decoding for `ExitGuard.GuardArmed` / `GuardDisarmed` and OpenZeppelin's `CallScheduled`. Changing an event's parameters, order or indexing means updating the constant, the `opCode` check and the decoder together, plus the tests.
- **Callback payloads must reserve the first argument** as an `address`. Reactive Network overwrites it with the reactive contract's address.
- **`ExitGuard.exit` must not revert on business conditions.** Failed callbacks are still billed. Report via `ExitSkipped`.
- **`subscribe` and `unsubscribe` arguments must match exactly**, or the unsubscribe silently does nothing.
- **Deployment order is fixed:** sentinel, then guard (its sender is immutable), then `setExitGuard`.
- A contract cannot inherit both `AbstractReactive` and `AbstractCallback`.

- **After queueing a change on the demo timelock, run `node web/scripts/snapshot.mjs` and commit `web/public/history.json`.** The app reads history from that snapshot plus a short live tail; an exit older than about 5.5 hours that is not in the snapshot will not show.

## Conventions

- Solidity 0.8.30, `evm_version = cancun`, named imports, custom errors (no revert strings).
- Parameters end with `_`; immutables are `UPPER_CASE`.
- `src/demo/` is demo scaffolding. Keep product logic out of it.
- This project targets **testnet** (Base Sepolia + Reactive Lasna). The buildathon tracks specify it.
- Never commit `.env`. Never ask for or print a private key.
- Docs state what is verified and what is not. Keep that honest when updating them.

## Reference

- Reactive docs: https://dev.reactive.network/
- Library in use: `lib/reactive-lib-omni` (the Omni version; the public demos repo still uses the legacy library and legacy patterns such as `vmOnly` and `emit Callback`, so do not copy from it)
