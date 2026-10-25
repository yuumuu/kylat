/**
 * Komponen Kylat yang dikompilasi: Counter
 * Dihasilkan secara otomatis oleh @kylat/compiler
 */

import { createSignal, createComputed, bindText, bindAttr, bindInput, on, callServerAction } from '@kylat/runtime';

export function createCounter(props = {}) {
  // 1. Inisialisasi Props & State Sinyal
  const prop_initialCount = props['initialCount'] !== undefined ? props['initialCount'] : 0;
  const [count, set_count] = createSignal(prop_initialCount ?? 0);

  // 2. Definisi Aksi & Method
  function increment() {
    set_count(count() + 1);
  }
  function decrement() {
    set_count(count() - 1);
  }
  async function syncToServer(args = {}) {
    return await callServerAction('CounterActions::saveCount', { count: count() });
  }

  // 3. Konstruksi DOM Element & Binding
  const el_div_1 = document.createElement('div');
  el_div_1.setAttribute('class', 'p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md space-y-4');
  bindText(el_div_1, () => count());
  const el_h2_2 = document.createElement('h2');
  el_h2_2.setAttribute('class', 'text-xl font-bold text-gray-900');
  el_h2_2.textContent = 'Kylat Counter Island';
  el_div_1.appendChild(el_h2_2);
  const el_button_3 = document.createElement('button');
  el_button_3.setAttribute('class', 'px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded');
  on(el_button_3, 'click', () => decrement());
  el_button_3.textContent = '-';
  el_div_1.appendChild(el_button_3);
  const el_span_4 = document.createElement('span');
  el_span_4.setAttribute('class', 'text-2xl font-mono');
  bindText(el_span_4, () => count());
  el_div_1.appendChild(el_span_4);
  const el_button_5 = document.createElement('button');
  el_button_5.setAttribute('class', 'px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded');
  on(el_button_5, 'click', () => increment());
  el_button_5.textContent = '+';
  el_div_1.appendChild(el_button_5);
  el_div_1.setAttribute('data-kylat-component', 'Counter');
  return el_div_1;
}

export default createCounter;
