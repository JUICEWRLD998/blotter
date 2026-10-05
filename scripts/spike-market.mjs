/**
 * Phase 0 — Bitget public market API over the DoH preload.
 * This is the load-bearing no-key source behind the context taggers
 * (candles, contracts, funding). Positive control for D1.
 */
const BASE = process.env.BITGET_API_BASE_URL ?? 'https://api.bitget.com';
const get = async (path) => {
  const r = await fetch(`${BASE}${path}`);
  const text = await r.text();
  return { status: r.status, body: text };
};

const checks = [
  ['contracts (USDT-FUTURES)', '/api/v2/mix/market/contracts?productType=usdt-futures'],
  ['ticker TSLAUSDT', '/api/v2/mix/market/ticker?symbol=TSLAUSDT&productType=usdt-futures'],
  ['candles TSLAUSDT 1H (2)', '/api/v2/mix/market/candles?symbol=TSLAUSDT&granularity=1H&limit=2&productType=usdt-futures'],
];

for (const [label, path] of checks) {
  try {
    const { status, body } = await get(path);
    const j = JSON.parse(body);
    const n = Array.isArray(j.data) ? j.data.length : 'n/a';
    const sample = Array.isArray(j.data) && j.data[0] ? JSON.stringify(j.data[0]).slice(0, 120) : JSON.stringify(j).slice(0, 120);
    console.log(`${status === 200 && j.code === '00000' ? 'OK  ' : 'FAIL'} ${label} -> code=${j.code} rows=${n}`);
    console.log(`     ${sample}`);
  } catch (e) {
    console.log(`FAIL ${label} -> ${e.message}`);
  }
}
