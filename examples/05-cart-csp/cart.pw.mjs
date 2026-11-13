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

test('cart berjalan di bawah CSP ketat: optimistic lokal, RPC, tanpa inline script', async ({ page }) => {
  const pageErrors = [];

  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push({
        directive: event.violatedDirective,
        blocked: event.blockedURI,
      });
    });
  });

  page.on('pageerror', (error) => pageErrors.push(error.message));

  const response = await page.goto(baseUrl);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-security-policy']).toContain("default-src 'none'");
  expect(response.headers()['content-security-policy']).toContain("'sha256-");

  await expect(page.locator('.cart .qty')).toHaveText('0');

  // Update lokal optimistis: dua klik langsung menaikkan qty.
  await page.locator('.cart .add').click();
  await page.locator('.cart .add').click();
  await expect(page.locator('.cart .qty')).toHaveText('2');

  // Rekonsiliasi server: submit mengirim RPC ke server.
  await page.locator('.cart .submit').click();
  await expect
    .poll(async () => {
      const state = await fetch(`${baseUrl}/api/state`).then((res) => res.json());
      return state.totalQty;
    })
    .toBe(2);

  // Inline script canary harus diblokir CSP.
  expect(await page.evaluate(() => window.__inlineRan)).toBeFalsy();

  const violations = await page.evaluate(() => window.__cspViolations);
  expect(
    violations.some((violation) => String(violation.directive).includes('script-src')),
    'CSP harus memblokir inline script canary'
  ).toBe(true);

  expect(pageErrors).toEqual([]);
});
