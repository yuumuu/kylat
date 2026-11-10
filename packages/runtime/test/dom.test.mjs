import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSignal } from '../dist/signals.js';
import { bindAttr, bindText } from '../dist/dom.js';

// Mock DOM HTMLElement minimal untuk lingkungan Node.js
class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.attributes = new Map();
    this.textContent = '';
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }
}

describe('@kylat/runtime - DOM Binding & Semantik bindAttr', () => {
  it('semantik bindAttr: string menetapkan atribut, null menghapus, false menghapus atribut boolean', () => {
    const el = new MockElement('button');
    const [attrVal, setAttrVal] = createSignal('active');

    // 1. Kasus Nilai String
    const unbind = bindAttr(el, 'aria-busy', attrVal);
    assert.equal(el.hasAttribute('aria-busy'), true);
    assert.equal(el.getAttribute('aria-busy'), 'active');

    // 2. Kasus Nilai null -> Atribut harus dihapus dari DOM
    setAttrVal(null);
    assert.equal(el.hasAttribute('aria-busy'), false, 'Nilai null wajib menghapus atribut dari DOM');
    assert.equal(el.getAttribute('aria-busy'), null);

    // 3. Kasus Nilai false -> Atribut boolean dihapus dari DOM
    setAttrVal('pending');
    assert.equal(el.hasAttribute('aria-busy'), true);
    setAttrVal(false);
    assert.equal(el.hasAttribute('aria-busy'), false, 'Nilai false wajib menghapus atribut dari DOM');

    // 4. Kasus Nilai true -> Atribut boolean bernilai kosong
    setAttrVal(true);
    assert.equal(el.hasAttribute('aria-busy'), true);
    assert.equal(el.getAttribute('aria-busy'), '');

    unbind();
  });

  it('semantik bindText: mengikat nilai sinyal ke textContent', () => {
    const el = new MockElement('span');
    const [count, setCount] = createSignal(0);

    const unbind = bindText(el, count);
    assert.equal(el.textContent, '0');

    setCount(5);
    assert.equal(el.textContent, '5');

    setCount(null);
    assert.equal(el.textContent, '');

    unbind();
  });

  it('semantik bindAttr untuk aria-busy, aria-invalid, dan aria-describedby: string set, null hapus, false hapus', () => {
    const el = new MockElement('input');

    // 1. aria-busy
    const [busySignal, setBusySignal] = createSignal('true');
    const unbindBusy = bindAttr(el, 'aria-busy', busySignal);
    assert.equal(el.getAttribute('aria-busy'), 'true', 'aria-busy harus bernilai "true" saat sinyal "true"');

    setBusySignal('false');
    assert.equal(el.getAttribute('aria-busy'), 'false', 'aria-busy harus bernilai "false" saat sinyal string "false"');

    setBusySignal(null);
    assert.equal(el.hasAttribute('aria-busy'), false, 'aria-busy wajib dihapus saat sinyal null');

    setBusySignal('true');
    assert.equal(el.getAttribute('aria-busy'), 'true', 'aria-busy terpasang kembali');

    setBusySignal(false);
    assert.equal(el.hasAttribute('aria-busy'), false, 'aria-busy wajib dihapus saat sinyal boolean false');
    unbindBusy();

    // 2. aria-invalid
    const [invalidSignal, setInvalidSignal] = createSignal('true');
    const unbindInvalid = bindAttr(el, 'aria-invalid', invalidSignal);
    assert.equal(el.getAttribute('aria-invalid'), 'true', 'aria-invalid harus bernilai "true" saat sinyal "true"');

    setInvalidSignal('spelling');
    assert.equal(el.getAttribute('aria-invalid'), 'spelling', 'aria-invalid harus bernilai "spelling"');

    setInvalidSignal(null);
    assert.equal(el.hasAttribute('aria-invalid'), false, 'aria-invalid wajib dihapus saat sinyal null');

    setInvalidSignal('false');
    assert.equal(el.getAttribute('aria-invalid'), 'false', 'aria-invalid harus bernilai "false" saat sinyal "false"');

    setInvalidSignal(false);
    assert.equal(el.hasAttribute('aria-invalid'), false, 'aria-invalid wajib dihapus saat sinyal boolean false');
    unbindInvalid();

    // 3. aria-describedby
    const [describedSignal, setDescribedSignal] = createSignal('err-field-1');
    const unbindDescribed = bindAttr(el, 'aria-describedby', describedSignal);
    assert.equal(el.getAttribute('aria-describedby'), 'err-field-1', 'aria-describedby harus menunjuk ID elemen penjelas');

    setDescribedSignal('err-field-1 help-field-2');
    assert.equal(el.getAttribute('aria-describedby'), 'err-field-1 help-field-2', 'aria-describedby mendukung multiple token ID');

    setDescribedSignal(null);
    assert.equal(el.hasAttribute('aria-describedby'), false, 'aria-describedby wajib dihapus saat sinyal null');

    setDescribedSignal(false);
    assert.equal(el.hasAttribute('aria-describedby'), false, 'aria-describedby wajib dihapus saat sinyal boolean false');
    unbindDescribed();
  });
});
