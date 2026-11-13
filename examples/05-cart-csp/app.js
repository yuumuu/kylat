import { createCart } from '/dist/Cart.js';

const mount = document.getElementById('cart-mount');
mount.replaceChildren(createCart({ productId: 'sku-1' }));
