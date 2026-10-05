/**
 * Phase 0, Spike C — Bitget US-stock MCP server (`https://agent.bitget.com/mcp`).
 *
 * Proves the no-key US-data path the engine's context taggers depend on:
 * `equity_calendar`, `equity_price_historical`, `news_label_search`,
 * `sentiment_market_fear_greed`.
 *
 * Writes raw responses to strategy/raw/spike_c/ so each call is reproducible.
 * Run with the DoH preload (see package.json "spike:mcp", or:
 *   node --import ./scripts/doh-preload.mjs scripts/spike-c-mcp.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.SPIKE_C_OUT ?? join(HERE, '..', '..', 'strategy', 'raw', 'spike_c');
const MCP_URL = process.env.BITGET_MCP_URL ?? 'https://agent.bitget.com/mcp';
const PROTOCOL = '2025-06-18';

let sessionId;

/** Streamable-HTTP MCP: a response is either plain JSON or an SSE frame. */
function parseBody(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const out = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      out.push(JSON.parse(payload));
    } catch {
      /* keep going — a non-JSON frame is not a protocol error */
    }
  }
  return out.find((m) => m && (m.result !== undefined || m.error !== undefined)) ?? out[0] ?? null;
}

async function rpc(method, params, { notify = false } = {}) {
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}) };
  if (!notify) body.id = Math.floor(Math.random() * 1e9);

  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) });
  const newSid = res.headers.get('mcp-session-id');
  if (newSid) sessionId = newSid;

  const text = await res.text();
  if (!res.ok) throw new Error(`${method} -> HTTP ${res.status}: ${text.slice(0, 300)}`);
  if (notify) return null;
  return parseBody(text);
}

const save = async (name, value) => {
  await mkdir(OUT_DIR, { recursive: true });
  const path = join(OUT_DIR, name);
  await writeFile(path, JSON.stringify(value, null, 2));
  return path;
};

const results = {};

/** Upstream `do_query` intermittently answers 503 while it warms up. */
async function withRetry(fn, attempts = 2) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const out = await fn();
      const text = sliceText(out);
      if (text.includes('503 Service Temporarily Unavailable')) {
        lastError = new Error('upstream 503');
      } else {
        return out;
      }
    } catch (e) {
      lastError = e;
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 800));
  }
  throw lastError ?? new Error('retry exhausted');
}

async function main() {
  // 1. handshake
  const init = await rpc('initialize', {
    protocolVersion: PROTOCOL,
    capabilities: {},
    clientInfo: { name: 'blotter-spike-c', version: '0.1.0' },
  });
  results.initialize = { sessionId: sessionId ?? null, serverInfo: init?.result?.serverInfo };
  console.log('initialize  ->', init?.result?.serverInfo?.name ?? '(no serverInfo)');

  await rpc('notifications/initialized', undefined, { notify: true });

  // 2. tool catalogue
  const tools = await rpc('tools/list', {});
  const names = (tools?.result?.tools ?? []).map((t) => t.name);
  results.tools = names;
  await save('tools_list.json', tools);
  console.log('tools/list  ->', names.join(', ') || '(none)');

  // 3. the guide: guide{category?,subcategory?,keyword?} lists catalogue entries.
  const guide = await rpc('tools/call', { name: 'guide', arguments: {} });
  await save('guide_root.json', guide);
  results.guideRoot = sliceText(guide);
  console.log('guide       ->', results.guideRoot.slice(0, 200).replace(/\s+/g, ' '));

  // Each family the taggers need lives in a category; pull the entry ids.
  const families = ['equity', 'news', 'sentiment'];
  const catalogue = {};
  for (const category of families) {
    const res = await rpc('tools/call', { name: 'guide', arguments: { category } });
    await save(`guide_${category}.json`, res);
    catalogue[category] = collectEntryIds(res);
    console.log(`guide ${category} ->`, catalogue[category].join(', ') || '(none)');
  }
  results.catalogue = catalogue;

  // 4. Discover working params per entry. The guide gives ids but not their
  //    parameter contracts, so probe candidate shapes and record which one the
  //    server accepts. 503s are retried, then reported honestly.
  const wanted = [
    {
      name: 'equity_calendar',
      candidates: [
        { symbol: 'TSLA' },
        { symbol: 'TSLA', start_date: '2026-09-01', end_date: '2026-10-05' },
        { symbols: 'TSLA' },
      ],
    },
    {
      name: 'news_label_search',
      candidates: [{ label: 1 }, { label: 1, limit: 10 }, { label: 0 }],
    },
    {
      name: 'equity_price_historical',
      candidates: [
        { symbol: 'TSLA' },
        { symbol: 'TSLA', interval: '1d' },
      ],
    },
    {
      name: 'sentiment_market_fear_greed',
      candidates: [{}, { market: 'US' }],
    },
  ];
  const entryIds = Object.values(catalogue).flat();

  for (const { name, candidates } of wanted) {
    const entryId = entryIds.find((id) => id === name) ?? entryIds.find((id) => id.includes(name));
    if (!entryId) {
      results[name] = { status: 'NO ENTRY ID' };
      console.log(`do_query ${name} -> NO ENTRY ID`);
      continue;
    }

    const attempts = [];
    let accepted = null;

    for (const params of candidates) {
      let res;
      try {
        res = await withRetry(() =>
          rpc('tools/call', { name: 'do_query', arguments: { entry_id: entryId, params } }),
        );
      } catch (e) {
        attempts.push({ params, error: e.message });
        console.log(`  ${name} ${JSON.stringify(params)} -> ${e.message}`);
        continue;
      }

      const text = sliceText(res);
      await save(`do_query_${name}__${JSON.stringify(params).replace(/\W+/g, '_')}.json`, res);
      const parsed = safeJson(text);
      const ok = parsed?.success === true;
      attempts.push({ params, ok, error: parsed?.error ?? null });

      if (ok) {
        accepted = { params, text };
        console.log(`do_query ${name} OK with ${JSON.stringify(params)}`);
        break;
      }
      console.log(`  ${name} ${JSON.stringify(params)} -> ${parsed?.error ?? 'non-success'}`);
    }

    results[name] = accepted
      ? { entryId, status: 'LIVE', params: accepted.params, text: accepted.text, attempts }
      : { entryId, status: 'NOT LIVE', attempts };
    if (!accepted) console.log(`do_query ${name} -> NOT LIVE`);
  }

  await save('summary.json', {
    ranAt: new Date().toISOString(),
    mcpUrl: MCP_URL,
    ...results,
  });
  console.log(`\nwrote ${OUT_DIR}`);
}

/** The parameters actually accepted for an MCP entry. */
function sliceText(msg) {
  const content = msg?.result?.content;
  if (Array.isArray(content)) return content.map((c) => c.text ?? '').join('\n');
  return JSON.stringify(msg ?? null).slice(0, 4000);
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Pull every entry id out of a `guide` response. The payload nests ids under a
 * few different keys depending on depth, so walk it rather than guess the shape.
 */
function collectEntryIds(msg) {
  const text = sliceText(msg);
  const ids = new Set();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }

  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if ((key === 'entry_id' || key === 'id') && typeof value === 'string') ids.add(value);
      else walk(value);
    }
  };

  walk(parsed);

  // Fallback for a flat/plain-text catalogue.
  if (ids.size === 0) {
    for (const m of text.matchAll(/\b(equity|news|sentiment|crypto|etf)_[a-z0-9_]+\b/g)) {
      ids.add(m[0]);
    }
  }
  return [...ids];
}

main().catch((e) => {
  console.error('SPIKE C FAILED:', e.message);
  process.exitCode = 1;
});
