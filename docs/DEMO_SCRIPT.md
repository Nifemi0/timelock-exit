# Demo video script

Hard limit: **under 3 minutes**. Target 2:40. Judges score execution first, so the on-chain loop gets the most screen time.

Before recording: deploy with `DEMO_TIMELOCK_DELAY=300`, deposit, and have three browser tabs ready (the app, Lasna Reactscan on the sentinel, Base Sepolia Basescan on ExitGuard).

| Time | On screen | Say |
|---|---|---|
| 0:00 to 0:20 | Title card, then a real timelock queue on a block explorer | "Protocols put admin changes behind a timelock so you have time to leave. But the queue is a public notice nobody reads. If you're not watching, the delay protects you from nothing." |
| 0:20 to 0:40 | The app: a deposit of 1,000 dUSD in the demo vault | "This is Timelock Exit. I have a thousand dollars in a vault. Its owner is a standard OpenZeppelin timelock." |
| 0:40 to 1:05 | Arm a guard: pick the rule, approve shares, confirm | "I give it one standing instruction: if any change to this vault is queued, redeem my shares back to me. That's the only transaction I ever send, and it's on the chain my money is already on." |
| 1:05 to 1:20 | Reactscan: the `GuardSynced` and `TimelockWatched` events | "A reactive contract on Reactive Network picked that up from the event log and subscribed itself to the timelock. No server, no bot." |
| 1:20 to 1:45 | Terminal or app: governance queues `setExitFee(9900)` | "Now governance queues a change: a ninety-nine percent exit fee, effective in five minutes." |
| 1:45 to 2:15 | Split view: Reactscan `ExitRequested`, then Basescan `Exited`; the app shows the balance back in the wallet and the countdown still running | "Seconds later the sentinel matched it against my rule and called back. My shares are redeemed, the full thousand is in my wallet, and the change hasn't executed yet." |
| 2:15 to 2:30 | Execute the change after the delay; a second, unguarded wallet redeems and receives 1% | "Here's the depositor who wasn't watching. Same vault, five minutes later: they keep one percent." |
| 2:30 to 2:40 | Receipt screen with the three transaction hashes, then repo URL | "Origin event, reactive transaction, callback: all on-chain, all in the repo. Timelock Exit. Leave before the upgrade lands." |

## Recording notes

- Show transaction hashes on screen long enough to read; they are part of the submission.
- Keep the countdown visible during the exit. It is the proof that the exit beat the change.
- If the loop takes longer than a few seconds on the day, cut the wait; do not speed up the footage of the explorers.
- No background music over the narration.
