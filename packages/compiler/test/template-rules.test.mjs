import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';

describe('@kylat/compiler - Template & Effect Rules (KIL-153 s/d KIL-160)', () => {
  const basePhp = `<?php
declare(strict_types=1);

namespace App\\Components;

use Kylat\\Component;

final class RuleTest extends Component
{
    #[Prop]
    public string $startProp = 'initial';

    public string $query = '';
    public int $count = 0;

    #[Client]
    public function save(): void
    {
        $this->count += 1;
    }

    #[Server]
    public function syncRemote(): void
    {
    }

    private function helperMethod(): void
    {
    }
}
`;

  it('1. mendeteksi KIL-153 jika event handler on: mengarah ke event di luar allowlist v0 atau method tak terdaftar', async () => {
    // A: Event di luar allowlist (mouseenter)
    const resA = await compile(basePhp, 'RuleTest.php', {
      template: '<div on:mouseenter="save">Hover</div>',
    });
    assert.equal(resA.success, false);
    assert.ok(
      resA.diagnostics.some((d) => d.code === 'KIL-153'),
      'Wajib memicu KIL-153 untuk event mouseenter di luar allowlist'
    );

    // B: Handler mengarah ke helperMethod yang tidak beranotasi #[Client]/#[Server]
    const resB = await compile(basePhp, 'RuleTest.php', {
      template: '<button on:click="helperMethod">Klik</button>',
    });
    assert.equal(resB.success, false);
    assert.ok(
      resB.diagnostics.some((d) => d.code === 'KIL-153'),
      'Wajib memicu KIL-153 jika handler method tidak beranotasi #[Client] atau #[Server]'
    );
  });

  it('2. mendeteksi KIL-154 jika target bind:value bukan state lokal (misal prop)', async () => {
    const res = await compile(basePhp, 'RuleTest.php', {
      template: '<input bind:value="$this->startProp">',
    });
    assert.equal(res.success, false);
    assert.ok(
      res.diagnostics.some((d) => d.code === 'KIL-154'),
      'Wajib memicu KIL-154 jika target bind:value mengarah ke prop'
    );
  });

  it('3. mendeteksi KIL-155 jika direktif @foreach tanpa atribut key unik', async () => {
    const res = await compile(basePhp, 'RuleTest.php', {
      template: '@foreach ($items as $item) <div class="item">{{ $item }}</div> @endforeach',
    });
    assert.equal(res.success, false);
    assert.ok(
      res.diagnostics.some((d) => d.code === 'KIL-155'),
      'Wajib memicu KIL-155 jika @foreach tidak menyertakan atribut key'
    );
  });

  it('4. mendeteksi KIL-156 jika atribut error menunjuk path yang bukan state valid', async () => {
    const res = await compile(basePhp, 'RuleTest.php', {
      template: '<span error="unregisteredField"></span>',
    });
    assert.equal(res.success, false);
    assert.ok(
      res.diagnostics.some((d) => d.code === 'KIL-156'),
      'Wajib memicu KIL-156 jika path error bukan state terdaftar'
    );
  });

  it('5. mendeteksi KIL-157 jika method #[Effect] memanggil aksi #[Server]', async () => {
    const invalidEffectPhp = `<?php
declare(strict_types=1);

namespace App\\Components;

use Kylat\\Component;

final class EffectTest extends Component
{
    public string $query = '';

    #[Server]
    public function syncRemote(): void
    {
    }

    #[Effect]
    public function onQueryChange(): void
    {
        $this->server(SearchActions::class)->fetchResults($this->query);
    }
}
`;
    const res = await compile(invalidEffectPhp, 'EffectTest.php');
    assert.equal(res.success, false);
    assert.ok(
      res.diagnostics.some((d) => d.code === 'KIL-157'),
      'Wajib memicu KIL-157 jika #[Effect] memanggil aksi server'
    );
  });

  it('6. mendeteksi KIL-158 jika URL menggunakan skema tidak diizinkan seperti javascript:', async () => {
    const res = await compile(basePhp, 'RuleTest.php', {
      template: '<a href="javascript:stealCookie()">Profil</a>',
    });
    assert.equal(res.success, false);
    assert.ok(
      res.diagnostics.some((d) => d.code === 'KIL-158'),
      'Wajib memicu KIL-158 jika skema href adalah javascript:'
    );
  });

  it('7. mendeteksi KIL-159 jika interpolasi {{ }} digunakan di dalam atribut direktif atau atribut dinamis', async () => {
    const res = await compile(basePhp, 'RuleTest.php', {
      template: '<input bind:value="{{ $query }}">',
    });
    assert.equal(res.success, false);
    assert.ok(
      res.diagnostics.some((d) => d.code === 'KIL-159'),
      'Wajib memicu KIL-159 jika atribut direktif memuat kurung kurawal ganda {{ }}'
    );
  });

  it('8. mendeteksi KIL-160 jika interpolasi {{ }} digunakan pada atribut style atau atribut bawaan on*', async () => {
    // A: style
    const resA = await compile(basePhp, 'RuleTest.php', {
      template: '<div style="color: {{ $userColor }};">Teks</div>',
    });
    assert.equal(resA.success, false);
    assert.ok(
      resA.diagnostics.some((d) => d.code === 'KIL-160'),
      'Wajib memicu KIL-160 jika atribut style memuat kurung kurawal {{ }}'
    );

    // B: onclick
    const resB = await compile(basePhp, 'RuleTest.php', {
      template: '<button onclick="{{ $nativeJs }}">Klik</button>',
    });
    assert.equal(resB.success, false);
    assert.ok(
      resB.diagnostics.some((d) => d.code === 'KIL-160'),
      'Wajib memicu KIL-160 jika atribut bawaan on* memuat kurung kurawal {{ }}'
    );
  });
});
