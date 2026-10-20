#!/usr/bin/env node
/**
 * API contract drift check.
 *
 * Statically extracts every route the backend registers (route files + the prefixes they are
 * mounted at in backend/src/server.ts) and every call the frontend makes through the axios
 * client, then fails if a frontend call has no matching backend route (same method + path shape).
 *
 * Run from the repo root:  node scripts/check-api-contract.mjs [--list]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendSrc = path.join(root, 'backend', 'src');
const frontendSrc = path.join(root, 'frontend', 'src');
const VERBS = 'get|post|put|patch|delete';

// Frontend calls that are intentionally not served by this backend. Keep empty if possible.
const ALLOWLIST = new Set([]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(p);
  }
  return out;
}

const norm = (p) =>
  '/' +
  p
    .split('?')[0]
    .split('/')
    .filter(Boolean)
    .map((s) => (s.startsWith(':') || s.includes('${') ? ':p' : s))
    .join('/');

// ── Backend ────────────────────────────────────────────────────────────────
const server = fs.readFileSync(path.join(backendSrc, 'server.ts'), 'utf8');

// imports: local name -> { file, exported name | 'default' }
const imports = new Map();
for (const m of server.matchAll(/import\s+(?:(\w+)|\{([^}]*)\})\s+from\s+'(\.\/modules\/[^']+)'/g)) {
  const file = path.join(backendSrc, m[3] + '.ts');
  if (m[1]) imports.set(m[1], { file, exported: 'default' });
  else
    for (const part of m[2].split(',').map((s) => s.trim()).filter(Boolean)) {
      const [exp, local = exp] = part.split(/\s+as\s+/);
      imports.set(local, { file, exported: exp });
    }
}

function localIdentFor(src, exported) {
  if (exported === 'default') return src.match(/export\s+default\s+(\w+)/)?.[1];
  const alias = src.match(new RegExp(String.raw`export\s*\{[^}]*\b(\w+)\s+as\s+${exported}\b`))?.[1];
  return alias ?? exported; // `export const X = Router()` or `export { X }`
}

const backend = new Set();
const mounts = [...server.matchAll(/app\.use\(\s*'([^']+)'\s*,\s*(?:[\w, ]+,\s*)?(\w+)\s*\)/g)];
for (const [, prefix, name] of mounts) {
  const imp = imports.get(name);
  if (!imp || !fs.existsSync(imp.file)) continue;
  const src = fs.readFileSync(imp.file, 'utf8');
  const ident = localIdentFor(src, imp.exported);
  const re = new RegExp(String.raw`\b${ident}\.(${VERBS})\(\s*'([^']*)'`, 'g');
  for (const r of src.matchAll(re)) backend.add(`${r[1].toUpperCase()} ${norm(`${prefix}/${r[2]}`)}`);
}
// routes declared directly on app in server.ts
for (const r of server.matchAll(new RegExp(String.raw`\bapp\.(${VERBS})\(\s*'([^']*)'`, 'g'))) {
  backend.add(`${r[1].toUpperCase()} ${norm(r[2])}`);
}
// strip the /api prefix: the frontend axios baseURL already ends in /api
const backendApi = new Set(
  [...backend].filter((r) => r.split(' ')[1].startsWith('/api')).map((r) => r.replace(' /api', ' ')),
);

// ── Frontend ───────────────────────────────────────────────────────────────
const callRe = new RegExp(
  String.raw`\b(?:apiClient|api)\s*\.\s*(${VERBS})\s*(?:<[^()]*>)?\(\s*([` + '`' + String.raw`'"])((?:(?!\2)[^\\])*)\2`,
  'g',
);
const calls = new Map(); // "VERB /path" -> [files]
for (const file of walk(frontendSrc)) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(callRe)) {
    const key = `${m[1].toUpperCase()} ${norm(m[3])}`;
    if (!calls.has(key)) calls.set(key, []);
    calls.get(key).push(path.relative(root, file).split(path.sep).join('/'));
  }
}

if (process.argv.includes('--list')) {
  console.log([...backendApi].sort().join('\n'));
  process.exit(0);
}

const missing = [...calls].filter(([k]) => !backendApi.has(k) && !ALLOWLIST.has(k));
console.log(`backend routes: ${backendApi.size}, distinct frontend calls: ${calls.size}`);
if (missing.length) {
  console.error('\nFrontend calls with no matching backend route:');
  for (const [k, files] of missing) console.error(`  ${k}   <- ${[...new Set(files)].join(', ')}`);
  process.exit(1);
}
console.log('API contract OK');
