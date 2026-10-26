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

  it('melakukan auto-retry otomatis pada error 503 transient saat memiliki Idempotency-Key', async () => {
    const capturedRequests = [];
    let attempts = 0;

    const mockFetch = async (url, options) => {
      attempts++;
      const body = JSON.parse(options.body);
      capturedRequests.push({
        url,
        headers: options.headers,
        body,
      });

      if (attempts === 1) {
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

    // Panggilan dengan idempotencyKey: otomatis auto-retry saat 503 dan sukses di attempt ke-2
    const result = await batcher.call('CounterActions::saveCount', { count: 10 }, { idempotencyKey: idempKey });
    assert.deepEqual(result, { saved: true, key: idempKey });

    // Verifikasi terjadi 2 request otomatis dengan key yang SAMA
    assert.equal(capturedRequests.length, 2);
    assert.equal(capturedRequests[0].headers['Idempotency-Key'], idempKey);
    assert.equal(capturedRequests[1].headers['Idempotency-Key'], idempKey);
    assert.equal(capturedRequests[0].body.calls[0].idempotencyKey, idempKey);
    assert.equal(capturedRequests[1].body.calls[0].idempotencyKey, idempKey);
  });

  it('tidak melakukan auto-retry untuk panggilan tanpa Idempotency-Key saat terjadi error 503', async () => {
    let attempts = 0;
    const mockFetch = async () => {
      attempts++;
      return {
        ok: false,
        status: 503,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Service Temporarily Unavailable' }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });

    await assert.rejects(
      async () => {
        await batcher.call('CounterActions::readOnlyAction', { x: 1 });
      },
      (err) => {
        assert(err instanceof KylatRpcError);
        assert.equal(err.code, 'HTTP_503');
        return true;
      }
    );

    // Tanpa idempotency key, hanya dipanggil 1 kali tanpa auto-retry
    assert.equal(attempts, 1);
  });

  it('tidak melakukan retry untuk error deterministik HTTP 500 meskipun memiliki Idempotency-Key', async () => {
    let attempts = 0;
    const mockFetch = async () => {
      attempts++;
      return {
        ok: false,
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'Internal Server Error (Deterministic Bug)' }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });

    await assert.rejects(
      async () => {
        await batcher.call('CounterActions::buggyAction', {}, { idempotencyKey: 'idemp_bug_500' });
      },
      (err) => {
        assert(err instanceof KylatRpcError);
        assert.equal(err.code, 'HTTP_500');
        return true;
      }
    );

    // Error 500 tidak transient, tidak boleh membuang beban server dengan re-attempt
    assert.equal(attempts, 1);
  });

  it('otomatis melakukan retry saat menerima respons kylat:in_progress hingga operasi selesai', async () => {
    let attempts = 0;
    const mockFetch = async (url, options) => {
      attempts++;
      const body = JSON.parse(options.body);

      if (attempts === 1) {
        // Percobaan 1: Server merespons bahwa aksi sedang berjalan (in_progress)
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            results: body.calls.map((c) => ({
              id: c.id,
              ok: false,
              error: {
                type: 'kylat:in_progress',
                message: 'Operasi sedang diproses di server.',
              },
            })),
          }),
        };
      }

      // Percobaan 2 (retry): Operasi terdahulu sudah selesai, kembalikan hasil
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: body.calls.map((c) => ({
            id: c.id,
            ok: true,
            data: { success: true, count: 42 },
          })),
        }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });
    const res = await batcher.call('CounterActions::longOperation', {}, { idempotencyKey: 'idemp_long_op_99' });

    assert.deepEqual(res, { success: true, count: 42 });
    assert.equal(attempts, 2, 'Harus otomatis melakukan retry setelah menerima kylat:in_progress');
  });

  it('otomatis melakukan retry berkali-kali saat in_progress bertahan beberapa kali melebihi budget 5xx', async () => {
    let attempts = 0;
    const mockFetch = async (url, options) => {
      attempts++;
      const body = JSON.parse(options.body);

      // in_progress bertahan sebanyak 5 kali berturut-turut (jauh di atas budget 5xx yang hanya 2 kali)
      if (attempts <= 5) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            results: body.calls.map((c) => ({
              id: c.id,
              ok: false,
              error: {
                type: 'kylat:in_progress',
                message: `Operasi sedang diproses (percobaan ${attempts}).`,
              },
            })),
          }),
        };
      }

      // Percobaan ke-6 akhirnya selesai
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: body.calls.map((c) => ({
            id: c.id,
            ok: true,
            data: { success: true, count: 100 },
          })),
        }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });
    const res = await batcher.call(
      'CounterActions::multiProgress',
      {},
      {
        idempotencyKey: 'idemp_multi_in_progress',
        retryDelayFn: () => 5, // 5 ms agar pengujian cepat
      }
    );

    assert.deepEqual(res, { success: true, count: 100 });
    assert.equal(attempts, 6, 'Harus berhasil menyelesaikan operasi setelah 5 kali in_progress');
  });

  it('memisahkan budget retry 5xx transient dari budget in_progress', async () => {
    let attempts = 0;
    const mockFetch = async (url, options) => {
      attempts++;
      const body = JSON.parse(options.body);

      // Percobaan 1, 2, 3: in_progress (menghabiskan 3 kuota in_progress, melebihi kuota 5xx yang default 2)
      if (attempts <= 3) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            results: body.calls.map((c) => ({
              id: c.id,
              ok: false,
              error: {
                type: 'kylat:in_progress',
                message: 'Sedang berjalan di server.',
              },
            })),
          }),
        };
      }

      // Percobaan 4: transient 503 error (menggunakan kuota 5xx ke-1)
      if (attempts === 4) {
        return {
          ok: false,
          status: 503,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ message: 'Service Temporarily Unavailable' }),
        };
      }

      // Percobaan 5: akhirnya selesai
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: body.calls.map((c) => ({
            id: c.id,
            ok: true,
            data: { separatedBudgetsVerified: true },
          })),
        }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });
    const res = await batcher.call(
      'CounterActions::separatedBudgets',
      {},
      {
        idempotencyKey: 'idemp_sep_budget',
        retryDelayFn: () => 5,
      }
    );

    assert.deepEqual(res, { separatedBudgetsVerified: true });
    assert.equal(attempts, 5, 'Harus berhasil menggabungkan retry in_progress dan retry 5xx secara independen');
  });

  it('menolak dengan kylat:in_progress jika seluruh kuota in_progress habis', async () => {
    let attempts = 0;
    const mockFetch = async (url, options) => {
      attempts++;
      const body = JSON.parse(options.body);
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          results: body.calls.map((c) => ({
            id: c.id,
            ok: false,
            error: {
              type: 'kylat:in_progress',
              message: 'Operasi macet di server.',
            },
          })),
        }),
      };
    };

    const batcher = new RpcBatcher({ fetchFn: mockFetch });
    await assert.rejects(
      async () => {
        await batcher.call(
          'CounterActions::stuckOperation',
          {},
          {
            idempotencyKey: 'idemp_stuck',
            inProgressRetries: 3, // Kuota 3 kali retry
            retryDelayFn: () => 5,
          }
        );
      },
      (err) => {
        assert(err instanceof KylatRpcError);
        assert.equal(err.code, 'kylat:in_progress');
        assert.equal(err.message, 'Operasi macet di server.');
        return true;
      }
    );

    // 1 pemanggilan awal + 3 retries = 4 attempts total
    assert.equal(attempts, 4);
  });
});
