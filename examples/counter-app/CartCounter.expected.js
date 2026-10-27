/**
 * Kontrak Golden Tertulis Manual: CartCounter.expected.js
 * Ditulis secara independen berdasarkan spesifikasi normatif:
 * - spec/template.md §4 (Atribut proteksi aksi server: aria-busy, data-pending, disabled)
 * - spec/ir.md §3 & §8 (Inisialisasi sinyal state, props non-nullable, DOM codegen langsung)
 * - spec/threat-model.md §3.1 (Mitigasi A4: Idempotensi mutasi dengan Idempotency-Key)
 * 
 * REVIEW MANUSIA DIPERLUKAN:
 * File ini ditulis manual dan diverifikasi sebagai kontrak kebenaran (source of truth) untuk
 * menguji output @kylat/compiler. Dilarang menyalin output compiler ke file ini.
 */

import { bindAttr, bindText, callServerAction, createSignal, on } from '@kylat/runtime';

export function createCartCounter(props = {}) {
  // 1. Inisialisasi Props & State Sinyal
  const prop_productId = props["productId"] !== undefined ? props["productId"] : undefined;
  if (prop_productId === undefined || prop_productId === null) {
    throw new TypeError("Prop 'productId' wajib disertakan dan tidak boleh null untuk komponen CartCounter.");
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
  const el_div_1 = document.createElement("div");
  el_div_1.setAttribute("class", "cart-box");
  const el_button_2 = document.createElement("button");
  on(el_button_2, "click", () => increment());
  el_button_2.textContent = "+";
  el_div_1.appendChild(el_button_2);
  const el_button_3 = document.createElement("button");
  on(el_button_3, "click", () => submitOrder());
  bindAttr(el_button_3, "aria-busy", () => is_pending_submitOrder() ? "true" : null);
  bindAttr(el_button_3, "data-pending", () => is_pending_submitOrder() ? "" : null);
  bindAttr(el_button_3, "disabled", () => is_pending_submitOrder() ? "disabled" : null);
  el_button_3.textContent = "Tambah ke Keranjang";
  el_div_1.appendChild(el_button_3);
  const el_live_error_4 = document.createElement("div");
  el_live_error_4.setAttribute("aria-live", "polite");
  el_live_error_4.setAttribute("role", "status");
  bindText(el_live_error_4, () => error_submitOrder() ?? "");
  el_div_1.appendChild(el_live_error_4);
  el_div_1.setAttribute("data-kylat-component", "CartCounter");
  return el_div_1;
}

export default createCartCounter;
