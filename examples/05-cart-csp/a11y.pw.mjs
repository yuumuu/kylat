import { test, expect } from '@playwright/test';
import { createDemoServer } from './server.mjs';

let server;
let baseUrl;

test.beforeAll(async () => {
  const demo = createDemoServer();
  server = demo.server;

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

test.afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('keyboard-only: Tab, Enter, dan Space mengoperasikan keranjang', async ({ page }) => {
  await page.goto(baseUrl);

  const add = page.getByRole('button', { name: 'Tambah' });
  const submit = page.getByRole('button', { name: 'Simpan ke Server' });
  const qty = page.locator('.cart .qty');

  await add.focus();
  await expect(add).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(qty).toHaveText('1');

  await page.keyboard.press('Space');
  await expect(qty).toHaveText('2');

  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
  await page.keyboard.press('Enter');

  await expect
    .poll(async () => {
      const state = await fetch(`${baseUrl}/api/state`).then((res) => res.json());
      return state.totalQty;
    })
    .toBe(2);
});

test('role dan live region tersedia untuk pembaca layar', async ({ page }) => {
  await page.goto(baseUrl);

  await expect(page.getByRole('heading', { level: 1, name: 'Kylat Cart — CSP Ketat' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Keranjang' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tambah' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simpan ke Server' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tambah' })).toHaveCount(1);

  const liveRegion = page.locator('.cart .status');
  await expect(liveRegion).toHaveAttribute('aria-live', 'polite');
});
