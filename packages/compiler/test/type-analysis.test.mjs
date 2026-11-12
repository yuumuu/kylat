import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';

const component = (body) => `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class Demo extends Component {
${body}
}`;

describe('@kylat/compiler - analisis tipe v0', () => {
  it('menolak parameter tanpa tipe dengan KIL-131', async () => {
    const result = await compile(
      component('    #[Client] public function run($value): void {}'),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-131'));
  });

  it('menolak return tanpa tipe dengan KIL-131', async () => {
    const result = await compile(
      component('    #[Client] public function run() { return 1; }'),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-131'));
  });

  it('menolak return yang tidak kompatibel dengan tipe method', async () => {
    const result = await compile(
      component("    #[Client] public function label(): int { return 'x'; }"),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, false);
    assert.ok(
      result.diagnostics.some(
        (diagnostic) => diagnostic.code === 'KIL-131' && diagnostic.message.includes('return')
      )
    );
  });

  it('menolak konkatenasi titik pada operand int dengan KIL-131', async () => {
    const result = await compile(
      component(`    public int $count = 1;
    #[Client] public function label(): string { return 'n=' . $this->count; }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-131'));
  });

  it('menerima konkatenasi setelah cast string eksplisit', async () => {
    const result = await compile(
      component(`    public int $count = 1;
    #[Client] public function label(): string { return 'n=' . (string) $this->count; }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
  });

  it('membaca docblock list<T> dan array<string,T> sebagai tipe IR', async () => {
    const result = await compile(
      component(`    /** @var list<int> */
    public array $items = [1, 2];
    /** @var array<string, int> */
    public array $scores = ['a' => 1];`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.ir.state[0].parsedType, {
      kind: 'list',
      itemType: { kind: 'primitive', name: 'int' },
    });
    assert.deepEqual(result.ir.state[1].parsedType, {
      kind: 'map',
      keyType: 'string',
      valueType: { kind: 'primitive', name: 'int' },
    });
  });

  it('menerima nullable eksplisit dan null coalescing', async () => {
    const result = await compile(
      component(`    public ?string $name = null;
    #[Client] public function label(): string { return $this->name ?? 'tanpa nama'; }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
  });
});
