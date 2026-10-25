import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile, kebabToCamel, camelToKebab } from '../dist/index.js';

describe('@kylat/compiler - Dynamic Prop Defaults & Name Mapping', () => {
  it('1. membaca nilai default prop langsung dari deklarasi PHP (PHP dan JS tidak bisa berbeda)', async () => {
    function makeComponent(defaultVal) {
      return `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;

final class DynamicProp extends Component
{
    #[Prop]
    public int $initialCount = ${defaultVal};

    public int $count = 0;
}
`;
    }

    // Uji dengan default = 0
    const res0 = await compile(makeComponent(0), 'DynamicProp.php');
    assert.equal(res0.success, true);
    assert.ok(
      res0.code.includes('props["initialCount"] !== undefined ? props["initialCount"] : 0;'),
      'Output JS wajib menggunakan nilai default 0 dari PHP'
    );

    // Uji dengan default = 42 (ketika PHP diubah, output JS ikut berubah!)
    const res42 = await compile(makeComponent(42), 'DynamicProp.php');
    assert.equal(res42.success, true);
    assert.ok(
      res42.code.includes('props["initialCount"] !== undefined ? props["initialCount"] : 42;'),
      'Output JS wajib mencerminkan perubahan default PHP menjadi 42'
    );

    // Uji dengan default = 999
    const res999 = await compile(makeComponent(999), 'DynamicProp.php');
    assert.equal(res999.success, true);
    assert.ok(
      res999.code.includes('props["initialCount"] !== undefined ? props["initialCount"] : 999;'),
      'Output JS wajib mencerminkan perubahan default PHP menjadi 999'
    );
  });

  it('2. pemetaan konversi nama prop (kebab-case ke camelCase) dengan berbagai kasus tepi', () => {
    // Kasus 1: Nama dasar dua segmen
    assert.equal(kebabToCamel('initial-count'), 'initialCount');
    assert.equal(camelToKebab('initialCount'), 'initial-count');

    // Kasus 2: Angka di dalam nama
    assert.equal(kebabToCamel('item-2-count'), 'item2Count');
    assert.equal(kebabToCamel('max-3-items'), 'max3Items');

    // Kasus 3: Lebih dari dua segmen
    assert.equal(kebabToCamel('max-allowed-items'), 'maxAllowedItems');
    assert.equal(kebabToCamel('page-size-limit'), 'pageSizeLimit');

    // Kasus 4: Satu kata tunggal
    assert.equal(kebabToCamel('step'), 'step');
    assert.equal(camelToKebab('step'), 'step');
  });
});
