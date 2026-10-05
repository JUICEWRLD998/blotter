# The `bgc` surface, pinned

Recorded in Phase 0 (Spike D) from the CLI itself, not assumed. Phase 4's `guard` wraps this
syntax; when the CLI changes, re-run the commands below and update this file in the same commit.

Source: `npx -y @bitget-ai/bitget-agent-cli@3.0.0` (reports `using bitget-agent-sdk 3.1.0`).

## Invocation

```
bgc <tool> [--action <name>] [--<param> <value> ...] [global flags]
bgc discover [--domain <d> | --tool <t> [--action <a>] | --search <q>]
bgc raw --operationId <id> [--args '<json>']
```

## Global flags

| Flag | Effect |
|---|---|
| `--action <name>` | action for an action-routed verb |
| `--modules <list>` | modules to enable (default all) |
| `--surface intent\|full` | curated verbs (default) or the 1:1 generated operations |
| `--read-only` | block all writes (mutually exclusive with `--paper-trading`) |
| `--paper-trading` | route writes to the Bitget demo environment (needs demo credentials) |
| `--dry-run` | preview a write without sending it |
| `--confirm` | required for destructive (high-risk) writes |
| `--base-url <url>` | override API base (else `BITGET_API_BASE_URL`) |
| `--timeout <ms>` | per-request timeout (else `BITGET_TIMEOUT_MS`, default 15000) |
| `--pretty` | pretty-print JSON |

**Auth, from the environment only:** `BITGET_API_KEY`, `BITGET_SECRET_KEY`, `BITGET_PASSPHRASE`.
The CLI does not read `.env` — export before invoking (`set -a && . ./.env && set +a && bgc ...`).

## `order --action place` (this is what `guard` gates)

```
bgc order --action place --category <c> --symbol <s> --qty <q> --side <buy|sell> --orderType <limit|market> [...]
```

| | |
|---|---|
| operationId | `placeOrder` |
| endpoint | `POST /api/v3/trade/place-order` |
| auth | private |
| isWrite | true |
| **requiresConfirm** | **false** |

Required: `category` ∈ `SPOT` · `MARGIN` · `USDT-FUTURES` · `COIN-FUTURES` · `USDC-FUTURES`;
`symbol`; `qty`; `side` ∈ `buy` · `sell`; `orderType` ∈ `limit` · `market`.
Optional: `price` (required when `orderType=limit`), `timeInForce` ∈ `ioc`·`fok`·`gtc`·`post_only`,
`posSide` ∈ `long`·`short` (hedge mode), `clientOid`, `reduceOnly` ∈ `yes`·`no`,
`stpMode`, `tpTriggerBy`, `slTriggerBy`, `takeProfit`, `stopLoss`, `tpOrderType`, `slOrderType`.

### Two facts that shape Phase 4

1. **`leverage` is not a field on `place-order`.** Leverage is an account/position setting. A
   `{ maxLeverage }` rule must read the account's current setting and compare that — it cannot be
   evaluated from the order alone. See `DECISIONS.md` D8.
2. **`requiresConfirm: false`.** Nothing in `bgc` stops an agent from opening a position, so
   `blotter guard` is the actual gate, not a wrapper around one. See `DECISIONS.md` D9.

## Re-pin commands

```bash
npx -y @bitget-ai/bitget-agent-cli@3.0.0 --help
npx -y @bitget-ai/bitget-agent-cli@3.0.0 discover --tool order --action place
```
