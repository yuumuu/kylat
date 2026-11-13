import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';
import * as runtime from '../../runtime/dist/index.js';
import { createDocument, findAll, findOne } from './dom-harness.mjs';

const baseComponent = (body) => `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
use Kylat\\Attributes\\Client;
final class Demo extends Component {
${body}
}`;

function load(code, name) {
  const stripped = code
    .replace(/^import[\s\S]*?from '@kylat\/runtime';/m, '')
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
    `${stripped}; return create${name};`
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

describe('@kylat/compiler - template features', () => {
  let originalDocument;

  before(() => {
    originalDocument = globalThis.document;
    globalThis.document = createDocument();
  });

  after(() => {
    globalThis.document = originalDocument;
  });

  it('merender teks di sekitar elemen anak tanpa menghilangkannya', async () => {
    const result = await compile(baseComponent(''), 'Demo.php', {
      template: '<p>Hello <strong>world</strong>!</p>',
    });
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const factory = load(result.code, 'Demo');
    const root = factory();
    assert.equal(root.textContent, 'Hello world!');
    assert.equal(findOne(root, 'strong').textContent, 'world');
  });

  it('mempertahankan beberapa root dan membungkusnya dengan aman', async () => {
    const result = await compile(baseComponent(''), 'Demo.php', {
      template: '<h1>Satu</h1><p>Dua</p>',
    });
    assert.equal(result.success, true);
    const root = load(result.code, 'Demo')();
    assert.equal(root.getAttribute('data-kylat-root'), '');
    assert.deepEqual(findAll(root, 'h1').map((node) => node.textContent), ['Satu']);
    assert.deepEqual(findAll(root, 'p').map((node) => node.textContent), ['Dua']);
  });

  it('tidak hang pada karakter < biasa dan ekspresi perbandingan', async () => {
    const result = await compile(baseComponent(''), 'Demo.php', {
      template: '<p>Halo < dunia</p>',
    });
    assert.equal(result.success, true);
    const root = load(result.code, 'Demo')();
    assert.equal(root.textContent, 'Halo < dunia');
  });

  it('menjalankan @if/@elseif/@else secara reaktif', async () => {
    const result = await compile(
      baseComponent(`    public int $count = 0;
    #[Client]
    public function inc(): void { $this->count += 1; }`),
      'Demo.php',
      {
        template:
          '<div><button on:click="inc">+</button>@if($count > 0)<p>Positif</p>@elseif($count === 0)<p>Nol</p>@else<p>Negatif</p>@endif</div>',
      }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code, 'Demo')();
    const button = findOne(root, 'button');
    assert.equal(root.textContent.includes('Nol'), true);
    button.click();
    assert.equal(root.textContent.includes('Positif'), true);
    button.click();
    assert.equal(root.textContent.includes('Positif'), true);
  });

  it('menjalankan @foreach dengan key dan empty state', async () => {
    const result = await compile(
      baseComponent(`    /** @var list<int> */
    public array $items = [];
    #[Client]
    public function fill(): void { $this->items = [1, 2, 3]; }`),
      'Demo.php',
      {
        template:
          '<div><button on:click="fill">fill</button><ul>@foreach($items as $item)<li key="$item">{{ $item }}</li>@empty<li>kosong</li>@endforeach</ul></div>',
      }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code, 'Demo')();
    const list = findOne(root, 'ul');
    const items = () => findAll(list, 'li').map((node) => node.textContent);
    assert.deepEqual(items(), ['kosong']);
    findOne(root, 'button').click();
    assert.deepEqual(items(), ['1', '2', '3']);
  });

  it('mengikat bind:value dan atribut dinamis secara reaktif', async () => {
    const result = await compile(
      baseComponent('    public string $query = "";'),
      'Demo.php',
      {
        template:
          '<div><input bind:value="$query" /><h1>Halo {{ $query }}</h1><a :href="\'/cari/\' . $query">Cari</a></div>',
      }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code, 'Demo')();
    const input = findOne(root, 'input');
    input.value = 'kylat';
    input.dispatch('input');
    assert.equal(findOne(root, 'h1').textContent, 'Halo kylat');
    assert.equal(findOne(root, 'a').getAttribute('href'), '/cari/kylat');
  });

  it('menolak URL berbahaya saat binding dinamis', async () => {
    const result = await compile(
      baseComponent('    public string $url = "javascript:alert(1)";'),
      'Demo.php',
      { template: '<a :href="$url">klik</a>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const root = load(result.code, 'Demo')();
    assert.equal(findOne(root, 'a').getAttribute('href'), null);
  });

  it('menolak direktif yang tidak didukung dan raw HTML secara fail-closed', async () => {
    const include = await compile(baseComponent(''), 'Demo.php', {
      template: '<div>@include("x")</div>',
    });
    assert.equal(include.success, false);
    assert.ok(include.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-151'));

    const raw = await compile(baseComponent(''), 'Demo.php', {
      template: '<div>{!! $html !!}</div>',
    });
    assert.equal(raw.success, false);
    assert.ok(raw.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-152'));
  });

  it('menolak @foreach tanpa key dan bind ke prop', async () => {
    const noKey = await compile(baseComponent('    /** @var list<int> */\n    public array $items = [];'), 'Demo.php', {
      template: '<ul>@foreach($items as $item)<li>{{ $item }}</li>@endforeach</ul>',
    });
    assert.equal(noKey.success, false);
    assert.ok(noKey.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-155'));

    const bindProp = await compile(
      `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
use Kylat\\Attributes\\Prop;
final class Demo extends Component { #[Prop] public string $value = ''; }`,
      'Demo.php',
      { template: '<input bind:value="$value" />' }
    );
    assert.equal(bindProp.success, false);
    assert.ok(bindProp.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-154'));
  });
});
