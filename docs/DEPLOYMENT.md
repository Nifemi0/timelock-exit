# Deployment (testnet)

This runs the whole loop on **Base Sepolia** and **Reactive Lasna**. None of these steps have been executed yet; record every address and transaction hash as you go, because the buildathon submission needs them.

Use a throwaway testnet wallet. Never put a key that holds real funds in `.env`.

## 0. Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- A wallet with about 0.03 Base Sepolia ETH (any public Base Sepolia faucet). On 15 Nov 2026 Base Sepolia gas was 0.006 gwei, so the Base side costs well under 0.001 ETH; most of it becomes lREACT. Lasna gas was 100 gwei: deploying the sentinel costs about 0.16 lREACT, and each reactive transaction costs a few hundredths

Create your env file and load it:

```bash
cp .env.example .env
```

```bash
source .env
```

```bash
export ME=$(cast wallet address --private-key $PRIVATE_KEY)
```

## 1. Get lREACT

Send Base Sepolia ETH to Reactive's faucet contract. The rate is 1 ETH to 100 lREACT. **Never send more than 5 ETH in one transaction; the excess is lost.**

```bash
cast send 0x2afaFD298b23b62760711756088F75B7409f5967 "request(address)" $ME --value 0.05ether --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

Check it arrived:

```bash
cast balance $ME --rpc-url $REACTIVE_RPC --ether
```

## 2. Deploy TimelockSentinel (Reactive Lasna)

The sentinel goes first, because `ExitGuard` stores its address immutably.

```bash
forge create --broadcast --rpc-url $REACTIVE_RPC --private-key $PRIVATE_KEY src/TimelockSentinel.sol:TimelockSentinel --value 1ether --constructor-args $DESTINATION_CHAIN_ID
```

Save `Deployed to` as `SENTINEL_ADDR` in `.env`, then `source .env` again.

## 3. Deploy ExitGuard (Base Sepolia)

The `--value` funds callback delivery.

```bash
forge create --broadcast --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY src/ExitGuard.sol:ExitGuard --value 0.01ether --constructor-args $CALLBACK_PROXY_ADDR $SENTINEL_ADDR
```

Save `Deployed to` as `EXIT_GUARD_ADDR`. A wrong `SENTINEL_ADDR` here cannot be fixed; it means redeploying.

## 4. Link them

```bash
cast send $SENTINEL_ADDR "setExitGuard(address)" $EXIT_GUARD_ADDR --rpc-url $REACTIVE_RPC --private-key $PRIVATE_KEY
```

The sentinel is now subscribed to `GuardArmed` and `GuardDisarmed`.

## 5. Deploy the demo protocol (Base Sepolia)

A faucet token, a `TimelockController` with a `DEMO_TIMELOCK_DELAY`-second delay, and a vault owned by that timelock.

```bash
forge script script/DeployDemoStack.s.sol --rpc-url $BASE_SEPOLIA_RPC --broadcast
```

Copy the three printed lines into `.env` and `source .env`.

## 6. Become a depositor

```bash
cast send $DEMO_TOKEN_ADDR "mint(address,uint256)" $ME 1000ether --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

```bash
cast send $DEMO_TOKEN_ADDR "approve(address,uint256)" $DEMO_VAULT_ADDR 1000ether --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

```bash
cast send $DEMO_VAULT_ADDR "deposit(uint256,address)" 1000ether $ME --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

## 7. Arm the guard

Approve your vault shares to `ExitGuard`:

```bash
cast send $DEMO_VAULT_ADDR "approve(address,uint256)" $EXIT_GUARD_ADDR $(cast max-uint) --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

Arm with the "any call to the vault" rule:

```bash
cast send $EXIT_GUARD_ADDR "arm(address,address,bool,bytes4[])" $DEMO_VAULT_ADDR $DEMO_TIMELOCK_ADDR true "[]" --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

**Save this transaction hash** (origin event for registry sync). After a few seconds, confirm the sentinel mirrored it:

```bash
cast call $SENTINEL_ADDR "isGuarded(address,address,address)(bool)" $DEMO_TIMELOCK_ADDR $ME $DEMO_VAULT_ADDR --rpc-url $REACTIVE_RPC
```

```bash
cast call $SENTINEL_ADDR "watching(address)(bool)" $DEMO_TIMELOCK_ADDR --rpc-url $REACTIVE_RPC
```

Both should print `true`.

## 8. Queue the hostile change

Schedule `setExitFee(9900)`, a 99% exit fee, on the timelock:

```bash
cast send $DEMO_TIMELOCK_ADDR "schedule(address,uint256,bytes,bytes32,bytes32,uint256)" $DEMO_VAULT_ADDR 0 $(cast calldata "setExitFee(uint256)" 9900) $(cast hash-zero) $(cast hash-zero) $DEMO_TIMELOCK_DELAY --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

**Save this transaction hash** (origin event for the exit).

## 9. Watch the exit

Within a few seconds your shares should be gone and your tokens back:

```bash
cast call $DEMO_VAULT_ADDR "balanceOf(address)(uint256)" $ME --rpc-url $BASE_SEPOLIA_RPC
```

```bash
cast call $DEMO_TOKEN_ADDR "balanceOf(address)(uint256)" $ME --rpc-url $BASE_SEPOLIA_RPC
```

Find and **save** the two remaining hashes:

- The reactive transaction on [Lasna Reactscan](https://lasna.reactscan.net/): open `SENTINEL_ADDR` and look for the `ExitRequested` event.
- The callback on [Base Sepolia Basescan](https://sepolia.basescan.org/): open `EXIT_GUARD_ADDR` and look for the `Exited` event.

## 10. Prove the point (optional, good for the video)

After the delay, execute the change and show what an unguarded depositor now pays:

```bash
cast send $DEMO_TIMELOCK_ADDR "execute(address,uint256,bytes,bytes32,bytes32)" $DEMO_VAULT_ADDR 0 $(cast calldata "setExitFee(uint256)" 9900) $(cast hash-zero) $(cast hash-zero) --rpc-url $BASE_SEPOLIA_RPC --private-key $PRIVATE_KEY
```

```bash
cast call $DEMO_VAULT_ADDR "exitFeeBps()(uint256)" --rpc-url $BASE_SEPOLIA_RPC
```

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| `isGuarded` stays `false` | Sentinel is out of lREACT or in debt. Fund it, then `cast send $SENTINEL_ADDR "coverDebt()"`. |
| `ExitRequested` appears on Lasna but nothing happens on Base | `ExitGuard` has no ETH or is in debt. Send it ETH, then call `coverDebt()` on it. |
| Callback arrives but emits `ExitSkipped` | Reason `1` (NothingToRedeem): shares not approved to `ExitGuard`. Reason `0`: guard not armed. |
| Deploy to Lasna fails with an invalid opcode | Lasna may not support `cancun`. Set `evm_version = "paris"` in `foundry.toml` and rebuild. |
| `forge create` rejects `--broadcast` | Older Foundry. Remove the flag. |
