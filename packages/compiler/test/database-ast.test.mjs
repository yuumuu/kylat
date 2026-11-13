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
  const result = await compile(component(body), 'demo.kylat.php', { template: '<div></div>' });
  return result.diagnostics;
}

describe('@kylat/compiler - AST ketat untuk akses method di client', () => {
  it('menolak static call kelas apa pun, bukan hanya nama facade', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = Foo::bar();
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });

  it('menolak member call pada objek apa pun, bukan hanya variabel database umum', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = $user->posts();
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });

  it('menolak callback array ke method client dengan KIL-120', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = array_map([$this, 'query'], $rows);
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });

  it('menolak callback string static dengan KIL-120', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = array_map('DB::table', $rows);
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });

  it('menolak first-class callable method dengan KIL-120', async () => {
    const diagnostics = await diagnosticsFor(`    public function bad(): void
    {
        $this->name = $this->query(...);
    }`);
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-120'));
  });

  it('tetap mengizinkan akses properti state tanpa pemanggilan method', async () => {
    const result = await compile(
      component(`    public function ok(): void
    {
        $this->name = $this->name;
    }`),
      'demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
  });
});
