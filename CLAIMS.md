# Blotter — claims ledger

Every number that appears in the README, the video, the form text or the UI maps to the
command that reproduces it. If a number is not in this table, it does not ship.

Status vocabulary: **LIVE** (reproduces now) · **NEXT** (planned, command not written) ·
**NOT LIVE** (attempted, failed, fallback in force).

| # | Claim | Value | Command | Status |
|---|---|---|---|---|
| 1 | Weekend share of clock, stock perps | 29.4% of hours | `cd ../strategy/raw && bash sessions.sh && node sessions.mjs` | LIVE |
| 2 | Weekend share of price variance | 3.9% | same as #1 | LIVE |
| 3 | RTH share of variance | 62.5% | same as #1 | LIVE |
| 4 | Cohort size (pilot) | 30 traders / 688 round trips / 120 days | `cd ../strategy/raw && node cohort.mjs 250` | LIVE |
| 5 | Weekend entries: pooled win-rate gap | −10 pts | same as #4 | LIVE |
| 6 | Weekend entries: within-trader permutation p | 0.69 | same as #4 | LIVE |
| 7 | Revenge entries (≤60 min after a losing close): gap | −12 pts | same as #4 | LIVE |
| 8 | Revenge entries: within-trader permutation p | 0.29 | same as #4 | LIVE |
| 9 | Stock perps on Bitget, USDT-FUTURES | 31 contracts, up to 100x | `../strategy/raw/contracts.json` | LIVE |
| 10 | US-data MCP catalogue | 2 tools (`guide`, `do_query`); 22 equity + 39 crypto entries | `pnpm spike:mcp` | LIVE |
| 11 | Engine: canonical symbol mapping | 6 test cases | `pnpm -F @blotter/engine test` | LIVE |
| — | Submissions’ audit trail | pending Phase 7 | — | NEXT |

## Rules for this file

1. A number gets a row **before** it appears in any shipped copy.
2. "Verified" means a command in the row was run and its output is quoted, not that it was planned.
3. Rows are never deleted — a corrected number keeps its row and gains a `corrected:` note, so
   the change of mind is on the record.
