/**
 * Engine domain types — implementation.md §2.2.
 *
 * The engine is pure: no I/O, no clock, no RNG. Anything time- or
 * randomness-dependent is passed in by a caller, so the same ledger always
 * produces the same bytes.
 */

/** A single execution, normalised across venues. */
export interface Fill {
  id: string;
  orderId: string;
  /** epoch ms */
  ts: number;
  /** canonical base symbol, e.g. "TSLA" — see canonicalSymbol */
  symbol: string;
  venue: 'bitget' | 'public-cohort';
  side: 'buy' | 'sell';
  px: number;
  qty: number;
  fee: number;
  /** venue-reported, used for cross-checks only — never as the source of truth */
  realizedPnl?: number;
  reduceOnly?: boolean;
  leverage?: number;
}

/** One round trip, flat -> flat. A flip closes one trip and opens another. */
export interface Trip {
  id: string;
  symbol: string;
  dir: 'long' | 'short';
  openTs: number;
  closeTs: number;
  /** ids of the Fills composing this trip */
  fills: string[];
  maxNotional: number;
  entryPx: number;
  exitPx: number;
  grossPnl: number;
  fees: number;
  funding: number;
  net: number;
  netBps: number;
  tags: Record<string, string | number | boolean | null>;
}

export interface Ledger {
  id: string;
  source: string;
  owner: 'self' | 'cohort';
  fills: Fill[];
  trips: Trip[];
  fetchedAt: number;
}
