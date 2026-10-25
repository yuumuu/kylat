import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createSignal, createComputed, createEffect } from '../dist/index.js';

describe('@kylat/runtime - Signals Reactivity', () => {
  it('dapat membuat dan membaca sinyal dasar', () => {
    const [count, setCount] = createSignal(10);
    assert.equal(count(), 10);

    setCount(25);
    assert.equal(count(), 25);
  });

  it('dapat membuat sinyal terkomputasi (computed) otomatis update', () => {
    const [firstName, setFirstName] = createSignal('Ahmad');
    const [lastName, setLastName] = createSignal('Dahlan');
    const fullName = createComputed(() => `${firstName()} ${lastName()}`);

    assert.equal(fullName(), 'Ahmad Dahlan');

    setLastName('Haidar');
    assert.equal(fullName(), 'Ahmad Haidar');

    setFirstName('Ali');
    assert.equal(fullName(), 'Ali Haidar');
  });

  it('menjalankan efek samping reaktif dan membersihkannya saat dihentikan', () => {
    const [count, setCount] = createSignal(0);
    const history = [];

    const stopEffect = createEffect(() => {
      history.push(count());
    });

    assert.deepEqual(history, [0]);

    setCount(1);
    assert.deepEqual(history, [0, 1]);

    setCount(2);
    assert.deepEqual(history, [0, 1, 2]);

    stopEffect();

    setCount(3);
    // Setelah stop, tidak ada lagi trigger
    assert.deepEqual(history, [0, 1, 2]);
  });

  it('glitch-free diamond dependency evaluation', () => {
    // diamond problem: A -> B, A -> C, D = B + C
    const [a, setA] = createSignal(1);
    const b = createComputed(() => a() * 2);
    const c = createComputed(() => a() * 10);
    let dEvaluations = 0;
    const d = createComputed(() => {
      dEvaluations++;
      return b() + c();
    });

    assert.equal(d(), 12);
    assert.equal(dEvaluations, 1);

    setA(2);
    assert.equal(d(), 24);
    assert.equal(dEvaluations, 2); // Hanya evaluasi sekali per perubahan a, tidak glitch
  });
});
