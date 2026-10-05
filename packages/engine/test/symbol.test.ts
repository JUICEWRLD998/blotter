import { describe, expect, it } from 'vitest';
import { canonicalSymbol } from '../src/symbol.js';

describe('canonicalSymbol', () => {
  it('strips Bitget USDT-margined perp suffixes', () => {
    expect(canonicalSymbol('TSLAUSDT')).toBe('TSLA');
    expect(canonicalSymbol('NVDAUSDT')).toBe('NVDA');
    expect(canonicalSymbol('SPYUSDT')).toBe('SPY');
  });

  it('strips the Hyperliquid venue prefix', () => {
    expect(canonicalSymbol('xyz:TSLA')).toBe('TSLA');
  });

  it('strips legacy contract suffixes', () => {
    expect(canonicalSymbol('TSLAUSDT_UMCBL')).toBe('TSLA');
  });

  it('keeps a base that is itself a quote name', () => {
    // BTCUSD -> BTC, never ""
    expect(canonicalSymbol('BTCUSD')).toBe('BTC');
    expect(canonicalSymbol('ETHUSDT')).toBe('ETH');
  });

  it('is case-insensitive and idempotent', () => {
    expect(canonicalSymbol('tslausdt')).toBe('TSLA');
    expect(canonicalSymbol(canonicalSymbol('TSLAUSDT'))).toBe('TSLA');
  });

  it('passes through an unmatched symbol unchanged', () => {
    expect(canonicalSymbol('aapl')).toBe('AAPL');
  });
});
