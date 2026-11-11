import { test, expect } from '@playwright/test';

test('Counter reaktif pada WebKit (klik + dua kali menghasilkan 2 tanpa pageerror)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  // Buka halaman contoh (server HTTP demo pada port 3010)
  const targetUrl = process.env.TEST_URL || 'http://localhost:3010';
  await page.goto(targetUrl);

  // Tunggu island terpasang dan temukan tombol '+' serta span counter via data-testid
  const plusButton = page.locator('#island-mount button', { hasText: '+' });
  const countSpan = page.locator('#island-mount [data-testid="count"]');

  // Klik tombol "+" dua kali
  await plusButton.click();
  await plusButton.click();

  // Assert: textContent span angka sama dengan "2"
  await expect(countSpan).toHaveText('2');

  // Assert: tidak ada error di console (page.on('pageerror') harus kosong)
  expect(pageErrors).toEqual([]);
});
