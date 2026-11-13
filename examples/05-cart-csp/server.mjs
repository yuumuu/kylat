/**
 * Server demo Cart dengan CSP ketat (tanpa unsafe-inline/unsafe-eval).
 *
 * CSP mengizinkan:
 * - script eksternal same-origin;
 * - satu import map inline lewat hash SHA-256;
 * - style eksternal same-origin;
 * - fetch same-origin.
 *
 * Inline script lain (canary di index.html) harus diblokir browser.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY_BYTES = 256 * 1024;
const STOCK = 3;

let totalQty = 0;
let mutationCount = 0;
const idempotencyStore = new Map();

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function payloadHash(action, args) {
  return crypto.createHash('sha256').update(stableStringify({ action, args })).digest('hex');
}

function cspFor(html) {
  const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  const hash = match
    ? crypto.createHash('sha256').update(match[1]).digest('base64')
    : null;

  const scriptSrc = ["'self'", hash ? `'sha256-${hash}'` : null].filter(Boolean).join(' ');

  return [
    "default-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self'",
    "connect-src 'self'",
    "img-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ].join('; ');
}

function json(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(JSON.stringify(body));
}

export function createDemoServer() {
  const indexPath = path.join(__dirname, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  const contentSecurityPolicy = cspFor(indexHtml);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/_kylat/call') {
      let bodyText = '';
      let bodyBytes = 0;
      for await (const chunk of req) {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          json(res, 413, { type: 'urn:kylat:payload_too_large', title: 'Payload Too Large', status: 413 });
          return;
        }
        bodyText += chunk;
      }

      let payload;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        json(res, 400, { type: 'urn:kylat:bad_request', title: 'Bad Request', status: 400 });
        return;
      }

      const calls = payload?.calls;
      if (!Array.isArray(calls) || calls.length === 0 || calls.length > 20) {
        json(res, 400, { type: 'urn:kylat:bad_request', title: 'Bad Request', status: 400 });
        return;
      }

      const results = [];
      for (const call of calls) {
        const id = typeof call?.id === 'string' ? call.id : 'call_unknown';

        if (call?.action !== 'CartActions::add') {
          results.push({ id, ok: false, error: { type: 'kylat:not_found', message: 'Aksi tidak ditemukan.' } });
          continue;
        }

        const key = call.idempotencyKey || req.headers['idempotency-key'] || '';
        if (typeof key !== 'string' || key.length < 8 || key.length > 128) {
          results.push({
            id,
            ok: false,
            error: { type: 'kylat:validation', message: 'Idempotency-Key wajib 8 sampai 128 karakter.' },
          });
          continue;
        }

        const hash = payloadHash(call.action, call.args ?? {});
        const existing = idempotencyStore.get(key);
        if (existing) {
          if (existing.hash !== hash) {
            results.push({
              id,
              ok: false,
              error: { type: 'kylat:idempotency_conflict', message: 'Key sama untuk payload berbeda.' },
            });
          } else {
            results.push({ id, ok: true, data: existing.data });
          }
          continue;
        }

        const qty = call.args?.qty;
        if (!Number.isInteger(qty) || qty < 1) {
          results.push({
            id,
            ok: false,
            error: { type: 'kylat:validation', message: 'qty wajib bilangan bulat >= 1.' },
          });
          continue;
        }

        if (qty > STOCK) {
          results.push({
            id,
            ok: false,
            error: { type: 'kylat:validation', message: `Stok maksimum ${STOCK}.` },
          });
          continue;
        }

        totalQty += qty;
        mutationCount++;
        const data = { saved: true, qty, totalQty, mutationCount };
        idempotencyStore.set(key, { hash, data });
        results.push({ id, ok: true, data });
      }

      json(res, 200, { results });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      json(res, 200, { totalQty, mutationCount, idempotencyKeys: idempotencyStore.size });
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': contentSecurityPolicy,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(indexHtml);
      return;
    }

    let filePath = '';
    let contentType = 'application/javascript; charset=utf-8';

    if (url.pathname === '/app.js') {
      filePath = path.join(__dirname, 'app.js');
    } else if (url.pathname === '/style.css') {
      filePath = path.join(__dirname, 'style.css');
      contentType = 'text/css; charset=utf-8';
    } else if (url.pathname === '/dist/Cart.js') {
      filePath = path.join(__dirname, 'dist/Cart.js');
    } else if (url.pathname.startsWith('/@kylat/runtime/')) {
      filePath = path.join(__dirname, '../../packages/runtime/dist', url.pathname.slice('/@kylat/runtime/'.length));
    } else if (url.pathname.startsWith('/@kylat/protocol/')) {
      filePath = path.join(__dirname, '../../packages/protocol/dist', url.pathname.slice('/@kylat/protocol/'.length));
    } else if (url.pathname.startsWith('/alien-signals/')) {
      filePath = path.join(
        __dirname,
        '../../packages/runtime/node_modules/alien-signals/esm',
        url.pathname.slice('/alien-signals/'.length)
      );
    } else if (url.pathname === '/system.mjs') {
      filePath = path.join(__dirname, '../../packages/runtime/node_modules/alien-signals/esm/system.mjs');
    }

    if (filePath) {
      const resolved = path.resolve(filePath);
      const allowedRoots = [
        path.resolve(__dirname),
        path.resolve(__dirname, '../../packages/runtime/dist'),
        path.resolve(__dirname, '../../packages/protocol/dist'),
        path.resolve(__dirname, '../../packages/runtime/node_modules/alien-signals/esm'),
      ];
      const allowed = allowedRoots.some(
        (root) => resolved === root || resolved.startsWith(root + path.sep)
      );
      if (!allowed) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
    }

    if (filePath && fs.existsSync(filePath)) {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return {
    server,
    contentSecurityPolicy,
    resetState: () => {
      totalQty = 0;
      mutationCount = 0;
      idempotencyStore.clear();
    },
    getState: () => ({ totalQty, mutationCount, idempotencyKeys: idempotencyStore.size }),
  };
}
