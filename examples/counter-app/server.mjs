/**
 * server.mjs - Server HTTP & RPC Backend untuk Demo End-to-End Counter
 * 
 * Melayani:
 * 1. Static HTML demo (index.html)
 * 2. Modul frontend (@kylat/runtime dan dist/Counter.js)
 * 3. Endpoint POST /_kylat/call dengan kontrak protokol idempotensi §3.1
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// State Server Persisten (Simulasi Database Server)
let serverSavedCount = 0;
let serverMutationCount = 0;

// Penyimpanan Idempotensi (In-Memory Idempotency Store sesuai spec/threat-model.md §3.1)
// key: idempotencyKey -> { hash, response, createdAt }
const idempotencyStore = new Map();

export function createDemoServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key, X-Kylat-Build');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    // 1. Endpoint RPC Batch: POST /_kylat/call
    if (req.method === 'POST' && url.pathname === '/_kylat/call') {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('application/json')) {
        res.writeHead(415, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({
          type: 'https://kylat.dev/errors/unsupported_media_type',
          title: 'Unsupported Media Type',
          status: 415,
          detail: 'Content-Type wajib application/json'
        }));
        return;
      }

      const idempKey = req.headers['idempotency-key'];
      // Kontrak §3.1 Aturan 1: Mutasi wajib membawa Idempotency-Key (8 s/d 128 karakter)
      if (idempKey && (idempKey.length < 8 || idempKey.length > 128)) {
        res.writeHead(400, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({
          type: 'https://kylat.dev/errors/invalid_idempotency_key',
          title: 'Invalid Idempotency Key',
          status: 400,
          detail: 'Panjang Idempotency-Key wajib 8 sampai 128 karakter.'
        }));
        return;
      }

      let bodyText = '';
      for await (const chunk of req) {
        bodyText += chunk;
      }

      let payload;
      try {
        payload = JSON.parse(bodyText);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({
          type: 'https://kylat.dev/errors/invalid_json',
          title: 'Bad Request',
          status: 400,
          detail: 'Payload JSON tidak valid'
        }));
        return;
      }

      const calls = Array.isArray(payload.calls) ? payload.calls : [];
      if (calls.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/problem+json' });
        res.end(JSON.stringify({
          type: 'https://kylat.dev/errors/empty_batch',
          title: 'Empty Batch',
          status: 400,
          detail: 'Calls array tidak boleh kosong'
        }));
        return;
      }

      // Hitung SHA-256 hash payload kanonikal untuk Idempotensi (§3.1 Aturan 3)
      const payloadHash = crypto.createHash('sha256').update(JSON.stringify(calls)).digest('hex');

      if (idempKey) {
        const existing = idempotencyStore.get(idempKey);
        if (existing) {
          // Aturan 3: Key sama dengan hash berbeda ditolak kylat:idempotency_conflict
          if (existing.hash !== payloadHash) {
            res.writeHead(409, { 'Content-Type': 'application/problem+json' });
            res.end(JSON.stringify({
              type: 'https://kylat.dev/errors/idempotency_conflict',
              title: 'Idempotency Conflict',
              status: 409,
              detail: 'kylat:idempotency_conflict - Idempotency-Key sama digunakan dengan payload berbeda.'
            }));
            return;
          }

          // Aturan 4: Permintaan ulang dengan key dan hash sama mengembalikan hasil cache tanpa mengeksekusi ulang
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'X-Kylat-Idempotency-Replay': 'true'
          });
          res.end(JSON.stringify(existing.response));
          return;
        }
      }

      // Eksekusi aksi batch
      const results = [];
      for (const call of calls) {
        const { action, args, callId = 'call-1' } = call;

        if (action === 'CounterActions::saveCount') {
          const countVal = typeof args?.count === 'number' ? args.count : 0;
          serverSavedCount = countVal;
          serverMutationCount++;

          results.push({
            callId,
            status: 'success',
            data: {
              saved: true,
              count: serverSavedCount,
              mutationSequence: serverMutationCount,
              message: `Nilai ${serverSavedCount} berhasil disimpan di server.`
            }
          });
        } else {
          results.push({
            callId,
            status: 'error',
            error: {
              code: 'kylat:action_not_found',
              message: `Aksi server '${action}' tidak ditemukan.`
            }
          });
        }
      }

      const responsePayload = { results };

      if (idempKey) {
        idempotencyStore.set(idempKey, {
          hash: payloadHash,
          response: responsePayload,
          createdAt: Date.now()
        });
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responsePayload));
      return;
    }

    // 2. Endpoint Debug State: GET /api/state
    if (req.method === 'GET' && url.pathname === '/api/state') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        serverSavedCount,
        serverMutationCount,
        idempotencyKeysCount: idempotencyStore.size
      }));
      return;
    }

    // 3. Static Files: HTML & JavaScript Module Loading
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
    }

    if (filePath && fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    // 404 Fallback
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
    getState: () => ({ serverSavedCount, serverMutationCount, idempotencyStore })
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
