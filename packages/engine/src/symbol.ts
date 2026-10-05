/**
 * Canonical symbol mapping — implementation.md §3 Phase 1 step 1.
 *
 * Venues spell the same instrument many ways:
 *   Bitget perps    TSLAUSDT
 *   Hyperliquid     xyz:TSLA
 *   Bitget legacy   TSLAUSDT_UMCBL
 * Everything downstream keys on the bare base, so "TSLA".
 */

const VENUE_PREFIX = /^[a-z0-9]+:/i;
const CONTRACT_SUFFIX = /_(UMCBL|DMCBL|SPBL|CMCBL)$/i;
/** Quote currencies, longest first so USDT is not eaten by USD. */
const QUOTES = ['USDT', 'USDC', 'BUSD', 'USD', 'PERP'];

export function canonicalSymbol(raw: string): string {
  let s = String(raw).trim().toUpperCase();
  if (!s) return s;

  s = s.replace(VENUE_PREFIX, '');
  s = s.replace(CONTRACT_SUFFIX, '');
  s = s.replace(/-PERP$/, '');
  s = s.replace(/_PERP$/, '');

  for (const q of QUOTES) {
    if (s.length > q.length && s.endsWith(q)) {
      s = s.slice(0, -q.length);
      break;
    }
  }

  // A trailing separator left behind by a stripped quote (e.g. "TSLA-USD").
  return s.replace(/[-_]$/, '');
}
