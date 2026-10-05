# Blotter

*Markets close. Habits don't. Find them. Rule them.*

Bitget AI Base Camp Hackathon S2 · Track 3 **AI Trading Desk** · sub-theme **Review & Self-Evolution**.
Mustapha Fadhlullah, independent builder.

> **Status: Phase 0 (setup and access spikes).** Nothing downstream is built. See
> `../../strategy/SPIKES.md` for what has and has not run, and `DECISIONS.md` for the build log.

## The problem

Bitget runs 31 US-stock perpetual futures 7×24 at up to 100x. The clock is not neutral:

| NYSE session | share of hours | share of price variance | share of volume |
|---|---|---|---|
| regular hours | 20.6% | 62.5% | 52.5% |
| extended | 26.5% | 25.0% | 26.2% |
| overnight | 23.5% | 8.6% | 13.3% |
| **weekend** | **29.4%** | **3.9%** | 8.1% |

*(12 stock perps, 92 days of 1h candles — reproducible from `../strategy/raw/sessions.mjs`.)*

And the habits everyone warns about are personal. Across 30 real 24/7 stock-perp traders
(688 round trips), weekend entries win 10 points less and entries within 60 minutes of a
losing close win 12 points less — **and both gaps vanish when sessions are shuffled within
each trader** (permutation p = 0.69 and 0.29). The pooled gap describes *who* trades that
way, not *what it costs a given trader*.

So a rule has to be proven on the trader's own fills.

## How it works

```
 ask --> ledger --> round trips --> tags --> patterns --> proposed rules --> COURT --> rulebook --> agent check
  ^     (Bitget)                   clock /    (stats)      (LLM)             replay on    human       before every
  |                                context /                                 own fills,   approves    order
  |                                behaviour                                 IS + OOS                    |
  +------------------------ next review: adherence, overrides, rule decay <------------------------------+
```

The LLM proposes (questions, hypotheses, rules, prose). The deterministic engine decides
(every number, every verdict). The human admits a rule. The trader's own agent applies it.

## Verify in 60 seconds

```bash
pnpm install
pnpm test          # engine invariants: symbol canonicalisation, later round-trip + clock
pnpm spike:mcp     # Phase 0 Spike C: the no-key US-data MCP path, live
```

Phase 1–3 will add the two commands that carry the claim:

```bash
blotter court --fixture planted-revenge   # finds the planted leak, admits the rule
blotter court --fixture shuffled          # finds nothing, rejects
```

## What this is NOT

Not a journal. Not a price predictor. Not auto-trading. Not a model's opinion acting as a veto.
A journal describes; Blotter rejects the rules that do not survive out-of-sample replay **on
your own fills**, and enforces the ones that do before your agent's next order.

## Repository

```
blotter/
  packages/engine/     pure TypeScript, zero I/O — types, round trips, tags, miner, rule DSL, court
  packages/adapters/   ledger + context sources (Bitget UTA SDK, Bitget CSV, public cohort, market, MCP)
  packages/desk/       LLM layer: tool registry, number-provenance guard, deterministic fallback
  packages/cli/        the `blotter` binary
  apps/web/            Next.js App Router, CSS Modules + tokens + Motion. No Tailwind.
  skills/              blotter-rules SKILL.md for Claude Code / Codex / OpenClaw
  scripts/             doh-preload, load-env, spike scripts
```

## Environment

Node ≥ 20, pnpm. Copy `.env.example` to `.env` and fill in what a spike needs — the file
lists, per key, the exact page to fetch it from. `.env` is gitignored.

This machine cannot resolve `bitget.com` at the system resolver, and UDP :53 to 1.1.1.1 is
blocked; only DNS-over-HTTPS works. `scripts/doh-preload.mjs` answers those lookups over
HTTPS in-process, so no system DNS change is needed. See `DECISIONS.md` D1.
