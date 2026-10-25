import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RpcBatcher, KylatRpcError } from '../dist/index.js';

describe('@kylat/runtime - Batch RPC Dispatcher', () => {
  it('menggabungkan pemanggilan multiple dalam satu microtask ke 1 request HTTP batch', async () => {
    let capturedRequest = null;
    let requestCount = 0;

    const mockFetch = async (url, options) => {
      requestCount++;
      capturedRequest = {
        url,
        headers: options.headers,
        body: JSON.parse(options.body),
      };

      // Balas dengan respon batch sukses untuk tiap call id
      const results = capturedRequest.body.calls.map((c) => ({
        id: c.id,
        ok: true,
        data: { receivedAction: c.action, receivedArgs: c.args },
      }));

      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ results }),
      };
    };

    const batcher = new RpcBatcher({
      endpoint: '/_kylat/call',
      buildId: 'test-build-123',
      csrfToken: 'csrf-secret-abc',
      fetchFn: mockFetch,
    });

    // Panggil 3 aksi secara simultan dalam microtask yang sama
    const p1 = batcher.call('CartActions::add', { itemId: 'item_1', qty: 2 });
    const p2 = batcher.call('CartActions::add', { itemId: 'item_2', qty: 1 });
    const p3 = batcher.call('CounterActions::increment', { step: 5 });

    const [res1, res2, res3] = await Promise.all([p1, p2, p3]);

    // Verifikasi hanya 1 request HTTP dilakukan
    assert.equal(requestCount, 1);
    assert.equal(capturedRequest.url, '/_kylat/call');
    assert.equal(capturedRequest.headers['X-CSRF-Token'], 'csrf-secret-abc');
    assert.equal(capturedRequest.headers['X-Kylat-Build'], 'test-build-123');
    assert.equal(capturedRequest.body.calls.length, 3);

    assert.equal(res1.receivedAction, 'CartActions::add');
    assert.equal(res1.receivedArgs.itemId, 'item_1');
    assert.equal(res2.receivedAction, 'CartActions::add');
    assert.equal(res3.receivedAction, 'CounterActions::increment');
    assert.equal(res3.receivedArgs.step, 5);
  });

  it('memisahkan request jika batch melebihi batas 20 calls', async () => {
    let requestCount = 0;
    const callsPerRequest = [];

    const mockFetch = async (url, options) => {
      requestCount++;
      const body = JSON.parse(options.body);
      callsPerRequest.push(body.calls.length);

      const results = body.calls.map((c) => ({
        id: c.id,
        ok: true,
        data: c.id,
      }));

      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ results }),
      };
    };

    const batcher = new RpcBatcher({
      fetchFn: mockFetch,
    });

    // Panggil 25 aksi dalam 1 antrean
    const promises = [];
    for (let i = 0; i < 25; i++) {
      promises.push(batcher.call('Action::ping', { index: i }));
    }

    await Promise.all(promises);

    // Harus terbagi menjadi 2 HTTP requests: batch 1 berisi 20, batch 2 berisi 5
    assert.equal(requestCount, 2);
    assert.deepEqual(callsPerRequest, [20, 5]);
  });

  it('menangani kegagalan aksi individual dengan KylatRpcError', async () => {
    const mockFetch = async (url, options) => {
      const body = JSON.parse(options.body);
      const results = body.calls.map((c) => {
        if (c.action === 'FailingAction') {
          return {
            id: c.id,
            ok: false,
            error: {
              type: 'kylat:validation',
              message: 'Jumlah item tidak valid',
            },
          };
        }
        return {
          id: c.id,
          ok: true,
          data: 'ok',
        };
      });

      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ results }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });

    const pSuccess = batcher.call('SuccessAction');
    const pFailure = batcher.call('FailingAction');

    const successRes = await pSuccess;
    assert.equal(successRes, 'ok');

    await assert.rejects(
      async () => {
        await pFailure;
      },
      (err) => {
        assert(err instanceof KylatRpcError);
        assert.equal(err.message, 'Jumlah item tidak valid');
        assert.equal(err.code, 'kylat:validation');
        return true;
      }
    );
  });

  it('menangani RFC 9457 Problem Details ketika endpoint error (misal 422)', async () => {
    const mockFetch = async () => {
      return {
        ok: false,
        status: 422,
        headers: new Headers({ 'content-type': 'application/problem+json' }),
        json: async () => ({
          type: 'https://kylat.dev/errors/422',
          title: 'Unprocessable Entity',
          status: 422,
          detail: 'Payload batch melanggar skema atau validasi CSRF',
        }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });

    await assert.rejects(
      async () => {
        await batcher.call('SomeAction');
      },
      (err) => {
        assert(err instanceof KylatRpcError);
        assert.equal(err.code, 'HTTP_422');
        assert.equal(err.message, 'Payload batch melanggar skema atau validasi CSRF');
        return true;
      }
    );
  });

  it('mengirim Idempotency-Key pada header HTTP dan per-call payload serta mendukung retry dengan key yang sama', async () => {
    const capturedRequests = [];
    let shouldFailFirst = true;

    const mockFetch = async (url, options) => {
      const body = JSON.parse(options.body);
      capturedRequests.push({
        url,
        headers: options.headers,
        body,
      });

      if (shouldFailFirst) {
        shouldFailFirst = false;
        return {
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Service Temporarily Unavailable' }),
        };
      }

      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: body.calls.map((c) => ({
            id: c.id,
            ok: true,
            data: { saved: true, key: c.idempotencyKey },
          })),
        }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });
    const idempKey = 'idemp_test_retry_123';

    // Panggilan 1: Gagal (503)
    await assert.rejects(
      async () => {
        await batcher.call('CounterActions::saveCount', { count: 10 }, { idempotencyKey: idempKey });
      },
      (err) => {
        assert(err instanceof KylatRpcError);
        assert.equal(err.code, 'HTTP_503');
        return true;
      }
    );

    // Verifikasi request 1 memuat idempotencyKey
    assert.equal(capturedRequests.length, 1);
    assert.equal(capturedRequests[0].headers['Idempotency-Key'], idempKey);
    assert.equal(capturedRequests[0].body.calls[0].idempotencyKey, idempKey);

    // Panggilan 2: Retry dengan key yang SAMA persis
    const res = await batcher.call('CounterActions::saveCount', { count: 10 }, { idempotencyKey: idempKey });
    assert.deepEqual(res, { saved: true, key: idempKey });

    // Verifikasi request 2 memuat idempotencyKey yang sama
    assert.equal(capturedRequests.length, 2);
    assert.equal(capturedRequests[1].headers['Idempotency-Key'], idempKey);
    assert.equal(capturedRequests[1].body.calls[0].idempotencyKey, idempKey);
  });
});
