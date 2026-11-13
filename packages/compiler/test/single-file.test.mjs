import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';

const singleFile = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class Counter extends Component
{
    public int $count = 0;
}
?>
<div><button>{{ $count }}</button></div>`;

describe('@kylat/compiler - single-file KEP-34', () => {
  it('membaca template setelah ?> dari berkas .kylat.php', async () => {
    const result = await compile(singleFile, 'counter.kylat.php');
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.ok(result.code.includes('bindText'));
    assert.ok(result.code.includes('createElement("button")'));
  });

  it('menolak .kylat.php tanpa ?> (KIL-216)', async () => {
    const result = await compile(
      `<?php
declare(strict_types=1);
final class Counter extends Component { public int $count = 0; }`,
      'counter.kylat.php'
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-216'));
  });

  it('menolak nama kelas yang tidak sama dengan nama berkas (KIL-215)', async () => {
    const result = await compile(singleFile, 'other.kylat.php');
    assert.equal(result.success, false);
    const diagnostic = result.diagnostics.find((item) => item.code === 'KIL-215');
    assert.ok(diagnostic);
    assert.match(diagnostic.message, /wajib 'Other'/);
  });

  it('menolak nama berkas yang bukan kebab-case (KIL-215)', async () => {
    const result = await compile(singleFile, 'Counter.kylat.php');
    assert.equal(result.success, false);
    const diagnostic = result.diagnostics.find((item) => item.code === 'KIL-215');
    assert.ok(diagnostic);
    assert.match(diagnostic.message, /wajib kebab-case/);
  });

  it('menerima kebab-case dan memetakan class ke PascalCase', async () => {
    const source = singleFile.replace('final class Counter', 'final class CartProduct');
    const result = await compile(source, 'cart-product.kylat.php');
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.match(result.code, /export function createCartProduct/);
  });

  it('menolak pernyataan PHP di luar kelas (KIL-214)', async () => {
    const result = await compile(
      `<?php
declare(strict_types=1);
echo "side effect";
final class Counter extends Component { public int $count = 0; }
?>
<div></div>`,
      'counter.kylat.php'
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-214'));
  });
});
