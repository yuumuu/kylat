/**
 * server.mjs - Server HTTP & RPC backend untuk demo Counter.
 *
 * Kontrak wire mengikuti spec/protocol.schema.json:
 * - request call: { id, action, args, idempotencyKey? }
 * - response:     { results: [{ id, ok, data? , error? }] }
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3010;
const MAX_BODY_BYTES = 256 * 1024;

let serverSavedCount = 0;
let serverMutationCount = 0;
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
  return crypto
    .createHash('sha256')
    .update(stableStringify({ action, args }))
    .digest('hex');
}

function problem(res, status, title, detail) {
  res.writeHead(status, {
    'Content-Type': 'application/problem+json',
    'Cache-Control': 'no-store',
  });
  res.end(
    JSON.stringify({
      type: `https://kylat.dev/errors/${status}`,
      title,
      status,
      detail,
    })
  );
}

function resultError(id, type, message) {
  return { id, ok: false, error: { type, message } };
}

export function createDemoServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'POST' && url.pathname === '/_kylat/call') {
      if (!(req.headers['content-type'] || '').includes('application/json')) {
        problem(res, 415, 'Unsupported Media Type', 'Content-Type wajib application/json.');
        return;
      }

      let bodyText = '';
      let bodyBytes = 0;
      for await (const chunk of req) {
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          problem(res, 413, 'Payload Too Large', 'Body melebihi 256 KB.');
          return;
        }
        bodyText += chunk;
      }

      let payload;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        problem(res, 400, 'Bad Request', 'Payload JSON tidak valid.');
        return;
      }

      const calls = payload?.calls;
      if (!Array.isArray(calls) || calls.length === 0 || calls.length > 20) {
        problem(res, 400, 'Bad Request', 'calls wajib berisi 1 sampai 20 panggilan.');
        return;
      }

      const results = [];

      for (const call of calls) {
        const id = typeof call?.id === 'string' ? call.id : 'call_unknown';
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(id)) {
          results.push(resultError(id, 'kylat:validation', 'Call id tidak valid.'));
          continue;
        }
        if (typeof call.action !== 'string' || !/^[A-Za-z_][A-Za-z0-9_\\]*::[A-Za-z_][A-Za-z0-9_]*$/.test(call.action)) {
          results.push(resultError(id, 'kylat:action_error', 'Format action tidak valid.'));
          continue;
        }
        if (!call.args || typeof call.args !== 'object' || Array.isArray(call.args)) {
          results.push(resultError(id, 'kylat:validation', 'args wajib berupa object.'));
          continue;
        }

        const key = call.idempotencyKey || req.headers['idempotency-key'] || '';
        if (call.action === 'CounterActions::saveCount') {
          if (typeof key !== 'string' || key.length < 8 || key.length > 128) {
            results.push(
              resultError(id, 'kylat:validation', 'Idempotency-Key wajib 8 sampai 128 karakter untuk mutasi.')
            );
            continue;
          }

          const hash = payloadHash(call.action, call.args);
          const existing = idempotencyStore.get(key);
          if (existing) {
            if (existing.hash !== hash) {
              results.push(
                resultError(
                  id,
                  'kylat:idempotency_conflict',
                  'Idempotency-Key sama digunakan untuk payload berbeda.'
                )
              );
              continue;
            }
            results.push({ id, ok: true, data: existing.data });
            continue;
          }

          const count = typeof call.args.count === 'number' && Number.isInteger(call.args.count) ? call.args.count : 0;
          serverSavedCount = count;
          serverMutationCount++;
          const data = {
            saved: true,
            count: serverSavedCount,
            mutationSequence: serverMutationCount,
            message: `Nilai ${serverSavedCount} berhasil disimpan di server.`,
          };
          idempotencyStore.set(key, { hash, data });
          results.push({ id, ok: true, data });
        } else {
          results.push(resultError(id, 'kylat:not_found', `Aksi '${call.action}' tidak ditemukan.`));
        }
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(JSON.stringify({ results }));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(
        JSON.stringify({
          serverSavedCount,
          serverMutationCount,
          idempotencyKeysCount: idempotencyStore.size,
        })
      );
      return;
    }

    let filePath = '';
    let contentType = 'text/html';
    if (url.pathname === '/' || url.pathname === '/index.html') {
      filePath = path.resolve(__dirname, 'index.html');
      contentType = 'text/html; charset=utf-8';
    } else if (url.pathname === '/dist/Counter.js' || url.pathname === '/Counter.js') {
      filePath = path.resolve(__dirname, 'dist/Counter.js');
      contentType = 'application/javascript; charset=utf-8';
    } else if (url.pathname.startsWith('/@kylat/runtime/')) {
      const relPath = url.pathname.replace('/@kylat/runtime/', '');
      filePath = path.resolve(__dirname, '../../packages/runtime/dist', relPath);
      contentType = 'application/javascript; charset=utf-8';
    } else if (url.pathname.startsWith('/@kylat/protocol/')) {
      const relPath = url.pathname.replace('/@kylat/protocol/', '');
      filePath = path.resolve(__dirname, '../../packages/protocol/dist', relPath);
      contentType = 'application/javascript; charset=utf-8';
    } else if (url.pathname.startsWith('/alien-signals/')) {
      const relPath = url.pathname.replace('/alien-signals/', '');
      filePath = path.resolve(__dirname, '../../packages/runtime/node_modules/alien-signals/esm', relPath);
      contentType = 'application/javascript; charset=utf-8';
    } else if (url.pathname === '/system.mjs') {
      filePath = path.resolve(__dirname, '../../packages/runtime/node_modules/alien-signals/esm/system.mjs');
      contentType = 'application/javascript; charset=utf-8';
    }

    if (filePath && fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  return {
    server,
    resetState: () => {
      serverSavedCount = 0;
      serverMutationCount = 0;
      idempotencyStore.clear();
    },
    getState: () => ({ serverSavedCount, serverMutationCount, idempotencyStore }),
  };
}

if (process.argv[1] && process.argv[1].endsWith('server.mjs')) {
  const { server } = createDemoServer();
  server.listen(PORT, () => {
    console.log(`🚀 Demo Counter Kylat berjalan di: http://localhost:${PORT}`);
    console.log(`   - Halaman Demo: http://localhost:${PORT}/`);
    console.log(`   - Endpoint RPC: http://localhost:${PORT}/_kylat/call`);
  });
}
