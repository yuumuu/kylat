/**
 * Fase 2 / tugas 1: penolakan konstruksi di luar subset v0.
 *
 * Baseline sebelum berkas ini: 78 tes total (76 pass, 2 skip).
 * Berkas ini menambahkan 7 tes penolakan pertama, sehingga total menjadi 85:
 * static property, pola singleton/static method, yield, goto, eval,
 * fungsi di luar allowlist, dan akses database DB::table.
 *
 * Tes static helper (poin review 2) dan User::find/$pdo->query (poin review 3)
 * ditambahkan setelah review PR.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';

const component = (body) => `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class Demo extends Component {
    public string $name = 'Kylat';
${body}
}`;

async function diagnosticsFor(body) {
  const result = await compile(component(body), 'Demo.kylat.php', { template: '<div></div>' });
  return result.diagnostics;
}

describe('@kylat/compiler - penolakan konstruksi di luar subset v0', () => {
  it('menolak property static dengan KIL-103', async () => {
    const diagnostics = await diagnosticsFor('    public static int $cache = 0;');
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-103'));
  });

  it('menolak pola singleton/static method dengan KIL-103', async () => {
    const diagnostics = await diagnosticsFor(`    public static function instance(): self
    {
        static $instance = null;
        return new self();
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-103'));
  });

  it('mengizinkan static helper murni tanpa state', async () => {
    const result = await compile(
      component(`    public static function noop(): void
    {
    }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.equal(result.diagnostics.some((diagnostic) => diagnostic.code === 'KIL-103'), false);
  });

  it('menolak generator yield dengan KIL-104', async () => {
    const diagnostics = await diagnosticsFor(`    public function values(): array
    {
        yield 1;
        return [];
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-104'));
  });

  it('menolak goto dengan KIL-104', async () => {
    const diagnostics = await diagnosticsFor(`    public function jump(): void
    {
        goto selesai;
        selesai:
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-104'));
  });

  it('menolak eval dengan KIL-104, bukan KIL-110', async () => {
    const diagnostics = await diagnosticsFor(`    public function run(): void
    {
        eval('1 + 1');
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-104'));
    assert.equal(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-110'), false);
  });

  it('menolak fungsi di luar allowlist dengan KIL-110', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = mystery_helper($this->name);
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-110'));
  });

  it('menolak User::find() di client dengan KIL-120', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = User::find(1);
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });

  it('menolak $pdo->query() di client dengan KIL-120', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = $pdo->query('select 1');
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });

  it('menolak akses database di client dengan KIL-120', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = DB::table('users')->value('name');
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });
});
