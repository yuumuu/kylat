import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';
import * as runtime from '../../runtime/dist/index.js';
import { createDocument, findOne } from './dom-harness.mjs';

const parentSource = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
use Kylat\\Attributes\\Child;
use Kylat\\Attributes\\Client;

#[Child(Display::class)]
final class ParentComponent extends Component
{
    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count += 1;
    }
}
?>
<div>
  <button on:click="increment">+</button>
  <x-display :value="$count" title="Counter Display" />
</div>`;

const childSource = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
use Kylat\\Attributes\\Prop;

final class Display extends Component
{
    #[Prop]
    public int $value = 0;

    #[Prop]
    public string $title = '';
}
?>
<div class="display">
  <span class="title">{{ $title }}</span>
  <span class="value">{{ $value }}</span>
</div>`;

function loadWithChild(parentCode, childCode) {
  const strip = (code) =>
    code
      .replace(/^import[\s\S]*?from '@kylat\/runtime';/m, '')
      .replace(/import\s+.*?from\s+['"].*?['"];?/g, '')
      .replace(/export\s+function/g, 'function')
      .replace(/export\s+default\s+[^;]+;?/g, '');

  const factory = new Function(
    'document',
    'bindAttr',
    'bindIf',
    'bindInput',
    'bindChecked',
    'bindText',
    'createSignal',
    'createIdempotencyKey',
    'on',
    'reconcileKeyedList',
    `
    ${strip(childCode)}
    ${strip(parentCode)}
    return { createParentComponent, createDisplay };
    `
  )(
    globalThis.document,
    runtime.bindAttr,
    runtime.bindIf,
    runtime.bindInput,
    runtime.bindChecked,
    runtime.bindText,
    runtime.createSignal,
    runtime.createIdempotencyKey,
    runtime.on,
    runtime.reconcileKeyedList
  );

  return factory;
}

describe('@kylat/compiler - KEP-35 reaktivitas prop komponen anak', () => {
  let originalDocument;

  before(() => {
    originalDocument = globalThis.document;
    globalThis.document = createDocument();
  });

  after(() => {
    globalThis.document = originalDocument;
  });

  it('1. kompilasi prop dinamis sebagai accessor getter dan prop statis sebagai nilai biasa', async () => {
    const parentRes = await compile(parentSource, 'parent-component.kylat.php');
    assert.equal(parentRes.success, true, JSON.stringify(parentRes.diagnostics));

    // Prop dinamis :value="$count" wajib dikompilasi sebagai accessor getter: "value": () => count()
    assert.ok(
      parentRes.code.includes('"value": () => count()'),
      `Prop dinamis :value="$count" wajib dioper sebagai accessor getter '() => count()'. Output: ${parentRes.code}`
    );

    // Prop statis title="Counter Display" tetap dioper sebagai nilai biasa
    assert.ok(
      parentRes.code.includes('"title": "Counter Display"'),
      `Prop statis title="Counter Display" wajib dioper sebagai nilai biasa. Output: ${parentRes.code}`
    );
  });

  it('2. reaktivitas runtime: ketika induk berubah, anak harus ikut berubah', async () => {
    const parentRes = await compile(parentSource, 'parent-component.kylat.php');
    const childRes = await compile(childSource, 'display.kylat.php');
    assert.equal(parentRes.success, true, JSON.stringify(parentRes.diagnostics));
    assert.equal(childRes.success, true, JSON.stringify(childRes.diagnostics));

    const { createParentComponent } = loadWithChild(parentRes.code, childRes.code);
    const root = createParentComponent();

    const button = findOne(root, 'button');
    const titleSpan = findOne(root, 'span');
    const valueSpan = root.childNodes[1].childNodes[1]; // span.value

    assert.equal(titleSpan.textContent, 'Counter Display');
    assert.equal(valueSpan.textContent, '0', 'Nilai awal span anak harus 0');

    // Trigger pembaruan pada komponen induk
    button.click();

    // Verifikasi anak ikut ter-update secara reaktif
    assert.equal(valueSpan.textContent, '1', 'Nilai span anak wajib ikut berubah menjadi 1 saat induk berubah');
  });

  it('3. menolak prop bertipe Closure atau callable dengan KIL-110 (fungsi tidak bisa dioper sebagai prop statis)', async () => {
    const invalidChildSource = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
use Kylat\\Attributes\\Prop;
use Closure;

final class ActionDisplay extends Component
{
    #[Prop]
    public Closure $onClick;
}
?>
<div></div>`;

    const res = await compile(invalidChildSource, 'action-display.kylat.php');
    assert.equal(res.success, false);
    const kil110 = res.diagnostics.find((d) => d.code === 'KIL-110');
    assert.ok(kil110, 'Prop dengan tipe Closure/callable wajib ditolak oleh KIL-110');
  });
});

