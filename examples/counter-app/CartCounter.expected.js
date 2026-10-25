/**
 * Human-Authored Golden File: CartCounter.expected.js
 * Ditinjau dan diverifikasi secara independen sebagai kontrak uji output @kylat/compiler untuk CartCounter.
 */

import { bindText, callServerAction, createSignal } from '@kylat/runtime';

export function createCartCounter(props = {}) {
  // 1. Inisialisasi Props & State Sinyal
  const prop_productId = props["productId"] !== undefined ? props["productId"] : undefined;
  if (prop_productId === undefined) {
    throw new TypeError("Prop 'productId' wajib disertakan untuk komponen CartCounter.");
  }
  const [qty, set_qty] = createSignal(1);
  const [is_pending_submitOrder, set_is_pending_submitOrder] = createSignal(false);
  const [error_submitOrder, set_error_submitOrder] = createSignal(null);
  let current_idemp_submitOrder = null;
  let last_args_submitOrder = null;

  // 2. Definisi Aksi & Method
  function increment() {
    set_qty(qty() + 1);
  }
  async function submitOrder(args = {}) {
    set_is_pending_submitOrder(true);
    set_error_submitOrder(null);
    try {
      const current_payload_submitOrder = JSON.stringify({ productId: prop_productId, qty: qty() });
      if (current_idemp_submitOrder === null || last_args_submitOrder !== current_payload_submitOrder) {
        current_idemp_submitOrder = "idemp_" + Date.now();
        last_args_submitOrder = current_payload_submitOrder;
      }
      const res = await callServerAction("CartActions::add", { productId: prop_productId, qty: qty() }, { idempotencyKey: current_idemp_submitOrder });
      current_idemp_submitOrder = null;
      last_args_submitOrder = null;
      return res;
    } catch (err) {
      set_error_submitOrder(err instanceof Error ? err.message : String(err));
    } finally {
      set_is_pending_submitOrder(false);
    }
  }

  // 3. Konstruksi DOM Element & Binding
  const root = document.createElement("div");
  const el_live_error_1 = document.createElement("div");
  el_live_error_1.setAttribute("aria-live", "polite");
  el_live_error_1.setAttribute("role", "status");
  bindText(el_live_error_1, () => error_submitOrder() ?? "");
  root.appendChild(el_live_error_1);
  root.setAttribute("data-kylat-component", "CartCounter");
  return root;
}

export default createCartCounter;
