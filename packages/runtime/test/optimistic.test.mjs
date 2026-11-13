import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RpcBatcher, beginOptimistic, createSignal, withOptimistic } from '../dist/index.js';

function batchResponse(options, makeResult) {
  const body = JSON.parse(options.body);
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => ({ results: body.calls.map((call) => makeResult(call)) }),
  };
}

describe('@kylat/runtime - optimistic update dan rollback', () => {
  it('beginOptimistic menerapkan nilai segera dan rollback mengembalikan snapshot', () => {
    const [get, set] = createSignal(10);
    const tx = beginOptimistic(get, set, 11);

    assert.equal(get(), 11, 'nilai optimistis harus langsung terlihat');
    assert.equal(tx.settled, false);

    tx.rollback();
    assert.equal(get(), 10, 'rollback harus mengembalikan nilai sebelumnya');
    assert.equal(tx.settled, true);
  });

  it('commit mempertahankan nilai optimistis atau merekonsiliasi nilai server', () => {
    const [get, set] = createSignal(3);

    const keep = beginOptimistic(get, set, 4);
    keep.commit();
    assert.equal(get(), 4, 'commit tanpa argumen mempertahankan nilai optimistis');

    const reconcile = beginOptimistic(get, set, 5);
    reconcile.commit(99);
    assert.equal(get(), 99, 'commit(value) memakai nilai server');
  });

  it('commit/rollback kedua tidak berefek (idempoten)', () => {
    const [get, set] = createSignal(1);
    const tx = beginOptimistic(get, set, 2);

    tx.rollback();
    tx.commit(50);
    tx.rollback();
    assert.equal(get(), 1, 'transaksi yang sudah settle tidak boleh berubah lagi');
  });

  it('withOptimistic mempertahankan nilai bila server mengembalikan undefined', async () => {
    const [get, set] = createSignal(0);
    const result = await withOptimistic(get, set, 1, async () => undefined);

    assert.equal(result, undefined);
    assert.equal(get(), 1);
  });

  it('withOptimistic merekonsiliasi nilai server dan rollback saat gagal', async () => {
    const [get, set] = createSignal(0);

    const value = await withOptimistic(get, set, 10, async () => 42);
    assert.equal(value, 42);
    assert.equal(get(), 42);

    const [get2, set2] = createSignal('lama');
    await assert.rejects(
      withOptimistic(get2, set2, 'sementara', async () => {
        throw new Error('server down');
      }),
      /server down/
    );
    assert.equal(get2(), 'lama', 'kegagalan harus rollback ke nilai sebelumnya');
  });

  it('RpcBatcher menjalankan optimistic.apply sebelum fetch dan rollback saat call gagal', async () => {
    const events = [];
    let resolveFetch;

    const batcher = new RpcBatcher({
      fetchFn: (url, options) =>
        new Promise((resolve) => {
          resolveFetch = () =>
            resolve(
              batchResponse(options, (call) => ({
                id: call.id,
                ok: false,
                error: { type: 'kylat:server_error', message: 'gagal' },
              }))
            );
        }),
    });

    const promise = batcher.call(
      'CartActions::add',
      { qty: 1 },
      {
        idempotencyKey: 'idem-optimistic-test',
        optimistic: {
          apply: () => events.push('apply'),
          rollback: () => events.push('rollback'),
        },
      }
    );

    assert.deepEqual(events, ['apply'], 'apply harus sinkron sebelum request');

    await Promise.resolve();
    resolveFetch();

    await assert.rejects(promise, /gagal/);
    assert.deepEqual(events, ['apply', 'rollback'], 'rollback tepat sekali saat gagal');
  });

  it('RpcBatcher tidak rollback saat call sukses', async () => {
    const events = [];
    const batcher = new RpcBatcher({
      fetchFn: async (url, options) =>
        batchResponse(options, (call) => ({ id: call.id, ok: true, data: { saved: true } })),
    });

    const result = await batcher.call(
      'CartActions::add',
      { qty: 1 },
      {
        idempotencyKey: 'idem-optimistic-ok',
        optimistic: {
          apply: () => events.push('apply'),
          rollback: () => events.push('rollback'),
        },
      }
    );

    assert.deepEqual(result, { saved: true });
    assert.deepEqual(events, ['apply'], 'sukses tidak boleh rollback');
  });

  it('RpcBatcher rollback bila optimistic.apply melempar error', async () => {
    const events = [];
    const batcher = new RpcBatcher({
      fetchFn: async (url, options) => batchResponse(options, (call) => ({ id: call.id, ok: true, data: {} })),
    });

    await assert.rejects(
      batcher.call('CartActions::add', {}, {
        optimistic: {
          apply: () => {
            events.push('apply');
            throw new Error('apply gagal');
          },
          rollback: () => events.push('rollback'),
        },
      }),
      /apply gagal/
    );

    assert.deepEqual(events, ['apply', 'rollback']);
  });
});
