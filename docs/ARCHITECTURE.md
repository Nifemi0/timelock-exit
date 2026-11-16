# Architecture

## Flow

### Arming a guard

1. The depositor calls `ExitGuard.arm(vault, timelock, anyCallToVault, selectors)` on Base Sepolia and approves their vault shares to `ExitGuard`.
2. `ExitGuard` stores the guard and emits `GuardArmed(user, vault, timelock, anyCallToVault, selectors)`.
3. `TimelockSentinel` is subscribed to that event. Reactive Network delivers it to `react()`, which mirrors the guard into its own storage.
4. If this is the first guard for that timelock, the sentinel subscribes to `CallScheduled` on it.

The depositor never touches Reactive Network and never needs REACT.

### Exiting

1. Governance queues an operation: `TimelockController.schedule(...)` emits `CallScheduled(id, index, target, value, data, predecessor, delay)`.
2. Reactive Network delivers the log to `TimelockSentinel.react()`.
3. The sentinel decodes `target` and the first four bytes of `data` (the function selector) and checks every guard on that timelock.
4. For each match it calls `SYSTEM.requestCallbackV_1_0` with a payload for `ExitGuard.exit(sentinel, user, vault, operationId)`.
5. The callback proxy on Base Sepolia calls `ExitGuard.exit`. It redeems `min(balance, allowance, maxRedeem)` shares with the user as both owner and receiver.
6. `ExitGuard` emits `Exited` (or `ExitSkipped` with a reason).

The timelock delay is hours or days; the loop above takes seconds. The depositor is out long before `execute` becomes callable.

## Design decisions

**The registry lives on Reactive, synced by events.** The alternative was to have users register directly on the reactive contract, which would force every depositor to bridge funds to another chain before they could protect a position. Mirroring from `GuardArmed` logs keeps the whole user journey on one chain, and it makes the reactive contract do real work: it maintains state and manages its own subscriptions at runtime.

**One shared deployment, not one contract pair per user.** `ExitGuard`'s authorized sender is immutable, so a single sentinel and a single guard serve everyone. A frontend only needs two addresses.

**`exit()` never reverts on a business condition.** A reverting callback is still billed. A disarmed guard, a missing allowance or a failing `redeem` each produce an `ExitSkipped` event and return.

**One exit per depositor per operation.** `scheduleBatch` emits one `CallScheduled` per call under a single operation id. The sentinel records `(operationId, guard)` so a batch with several matching calls requests one callback, not several.

**Dynamic subscriptions.** A timelock is subscribed when its first guard arrives and unsubscribed when its last guard leaves, so the sentinel never pays for events nobody is waiting on.

## Trust model

| Party | What it can do | What it cannot do |
|---|---|---|
| `ExitGuard` | Redeem a user's approved shares to that same user | Send shares or assets anywhere else; it has no transfer path and never holds user funds |
| `TimelockSentinel` | Request `exit` for a registered guard | Choose a receiver; `ExitGuard` always pays the share owner |
| Sentinel owner | Call `setExitGuard` once | Change it afterwards, trigger exits, or edit guards |
| Reactive Network | Deliver or withhold logs and callbacks | Redirect funds. The worst case is a missed exit, which leaves the user where they would be without the tool |
| Timelock proposers | Queue an operation that triggers exits | Anything beyond that; an unwanted exit returns the user's own assets to them |

`ExitGuard.exit` is guarded twice: `onlyServiceProvider` (the caller is the callback proxy) and `onlyCallbackSender` (the request came from the authorized sentinel). `TimelockSentinel.react` is guarded by `onlySystem`.

The share allowance is the user's exposure. If `ExitGuard` had a bug that let an attacker reach `exit`, the outcome would still be a redemption to the user, not a theft, because owner and receiver are both hard-wired to `user_`.

## Limitations

- **Timelock type.** Only OpenZeppelin `TimelockController` (`CallScheduled`). Compound-style `QueueTransaction` needs a second topic and decoder.
- **Vault type.** ERC-4626 only. Vaults with withdrawal queues, cooldowns or per-block redeem limits will exit only the liquid portion.
- **Capacity.** 50 guards per timelock, so a single `CallScheduled` cannot exhaust `react()` gas. Scaling past that needs batched callbacks or paging.
- **Funding.** `TimelockSentinel` pays for reactive transactions in REACT; `ExitGuard` pays for callbacks in the destination chain's native token. Both are operator-funded today. If either runs dry, delivery stops until `coverDebt()` is called with funds in place.
- **Exit is a taxable, irreversible action.** The tool exits on a rule match; it does not judge whether the change is actually harmful. Narrow selector rules reduce false exits.
- **Selector matching is exact.** A hostile change wrapped inside a multicall or a generic `execute(bytes)` is only caught by the "any call to the vault" rule or by listing the wrapper's selector.

## Not yet verified on a live network

Checked on 15 Nov 2026 without sending any transaction:

- **Lasna accepts `cancun` bytecode.** A dry-run deployment of `TimelockSentinel` (which uses `PUSH0` and `MCOPY`) estimated at about 1.55M gas on Lasna.
- **The Base Sepolia callback proxy** at the address in `.env.example` has code, as do the Lasna system contract and the Base Sepolia lREACT faucet.
- **Callback gas.** `ExitGuard.exit` used at most about 96,000 gas in the test suite, well inside the 600,000 limit. The proxy's own overhead is not measured yet.

Confirmed on the live network the same day (transactions in the README):

- **Subscribing from inside `react()` works.** The sentinel mirrored a guard and subscribed to the timelock about 3 seconds after `arm()`.
- **End-to-end latency** from `CallScheduled` to `Exited` was about 1 second (8 Base Sepolia blocks).

Also confirmed live on 16 Nov: two depositors on one timelock, and `ExitSkipped` when a guard fires with nothing left to redeem. Not yet exercised live: `disarm()` and the unsubscribe path (covered by local tests).

**RPC note.** The official Base Sepolia endpoint (`sepolia.base.org`) limits `eth_getLogs` to 200 blocks. The web app defaults to PublicNode, which allowed 50,000-block ranges when tested.
