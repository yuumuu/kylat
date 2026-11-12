import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';
import * as runtime from '../../runtime/dist/index.js';
import { createDocument, findOne } from './dom-harness.mjs';

const component = (body, attrs = '') => `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class Demo extends Component {
${body}
}`;

function load(code, name = 'Demo') {
  const stripped = code
    .replace(/^import[\s\S]*?from '@kylat\/runtime';/m, '')
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+default\s+[^;]+;?/g, '');
  return new Function(
    'document',
    'bindAttr',
    'bindIf',
    'bindInput',
    'bindChecked',
    'bindText',
    'createSignal',
    'createComputed',
    'createEffect',
    'createIdempotencyKey',
    'on',
    'reconcileKeyedList',
    `${stripped}; return create${name};`
  )(
    globalThis.document,
    runtime.bindAttr,
    runtime.bindIf,
    runtime.bindInput,
    runtime.bindChecked,
    runtime.bindText,
    runtime.createSignal,
    runtime.createComputed,
    runtime.createEffect,
    runtime.createIdempotencyKey,
    runtime.on,
    runtime.reconcileKeyedList
  );
}

describe('@kylat/compiler - kontrol alur dan closure subset v0', () => {
  let originalDocument;

  before(() => {
    originalDocument = globalThis.document;
    globalThis.document = createDocument();
  });

  after(() => {
    globalThis.document = originalDocument;
  });

  it('menjalankan if/elseif/else dan for dengan parameter bertipe', async () => {
    const result = await compile(
      component(`    public int $count = 0;
    #[Client]
    public function run(int $limit): void {
      for ($i = 0; $i < $limit; $i++) { $this->count += $i; }
      if ($this->count > 2) { $this->count = 2; }
    }`),
      'Demo.kylat.php',
      { template: '<div><button on:click="run(3)">go</button><span>{{ $count }}</span></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code)();
    findOne(root, 'button').click();
    assert.equal(findOne(root, 'span').textContent, '2');
  });

  it('menjalankan foreach dengan key map dan continue', async () => {
    const result = await compile(
      component(`    /** @var array<string, int> */
    public array $scores = ['a' => 1, 'b' => 2, 'c' => 3];
    public string $keys = '';
    public int $sum = 0;
    #[Client]
    public function reduce(): void {
      foreach ($this->scores as $key => $value) {
        if ($key === 'b') { continue; }
        $this->keys = $this->keys . $key;
        $this->sum += $value;
      }
    }`),
      'Demo.kylat.php',
      { template: '<div><button on:click="reduce">go</button><span>{{ $keys }}</span><b>{{ $sum }}</b></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code)();
    findOne(root, 'button').click();
    assert.equal(findOne(root, 'span').textContent, 'ac');
    assert.equal(findOne(root, 'b').textContent, '4');
  });

  it('mendukung return dini dan pemanggilan method client lain', async () => {
    const result = await compile(
      component(`    public string $label = '';
    #[Client]
    public function classify(int $value): string {
      if ($value > 2) { return 'big'; } elseif ($value === 2) { return 'two'; } else { return 'small'; }
    }
    #[Client]
    public function apply(int $value): void { $this->label = $this->classify($value); }`),
      'Demo.kylat.php',
      { template: '<div><button on:click="apply(2)">go</button><span>{{ $label }}</span></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code)();
    findOne(root, 'button').click();
    assert.equal(findOne(root, 'span').textContent, 'two');
  });

  it('mendukung arrow function, array_map, array_filter, dan array_values', async () => {
    const result = await compile(
      component(`    /** @var list<int> */
    public array $items = [1, 2, 3, 4];
    public int $total = 0;
    #[Client]
    public function compute(): void {
      $doubled = array_map(fn($n) => $n * 2, $this->items);
      $kept = array_values(array_filter($doubled, fn($n) => $n % 4 === 0));
      $sum = 0;
      foreach ($kept as $value) { $sum += $value; }
      $this->total = $sum;
    }`),
      'Demo.kylat.php',
      { template: '<div><button on:click="compute">go</button><span>{{ $total }}</span></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code)();
    findOne(root, 'button').click();
    assert.equal(findOne(root, 'span').textContent, '12');
  });

  it('mengompilasi computed sebagai sinyal turunan yang reaktif', async () => {
    const result = await compile(
      component(`    public int $count = 1;
    #[Computed]
    public function doubled(): int { return $this->count * 2; }
    #[Client]
    public function inc(): void { $this->count++; }`),
      'Demo.kylat.php',
      { template: '<div><button on:click="inc">go</button><span>{{ $doubled }}</span></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.ok(result.code.includes('createComputed'));
    const root = load(result.code)();
    assert.equal(findOne(root, 'span').textContent, '2');
    findOne(root, 'button').click();
    assert.equal(findOne(root, 'span').textContent, '4');
  });

  it('menjalankan OnMount setelah DOM dibangun dan Effect saat sinyal berubah', async () => {
    const result = await compile(
      component(`    public int $count = 0;
    public int $mounted = 0;
    public int $observed = -1;
    #[OnMount]
    public function ready(): void { $this->mounted = 1; }
    #[Effect]
    public function watch(): void { $this->observed = $this->count; }
    #[Client]
    public function inc(): void { $this->count++; }`),
      'Demo.kylat.php',
      { template: '<div><button on:click="inc">go</button><span>{{ $mounted }}</span><b>{{ $observed }}</b></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.ok(result.code.includes('createEffect'));
    const root = load(result.code)();
    assert.equal(findOne(root, 'span').textContent, '1');
    assert.equal(findOne(root, 'b').textContent, '0');
    findOne(root, 'button').click();
    assert.equal(findOne(root, 'b').textContent, '1');
  });

  it('mendukung anonymous function dengan use dan pemanggilan closure lokal', async () => {
    const result = await compile(
      component(`    public int $result = 0;
    #[Client]
    public function run(): void {
      $base = 10;
      $fn = function($x) use ($base) { $y = $x + $base; return $y; };
      $this->result = $fn(5);
    }`),
      'Demo.kylat.php',
      { template: '<div><button on:click="run">go</button><span>{{ $result }}</span></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code)();
    findOne(root, 'button').click();
    assert.equal(findOne(root, 'span').textContent, '15');
  });

  it('menolak usort dengan KIL-110 sesuai ADR 0011', async () => {
    const result = await compile(
      component(`    /** @var list<int> */
    public array $items = [3, 1, 2];
    #[Client]
    public function sortItems(): void { usort($this->items, fn($a, $b) => $a <=> $b); }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-110'));
  });

  it('menolak konkatenasi titik pada operand non-string dengan KIL-131', async () => {
    const result = await compile(
      component(`    public int $n = 1;
    #[Client]
    public function bad(): void { $this->n = $this->n . 'x'; }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-131'));
  });

  it('menolak while dengan KIL-104 sesuai ADR 0011', async () => {
    const result = await compile(
      component(`    public int $n = 0;
    #[Client]
    public function loop(): void { while ($this->n < 3) { $this->n++; } }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-104'));
  });
});
