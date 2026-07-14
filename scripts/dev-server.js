// Local dev server. Zero dependencies.
//
// Mimics Vercel closely enough to develop against: serves the static site with
// vercel.json's cleanUrls behaviour, and routes /api/* to the same handler
// modules that Vercel will run in production. Same code path, same contract.
//
//   npm run dev        (or: ~/.local/node/bin/node scripts/dev-server.js)

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 3000;

// ── .env.local ────────────────────────────────────────────────────────────
// Vercel injects env vars for us in production; locally we read the file.
const envPath = join(ROOT, '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
  console.log('  loaded .env.local');
} else {
  console.log('  no .env.local — API routes that need Supabase will 500');
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function serveStatic(req, res, pathname) {
  // vercel.json sets cleanUrls, so /apply resolves to apply.html.
  const candidates = [];
  const clean = pathname.replace(/\/$/, '');

  if (pathname === '/' || pathname === '') candidates.push('index.html');
  else {
    candidates.push(clean.slice(1));
    if (!extname(clean)) {
      candidates.push(`${clean.slice(1)}.html`);
      candidates.push(join(clean.slice(1), 'index.html'));
    }
  }

  for (const rel of candidates) {
    // Never let a request escape the project root.
    const full = resolve(ROOT, rel);
    if (!full.startsWith(ROOT)) continue;
    try {
      const s = await stat(full);
      if (!s.isFile()) continue;
      const body = await readFile(full);
      res.statusCode = 200;
      res.setHeader('Content-Type', MIME[extname(full)] || 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-store');
      res.end(body);
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

async function serveApi(req, res, pathname) {
  const rel = pathname.replace(/^\/api\//, '').replace(/\/$/, '');
  if (!rel || rel.includes('..') || rel.startsWith('_')) return false;

  const file = resolve(ROOT, 'api', `${rel}.js`);
  if (!file.startsWith(resolve(ROOT, 'api')) || !existsSync(file)) return false;

  // Cache-bust so edits are picked up without restarting the server.
  const mod = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
  const handler = mod.default;
  if (typeof handler !== 'function') return false;

  // Vercel pre-parses JSON bodies onto req.body. Match that so handlers behave
  // identically in both places.
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString('utf8');
    if (raw) {
      try {
        req.body = JSON.parse(raw);
      } catch {
        req.body = raw;
      }
    }
  }

  await handler(req, res);
  return true;
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, `http://localhost:${PORT}`);
  const started = Date.now();

  try {
    const handled = pathname.startsWith('/api/')
      ? await serveApi(req, res, pathname)
      : await serveStatic(req, res, pathname);

    if (!handled) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Not Found');
    }
  } catch (err) {
    console.error(`  ✗ ${req.method} ${pathname}`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Internal error', detail: err.message }));
    }
  }

  const ms = Date.now() - started;
  const code = res.statusCode;
  const mark = code >= 500 ? '✗' : code >= 400 ? '!' : '✓';
  console.log(`  ${mark} ${code} ${req.method.padEnd(4)} ${pathname} ${ms}ms`);
});

server.listen(PORT, () => {
  console.log(`\n  World Labs dev → http://localhost:${PORT}`);
  console.log(`     apply      → http://localhost:${PORT}/apply`);
  console.log(`     admin      → http://localhost:${PORT}/admin`);
  console.log(`     benchmark  → http://localhost:${PORT}/benchmark\n`);
});
