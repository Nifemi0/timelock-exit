# Frontend design direction

The app itself is in [web/](../web/README.md) and implements this direction across five pages. [design/direction.html](../design/direction.html) is the original single-screen mockup, kept for reference.

## Reference

The look follows the buildathon host's own site, [reactive.network](https://reactive.network), and [morpho.org](https://morpho.org): pure black, visible thin grid lines, large light-weight type, small monospace labels in brackets, and no cards.

Two earlier directions were rejected and should not be revisited:

- A newspaper "public notice" theme: wrong concept, flat, too much reading, not credible as a web3 product.
- A dark dashboard with a mint accent, soft glow, rounded gradient cards and pill badges: it looked like a generated template.

## Rules

These are what separate this direction from the rejected dashboard. Treat them as hard constraints.

1. **No cards.** The page is one frame divided by 1px lines into cells, like a table or a blueprint. Content sits in cells, never in floating rounded boxes.
2. **Square corners everywhere.** No border radius on anything, including buttons, markers and status dots.
3. **No shadows, no glows, no gradients as decoration.** The only gradient is the fade that keeps the hero headline readable over the grid.
4. **Pure black and pure white.** Background `#000000`, text `#FFFFFF`. Greys are for secondary text and lines only.
5. **Two colours, used sparingly.** Blue is you and your guard. Orange-red is the change taking effect. Nothing else is coloured, and there is no green.
6. **Large light type.** The headline is weight 300 and very big. Hierarchy comes from size and weight, not from boxes or colour.
7. **Labels are monospace, uppercase and small**, prefixed `//` for section names and wrapped in `[ ]` for data labels and states.
8. **Text over icons.** States are written out (`[x]`, "Guard fired", "Armed"); there are no decorative icons.

## Visual system

### Colour

| Role | Value | Use |
|---|---|---|
| Black | `#000000` | Page |
| White | `#FFFFFF` | Text, primary button fill, elapsed time on the rail |
| Grey | `#8C8C8C` | Labels and secondary text |
| Dim | `#555555` | Inactive rows, timestamps |
| Line | `#242424` | Every divider and the background grid |
| Blue | `#2F6BFF` | Your exit, armed state, "Guard fired", the clear-by bracket |
| Alarm | `#FF4A1C` | The moment the change executes, and nothing else |

### Type

| Role | Typeface | Notes |
|---|---|---|
| Display and body | **Geist** | 300 for the headline, 400 elsewhere. Tight negative tracking at large sizes |
| Labels and data | **Geist Mono** | 11px uppercase labels with wide tracking; larger sizes for countdowns and figures |

Both are free on Google Fonts.

### Layout

- A single frame, max 1320px, with 1px side borders.
- Header: one row of cells (brand, menu, network, wallet).
- Hero: headline cell on the left over an 88px background grid; two stacked figure cells on the right.
- Rail: the full-width timelock timeline.
- Three columns divided by lines: queue, proof, guard.
- On narrow screens the columns stack, and the rail scrolls sideways.

### The logo mark

A square frame with an opening on one side and a blue arrow passing out through it. Square, like everything else, and custom.

## The rail

The timeline is drawn like a measuring instrument, not a progress bar:

- A baseline with ruler ticks across the full delay.
- A hollow square where the change was queued.
- A solid blue square where your exit landed, labelled `[ YOU EXITED +3S ]`.
- A white segment for time elapsed, ending in a white square at `NOW`.
- An orange-red line where the change executes, labelled with what it does.
- A blue bracket spanning exit to execution: `CLEAR BY 04 MIN 57 SEC`.

States: empty rail reading `NOTHING QUEUED`; exit in flight (blue square blinks); exited (as above); executed (rail fully white, alarm line passed).

## Pages

1. **Landing** (`/`). The pitch, a sample rail, three steps, why it matters and what it will not do.
2. **Overview** (`/app`). Headline status, countdown and exit latency, the rail, then queue, proof and guard.
3. **Guards** (`/app/guards`). Arm or edit a guard as a sentence built from tick-box rules; approve shares; test funds.
4. **Activity** (`/app/activity`). Every exit with its three transactions, and the timelock's full history.
5. **How it works** (`/how-it-works`). Flow diagram, the three stages, contract addresses, trust model and limits.

## Motion

- The countdown ticks and the `NOW` square advances.
- When an exit confirms, the blue square appears with a single hard blink. No easing, no bounce, no fades longer than 100ms.
- Hover: a row's background goes to `#0D0D0D`; links gain an underline.

## Voice

Short and declarative. "Out before it landed." "Guard fired." "Not in rules." "Armed." No exclamation marks, no slang.

## Build notes

- Vite, React and TypeScript, with viem and wagmi for wallet and contract calls.
- The rail is plain SVG driven by three timestamps: queued, exited, executes.
- Read the queue from `CallScheduled`, `CallExecuted` and `Cancelled` logs on the timelock; guards from `ExitGuard.guardOf`; exits from `ExitGuard`'s `Exited` events.
- Dark only. Deploy as a static site.
