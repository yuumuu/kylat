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

  it('tetap mengizinkan akses properti state tanpa pemanggilan method', async () => {
    const result = await compile(
      component(`    public function ok(): void
    {
        $this->name = $this->name;
    }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
  });
});
