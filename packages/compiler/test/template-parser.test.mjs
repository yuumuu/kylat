import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseTemplate } from '../dist/template-parser.js';

describe('@kylat/compiler - Template Parser Edge Cases', () => {
  it('1. menangani tag void (<input>, <br>, <img>) tanpa penutup', () => {
    const template = `<div><input type="text" name="username"><br><img src="/logo.png"></div>`;
    const elements = parseTemplate(template);

    assert.equal(elements.length, 1);
    const div = elements[0];
    assert.equal(div.tag, 'div');
    assert.equal(div.children.length, 3);
    assert.equal(div.children[0].tag, 'input');
    assert.equal(div.children[0].attributes.type, 'text');
    assert.equal(div.children[1].tag, 'br');
    assert.equal(div.children[2].tag, 'img');
  });

  it('2. menangani atribut yang memuat karakter > di dalam tanda kutip', () => {
    const template = `<button title="Next > Proceed" data-rule="x > 5">Next</button>`;
    const elements = parseTemplate(template);

    assert.equal(elements.length, 1);
    const btn = elements[0];
    assert.equal(btn.attributes.title, 'Next > Proceed');
    assert.equal(btn.attributes['data-rule'], 'x > 5');
    assert.equal(btn.textContent, 'Next');
  });

  it('3. mengabaikan komentar HTML <!-- ... -->', () => {
    const template = `<div><!-- Komentar rahasia --><span>Halo</span><!-- Komentar akhir --></div>`;
    const elements = parseTemplate(template);

    assert.equal(elements.length, 1);
    assert.equal(elements[0].children.length, 1);
    assert.equal(elements[0].children[0].tag, 'span');
    assert.equal(elements[0].children[0].textContent, 'Halo');
  });

  it('4. menangani tag self-closing <x-nama />', () => {
    const template = `<main><x-counter :initial-count="10" /><x-alert type="warning" /></main>`;
    const elements = parseTemplate(template);

    assert.equal(elements.length, 1);
    assert.equal(elements[0].children.length, 2);
    assert.equal(elements[0].children[0].tag, 'x-counter');
    assert.equal(elements[0].children[0].attributes[':initial-count'], '10');
    assert.equal(elements[0].children[1].tag, 'x-alert');
    assert.equal(elements[0].children[1].attributes.type, 'warning');
  });

  it('5. menangani tag bersarang dengan nama tag yang sama (div di dalam div)', () => {
    const template = `<div id="outer"><div id="inner"><span>Teks</span></div></div>`;
    const elements = parseTemplate(template);

    assert.equal(elements.length, 1);
    const outer = elements[0];
    assert.equal(outer.attributes.id, 'outer');
    assert.equal(outer.children.length, 1);
    const inner = outer.children[0];
    assert.equal(inner.attributes.id, 'inner');
    assert.equal(inner.children.length, 1);
    assert.equal(inner.children[0].tag, 'span');
    assert.equal(inner.children[0].textContent, 'Teks');
  });

  it('6. mendeteksi penutup yang tidak cocok dan melempar KIL-151 (fail-fast)', () => {
    const template = `<div><span>Teks</div></span>`;
    assert.throws(
      () => {
        parseTemplate(template);
      },
      (err) => {
        return (
          err instanceof Error &&
          err.message.includes('KIL-151') &&
          err.message.includes('tidak cocok')
        );
      },
      'Wajib melempar galat KIL-151 jika tag penutup tidak cocok'
    );
  });

  it('7. mendeteksi tag yang tidak ditutup dan melempar KIL-151 (fail-fast)', () => {
    const template = `<div><span>Teks</div>`;
    assert.throws(
      () => {
        parseTemplate(template);
      },
      (err) => {
        return (
          err instanceof Error &&
          err.message.includes('KIL-151') &&
          err.message.includes('tidak cocok')
        );
      },
      'Wajib melempar galat KIL-151 jika tag tidak ditutup'
    );
  });
});
