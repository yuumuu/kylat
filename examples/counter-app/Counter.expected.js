/**
 * Human-Authored Golden File: Counter.expected.js
 * Ditinjau dan diverifikasi secara independen sebagai kontrak uji output @kylat/compiler.
 */

import { bindAttr, bindText, callServerAction, createSignal, on } from '@kylat/runtime';

export function createCounter(props = {}) {
  // 1. Inisialisasi Props & State Sinyal
  const prop_initialCount = props["initialCount"] !== undefined ? props["initialCount"] : 0;
  const [count, set_count] = createSignal(prop_initialCount);
  const [is_pending_syncToServer, set_is_pending_syncToServer] = createSignal(false);
  const [error_syncToServer, set_error_syncToServer] = createSignal(null);
  let current_idemp_syncToServer = null;

  // 2. Definisi Aksi & Method
  function increment() {
    set_count(count() + 1);
  }
  function decrement() {
    set_count(count() - 1);
  }
  async function syncToServer(args = {}) {
    set_is_pending_syncToServer(true);
    set_error_syncToServer(null);
    try {
      current_idemp_syncToServer ??= "idemp_" + Date.now();
      const res = await callServerAction("CounterActions::saveCount", { count: count() }, { idempotencyKey: current_idemp_syncToServer });
      current_idemp_syncToServer = null;
      return res;
    } catch (err) {
      set_error_syncToServer(err instanceof Error ? err.message : String(err));
    } finally {
      set_is_pending_syncToServer(false);
    }
  }

  // 3. Konstruksi DOM Element & Binding
  const el_div_1 = document.createElement("div");
  el_div_1.setAttribute("class", "p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md space-y-4");
  const el_h2_2 = document.createElement("h2");
  el_h2_2.setAttribute("class", "text-xl font-bold text-gray-900");
  el_h2_2.textContent = "Kylat Counter Island";
  el_div_1.appendChild(el_h2_2);
  const el_div_3 = document.createElement("div");
  el_div_3.setAttribute("class", "flex items-center space-x-4");
  const el_button_4 = document.createElement("button");
  el_button_4.setAttribute("class", "px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded");
  on(el_button_4, "click", () => decrement());
  el_button_4.textContent = "-";
  el_div_3.appendChild(el_button_4);
  const el_span_5 = document.createElement("span");
  el_span_5.setAttribute("class", "text-2xl font-mono");
  bindText(el_span_5, () => count());
  el_div_3.appendChild(el_span_5);
  const el_button_6 = document.createElement("button");
  el_button_6.setAttribute("class", "px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded");
  on(el_button_6, "click", () => increment());
  el_button_6.textContent = "+";
  el_div_3.appendChild(el_button_6);
  el_div_1.appendChild(el_div_3);
  const el_div_7 = document.createElement("div");
  const el_button_8 = document.createElement("button");
  el_button_8.setAttribute("class", "w-full mt-2 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium");
  on(el_button_8, "click", () => syncToServer());
  bindAttr(el_button_8, "aria-busy", () => is_pending_syncToServer() ? "true" : null);
  bindAttr(el_button_8, "data-pending", () => is_pending_syncToServer() ? "" : null);
  bindAttr(el_button_8, "disabled", () => is_pending_syncToServer() ? "disabled" : null);
  el_button_8.textContent = "Simpan ke Server (RPC)";
  el_div_7.appendChild(el_button_8);
  el_div_1.appendChild(el_div_7);
  const el_live_error_9 = document.createElement("div");
  el_live_error_9.setAttribute("aria-live", "polite");
  el_live_error_9.setAttribute("role", "status");
  bindText(el_live_error_9, () => error_syncToServer() ?? "");
  el_div_1.appendChild(el_live_error_9);
  el_div_1.setAttribute("data-kylat-component", "Counter");
  return el_div_1;
}

export default createCounter;
