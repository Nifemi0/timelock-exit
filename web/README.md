# Timelock Exit: web app

The frontend for Timelock Exit. Vite, React and TypeScript, with wagmi and viem for the wallet and chain reads. Design rules are in [../docs/DESIGN.md](../docs/DESIGN.md).

## Pages

| Route | Page | What it shows |
|---|---|---|
| `/` | Landing | The pitch, a sample timeline, how it works in three steps |
| `/app` | Overview | Status, countdown, exit latency, the timelock window, queue, proof, guard |
| `/app/guards` | Guards | Arm, edit or disarm a guard; approve shares; mint and deposit test funds |
| `/app/activity` | Activity | Every exit with its three transactions, and the timelock's history |
| `/how-it-works` | How it works | Flow diagram, the three stages, contract addresses, trust model, limits |

Unknown routes show a 404 page.

## Run it

```bash
npm install
```

```bash
npm run dev
```

The dev server runs on http://localhost:5192.

## Demo data and live data

Until every contract address is set, the app runs on **sample data** and shows a `[ DEMO DATA ]` banner on every page. Transactions are not sent in demo mode.

To switch to live data after deploying (see [../docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)):

```bash
cp .env.example .env.local
```

Fill in the five `VITE_*` addresses and restart the dev server. The app then reads the timelock queue, your guard, your position and your exits from Base Sepolia every four seconds, and finds the reactive transaction for each exit on Reactive Lasna.

## Status

- Type check and production build pass.
- All five pages and the 404 page were checked in a browser at desktop and phone widths, in demo mode, with no console errors.
- **Live reads are verified** against the 15 Nov 2026 testnet deployment: Overview and Activity show the real exit, latency, countdown and all three proof links, with no console errors.
- **Sending transactions from the UI has not been tested yet** (arming, approving, depositing). The same calls worked from the command line.
- Add `?account=0x…` to any app URL to view an address read-only without a wallet.
- Only browser-extension wallets (such as MetaMask) are supported.

## Deploy

Live at **https://timelock-exit.vercel.app**. The Vercel project builds `web/` from `main` on every push; the five `VITE_*` addresses are set as project environment variables.

**Event history** comes from `public/history.json`, a snapshot of every relevant event, plus a live RPC scan of at most the last two 50,000-block chunks after it. Public RPCs cap log ranges (PublicNode: 50,000 blocks on Base Sepolia; Lasna: 30,000) and free indexers such as Blockscout rate-limit under load, so the app cannot rebuild history on every visit.

**After queueing a change on the timelock, regenerate the snapshot and commit it**, which redeploys the site:

```bash
node web/scripts/snapshot.mjs
```

### Other hosts

Any static host works. `vercel.json` rewrites every route to `index.html` so deep links load.

```bash
npm run build
```

Upload the `dist` folder, and set the same `VITE_*` variables in the host's environment settings.
