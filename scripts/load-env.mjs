/**
 * Minimal .env loader.
 *
 * The Bitget Agent Hub tools deliberately refuse to parse `.env` (agenthub.md
 * §Security: "No .env parsing"), so credentials have to arrive as real process
 * environment variables. This script is that bridge for OUR scripts — it never
 * prints values and never overrides a variable that is already set.
 *
 *   node --import ./scripts/load-env.mjs scripts/whatever.mjs
 *   NODE_OPTIONS="--import ./scripts/load-env.mjs" node scripts/whatever.mjs
 *
 * There is no `dotenv` dependency on purpose: 20 lines beats a supply chain.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ENV_PATH = process.env.BLOTTER_ENV_FILE ?? join(ROOT, '.env');

if (existsSync(ENV_PATH)) {
  const text = readFileSync(ENV_PATH, 'utf8');
  let loaded = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq <= 0) continue;

    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();

    // strip one layer of matching quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    // never override an explicit environment variable
    if (process.env[key] === undefined) {
      process.env[key] = value;
      loaded += 1;
    }
  }
  if (process.env.BLOTTER_ENV_DEBUG) {
    console.error(`[load-env] ${ENV_PATH}: ${loaded} variable(s) set`);
  }
} else if (process.env.BLOTTER_ENV_DEBUG) {
  console.error(`[load-env] no file at ${ENV_PATH}`);
}
