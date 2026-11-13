import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { clearIslands, registerIsland, updateIslandFactory } from '../dist/index.js';

class FakeElement {
  constructor(attributes = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.children = [];
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  replaceChildren(node) {
    this.children = [node];
  }
}

function nodeFor(text) {
  return { textContent: text };
}

describe('@kylat/runtime - HMR updateIslandFactory', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    clearIslands();
  });

  afterEach(() => {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
    clearIslands();
  });

  it('mengganti factory dan merender ulang semua elemen island yang cocok', () => {
    const first = new FakeElement({ 'data-island': 'Counter', 'data-props': '{"initialCount":3}' });
    const second = new FakeElement({ 'data-island': 'Counter' });
    const other = new FakeElement({ 'data-island': 'Cart' });

    globalThis.document = { querySelectorAll: () => [first, second, other] };

    registerIsland('Counter', () => nodeFor('lama'));
    const seen = [];
    const updated = updateIslandFactory('Counter', (props) => {
      seen.push(props);
      return nodeFor('baru');
    });

    assert.equal(updated, 2);
    assert.equal(first.children[0].textContent, 'baru');
    assert.equal(second.children[0].textContent, 'baru');
    assert.equal(other.children.length, 0, 'island lain tidak boleh disentuh');
    assert.deepEqual(seen, [{ initialCount: 3 }, {}]);
    assert.equal(first.getAttribute('data-kylat-hydrated'), 'true');
  });

  it('mengembalikan 0 bila tidak ada elemen yang cocok', () => {
    globalThis.document = { querySelectorAll: () => [] };
    assert.equal(updateIslandFactory('Missing', () => nodeFor('x')), 0);
  });
});
