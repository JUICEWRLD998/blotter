# Blotter — decision log

One entry per decision that a future reader would otherwise have to re-derive.
Newest last. Each says what was chosen, why, and what it costs.

---

## D1 — Resolve `bitget.com` with a project-local DoH preload (not a system DNS change)

**Date:** 2026-10-05 · **Phase:** 0.2

**Measured.** On this machine the system resolver is `10.116.120.8` and it fails:
`api.bitget.com` and `agent.bitget.com` → `ENOTFOUND`, while `github.com` and
`api.hyperliquid.xyz` resolve normally. Setting Node's resolver to `1.1.1.1`
(`dns.setServers`) **still fails** — UDP :53 to the public resolver is blocked. Only
DNS-over-HTTPS answers: `https://cloudflare-dns.com/dns-query` returns
`api.bitget.com → 104.18.14.166, 104.18.15.166` and
`agent.bitget.com → 104.18.8.145, 104.18.9.145`.

**Chosen.** `scripts/doh-preload.mjs`: a Node `--import` preload that patches
`dns.lookup` for hosts matching `bitget.com` / `bitgetops.com` only, resolving them
over DoH and caching for 60s. Everything else falls through to the system resolver.

**Why not the alternatives.**
- *Set the machine's DNS to 1.1.1.1* — would not work: UDP :53 outbound is blocked, so it
  would break `github.com`/npm resolution too and strand the whole machine on a dead resolver.
- *A system-wide DoH proxy* — more moving parts than the build needs, and not reproducible
  for a judge.
- *Plain `fetch` with a pinned IP / `--resolve`-style hack* — brittle under Cloudflare IP
  rotation and leaks into every call site.
- *`dohjs` / `undici` Agent dependency* — unnecessary; `fetch` + a 20-line cache does it.

**Scope.** Only our Node processes are patched. `curl` (used by `strategy/raw/mcp.sh`) keeps
its own `--doh-url`. Vercel resolves `bitget.com` normally, so production needs none of this.

**Cost.** Sub-one-request-per-minute overhead; one 60s cache. A hostname that is not under
the two suffixes is never intercepted, so there is no chance of the DoH fetch recursing.

---

## D2 — pnpm workspaces, Node ≥ 20, strict TypeScript, Vitest

**Date:** 2026-10-05 · **Phase:** 0.1

The Agent Hub SDK is ESM and declares Node ≥ 20. This machine has Node v24.14.1 and
pnpm 10.33.3 — both fine. `tsconfig.base.json` turns on `strict`,
`noUncheckedIndexedAccess` and `verbatimModuleSyntax`, because the engine's whole promise is
that it owns every number and a silent `undefined` in a P&L sum is exactly the bug class
that would break that promise.

Tests are Vitest (fast, ESM-native, no config file needed). Lint is ESLint 9 flat config with
`typescript-eslint`; format is Prettier. No test framework sprawl.

---

## D3 — The engine is pure and isomorphic; time and randomness are injected

**Date:** 2026-10-05 · **Phase:** 0.1

`packages/engine` has zero I/O. It is imported by the CLI, by a web worker in the browser,
and by the desk's server routes — so each number has exactly one implementation, which is what
makes `CLAIMS.md` checkable.

Consequence, enforced from the first file: **no `Date.now()`, no `new Date()` as an implicit
clock, and no `Math.random()` inside the engine.** The miner's permutation test takes a seed;
the clock tagger takes a `now`/timezone from its caller. Without this, "same ledger reviewed
twice gives byte-identical JSON" (implementation.md §3 Phase 3 exit check) is not achievable.

---

## D4 — `.env` is a staging file, never a runtime input for Bitget's tools

**Date:** 2026-10-05 · **Phase:** 0.0

The Agent Hub SDK and CLI read credentials **only** from process environment variables and
explicitly refuse to parse `.env` (agenthub.md §Security; SDK README: "the SDK does not parse
`.env` files and never writes credentials to disk"). So `.env` is where *he* pastes keys, and
`scripts/load-env.mjs` copies them into `process.env` for our scripts. For `bgc` we export
first: `set -a && . ./.env && set +a && bgc ...`.

**Names, pinned from source, not memory:** `BITGET_API_KEY`, `BITGET_SECRET_KEY`,
`BITGET_PASSPHRASE` (s1.md:285–287, SDK README); `BITGET_QWEN_API_KEY` for the hackathon Qwen
endpoint (main2.md:571). Env-var names are the SDK's public contract.

**Cost / risk.** The loader must never log values and never override an already-set variable
(it does neither). `.env` is gitignored; only `.env.example` ships.

---

## D5 — Canonical symbols are the engine's key, not the venue's

**Date:** 2026-10-05 · **Phase:** 1 (types landed in 0)

`TSLAUSDT` (Bitget perps), `xyz:TSLA` (Hyperliquid), `TSLAUSDT_UMCBL` (legacy Bitget) are the
same instrument and must aggregate together. `canonicalSymbol()` strips the venue prefix, the
legacy contract suffix and one trailing quote currency (USDT/USDC/BUSD/USD/PERP, longest first
so `USDT` is not truncated into `T`).

Quote list order is load-bearing and covered by a test (`BTCUSD → BTC`, never `""`).

---

## D6 — Phase order is proof-first and is not reordered

**Date:** 2026-10-05 · **Phase:** review

The code that owns the numbers (1, 3), then the proof (3), then a thin end-to-end path (4),
then the model (5), then the UI (6), then breadth (7). Two consequences worth writing down:

- Phase 3's control (e) — reproducing the cohort's within-trader p ≈ 0.69 on a dated snapshot —
  depends on the Phase 2 cohort adapter. So the real sequence is **1 → 2(cohort) → 3**; Phase 3
  cannot start on control (e) before Phase 2 ships the snapshot.
- Phase 4's exit check needs Spike D (`bgc --help`, demo key). Guard syntax is taken from the
  real CLI, never assumed (risk register #7).

## D7 — MCP context tags sit behind the cut line

**Date:** 2026-10-05 · **Phase:** review

implementation.md §2.3 lists news/earnings/fear-greed in the market-context family, but §4's
cut list drops news (#2) and earnings (#3) first. Resolution: implement the candle-based
context tags (Bitget public data, no MCP dependency) in Phase 2 and land the MCP tags last,
behind the cut line. **Phase 2's exit check depends on candles, not on MCP.**

Confirmed correct by Spike C: the MCP server handshakes and lists its catalogue, but the
Bitget US-data backend answered `503` on every `do_query` (~25 attempts, 40+ minutes). Had the
MCP tags been on the critical path, Phase 2 would be blocked today.

---

## D8 — A `{maxLeverage}` rule reads account/position leverage, not the order

**Date:** 2026-10-05 · **Phase:** 0 (Spike D), affects Phase 4

`bgc discover --tool order --action place` returns the real `placeOrder` contract. Its fields
are `category`, `symbol`, `qty`, `side`, `orderType` (required) and `price`, `timeInForce`,
`posSide`, `clientOid`, `reduceOnly`, TP/SL (optional). **`leverage` is not among them** —
leverage is an account/position setting, set through a different endpoint, not an order
parameter.

So `blotter check` cannot read a proposed leverage off the order it is asked to gate. For a
`{ maxLeverage: N }` rule it must read the account's current leverage setting (or the open
position's) and compare *that*, and it should say which it read in its output. `{ maxSizeMultiple }`,
clock and behaviour rules are unaffected — those genuinely are order-time properties.

This was not in the plan and would have been discovered late, at Phase 4, with `guard` already
written against a wrong assumption.

---

## D9 — `placeOrder` does not require `--confirm`, so `guard` is the real gate

**Date:** 2026-10-05 · **Phase:** 0 (Spike D), affects Phase 4

The discovery payload reports `requiresConfirm: false` for `placeOrder` (only high-risk writes
such as `cancelAll` and `withdraw` carry that flag). The implication for the product's central
claim: nothing in `bgc` itself stops an agent from opening a position, so `blotter guard -- bgc ...`
is not a convenience wrapper around an existing safety net — **it is the only thing standing
between the agent and the order.** That is the honest framing for the README and the video, and
it raises the priority of the wrapper being boring and reliable.
