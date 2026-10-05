/**
 * DoH preload — makes Node resolve `*.bitget.com` without touching system DNS.
 *
 * Why: on this machine the local resolver (10.116.120.8) cannot resolve any
 * `bitget.com` host, and UDP :53 to 1.1.1.1 is also blocked. HTTPS to
 * cloudflare-dns.com works, so we answer those lookups over DNS-over-HTTPS.
 *
 * Scope is deliberately narrow: only hosts matching `DOH_SUFFIXES` are
 * intercepted. Everything else falls through to the system resolver, which
 * both keeps github/npm working and stops the DoH fetch itself from recursing.
 *
 * Usage:
 *   node --import ./scripts/doh-preload.mjs <script.mjs>
 * or, for tools we do not launch ourselves (SDK, bgc):
 *   NODE_OPTIONS="--import ./scripts/doh-preload.mjs" ...
 *
 * Env:
 *   BITGET_DOH_URL      default https://cloudflare-dns.com/dns-query
 *   BITGET_DOH_SUFFIXES default bitget.com,bitgetops.com
 */

import dns from 'node:dns';
import dnsPromises from 'node:dns/promises';

const DOH_URL = process.env.BITGET_DOH_URL ?? 'https://cloudflare-dns.com/dns-query';
const SUFFIXES = (process.env.BITGET_DOH_SUFFIXES ?? 'bitget.com,bitgetops.com')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** hostname -> { address, family, expires } */
const cache = new Map();
const TTL_MS = 60_000;

const isTarget = (hostname) => {
  const h = String(hostname).toLowerCase().replace(/\.$/, '');
  return SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
};

async function resolve(hostname) {
  const hit = cache.get(hostname);
  if (hit && hit.expires > Date.now()) return hit;

  const url = `${DOH_URL}?name=${encodeURIComponent(hostname)}&type=A`;
  const res = await fetch(url, { headers: { accept: 'application/dns-json' } });
  if (!res.ok) throw new Error(`DoH HTTP ${res.status} for ${hostname}`);
  const body = await res.json();

  const answers = (body.Answer ?? []).filter((a) => a.type === 1 || a.type === 28);
  if (answers.length === 0) {
    const err = new Error(`DoH: no A/AAAA record for ${hostname}`);
    err.code = 'ENOTFOUND';
    throw err;
  }

  // Prefer IPv4: Bitget's edge answered A records reliably in Phase 0 probes.
  const v4 = answers.find((a) => a.type === 1);
  const chosen = v4 ?? answers[0];
  const record = {
    address: chosen.data,
    family: v4 ? 4 : 6,
    expires: Date.now() + TTL_MS,
  };
  cache.set(hostname, record);
  return record;
}

const errors = (e) => {
  if (e && typeof e === 'object' && 'code' in e) {
    if (e.code === 'ENOTFOUND') return e;
    return e;
  }
  const err = new Error(String(e?.message ?? e));
  err.code = e?.code ?? 'ENOTFOUND';
  return err;
};

/** dns.lookup(hostname[, options], callback) */
function dohLookup(hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  const opts = options ?? {};

  if (!isTarget(hostname)) return originalLookup(hostname, opts, callback);

  resolve(hostname).then(
    (rec) => {
      if (opts.all) {
        callback(null, [{ address: rec.address, family: rec.family }]);
      } else {
        callback(null, rec.address, rec.family);
      }
    },
    (e) => callback(errors(e)),
  );
}

const originalLookup = dns.lookup.bind(dns);
const originalLookupAsync = dnsPromises.lookup.bind(dnsPromises);

dns.lookup = dohLookup;
dnsPromises.lookup = async function dohLookupAsync(hostname, options) {
  if (!isTarget(hostname)) return originalLookupAsync(hostname, options);
  const rec = await resolve(hostname);
  if (options?.all) return [{ address: rec.address, family: rec.family }];
  return rec;
};

// Node's net/http default lookup is the callback form; make sure it is ours.
const { default: net } = await import('node:net');
void net;

if (process.env.BITGET_DOH_DEBUG) {
  console.error(
    `[doh-preload] intercepting ${SUFFIXES.join(', ')} via ${DOH_URL}`,
  );
}
