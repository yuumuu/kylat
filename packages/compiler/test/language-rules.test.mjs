import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeActionContract, compile, initPhpParser } from '../dist/index.js';

const component = (body) => `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class Demo extends Component {
    public string $name = 'Kylat';
${body}
}`;

async function codes(body) {
  const result = await compile(component(body), 'Demo.kylat.php', { template: '<div></div>' });
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

describe('@kylat/compiler - aturan bahasa client (KIL-110/120/140)', () => {
  it('menolak I/O di client dengan KIL-120', async () => {
    assert.ok(
      (await codes(`    public function bad(): void { $this->name = file_get_contents('/tmp/x'); }`)).includes(
        'KIL-120'
      )
    );
  });

  it('menolak fungsi string byte-level dengan KIL-140', async () => {
    assert.ok(
      (await codes(`    public function bad(): void { $this->name = substr($this->name, 0, 1); }`)).includes(
        'KIL-140'
      )
    );
  });

  it('menolak instansiasi kelas dengan KIL-110', async () => {
    assert.ok(
      (await codes(`    public function bad(): void { $this->name = new Foo(); }`)).includes('KIL-110')
    );
  });

  it('menolak tipe properti closure atau callable dengan KIL-110', async () => {
    const result = await compile(
      `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
use Closure;
final class BadClosure extends Component {
    public Closure $fn;
}
?>
<div></div>`,
      'BadClosure.kylat.php'
    );
    assert.equal(result.success, false);
    assert.ok(result.diagnostics.some((d) => d.code === 'KIL-110'));
  });

  it('menolak superglobal dengan KIL-120', async () => {
    assert.ok(
      (await codes(`    public function bad(): void { $this->name = $_GET['x']; }`)).includes('KIL-120')
    );
  });

  it('mengizinkan fungsi allowlist seperti mb_strlen', async () => {
    const result = await compile(
      component(`    public function ok(): void { $this->name = mb_strlen($this->name); }`),
      'Demo.kylat.php',
      { template: '<div></div>' }
    );
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
  });
});

describe('@kylat/compiler - KIL-310', () => {
  it('mewajibkan authorize pada kontrak aksi ber-\#[Server]', async () => {
    const parser = await initPhpParser();
    const tree = parser.parse(`<?php
namespace App\\Actions;
use Kylat\\Attributes\\Server;
interface BadActions { #[Server] public function save(int $id): bool; }`);
    const diagnostics = analyzeActionContract(tree, 'BadActions.php');
    assert.ok(diagnostics.some((diagnostic) => diagnostic.code === 'KIL-310'));
  });

  it('menerima kontrak aksi yang punya authorize', async () => {
    const parser = await initPhpParser();
    const tree = parser.parse(`<?php
namespace App\\Actions;
use Kylat\\Attributes\\Server;
interface GoodActions {
  public function authorize(): bool;
  #[Server] public function save(int $id): bool;
}`);
    const diagnostics = analyzeActionContract(tree, 'GoodActions.php');
    assert.equal(diagnostics.length, 0);
  });
});

describe('@kylat/compiler - match ditunda', () => {
  it('menolak match dengan KIL-104 sampai v0.1', async () => {
    const codes = await (async () => {
      const result = await compile(
        component('    public function label(int $status): string { return match($status) { 1 => "A", default => "B" }; }'),
        'Demo.kylat.php',
        { template: '<div></div>' }
      );
      return result.diagnostics.map((diagnostic) => diagnostic.code);
    })();
    assert.ok(codes.includes('KIL-104'));
  });
});
