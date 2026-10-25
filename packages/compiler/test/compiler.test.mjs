import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';

describe('@kylat/compiler - Pipeline Kompilasi PHP Subset v0', () => {
  it('berhasil mengompilasi komponen PHP yang valid ke JavaScript signals', async () => {
    const validComponent = `<?php

declare(strict_types=1);

namespace App\\Components;

use Kylat\\Component;
use App\\Actions\\CartActions;

#[Uses(CartActions::class)]
final class CartCounter extends Component
{
    #[Prop]
    public string $productId;

    public int $qty = 1;

    #[Client]
    public function increment(): void
    {
        $this->qty++;
    }

    #[Server]
    public function submitOrder(): void
    {
        $this->server(CartActions::class)->add($this->productId, $this->qty);
    }
}
`;

    const result = await compile(validComponent, 'CartCounter.php');

    assert.equal(result.success, true);
    assert.ok(result.code.includes("from '@kylat/runtime'"));
    assert.ok(result.code.includes("createSignal"));
    assert.ok(result.code.includes("export function createCartCounter(props = {})"));
    assert.ok(result.code.includes("const [qty, set_qty] = createSignal(1);"));
    assert.ok(result.code.includes('callServerAction("CartActions::add"'));
    assert.equal(result.ir?.name, 'CartCounter');
    assert.equal(result.ir?.props.length, 1);
    assert.equal(result.ir?.props[0].name, 'productId');
    assert.equal(result.ir?.state.length, 1);
    assert.equal(result.ir?.state[0].name, 'qty');
  });

  it('mendeteksi KIL-102 jika declare(strict_types=1) tidak ada', async () => {
    const code = `<?php

namespace App\\Components;

final class NoStrict extends Component
{
    public int $count = 0;
}
`;

    const result = await compile(code, 'NoStrict.php');
    assert.equal(result.success, false);
    const kil102 = result.diagnostics.find((d) => d.code === 'KIL-102');
    assert.ok(kil102, 'Harus mendeteksi KIL-102');
    assert.equal(kil102.docUrl, 'https://kylat.dev/docs/errors/kil-102');
  });

  it('mendeteksi KIL-104 jika menggunakan ekspresi match', async () => {
    const code = `<?php

declare(strict_types=1);

final class MatchTest extends Component
{
    public function check(int $val): string
    {
        return match($val) {
            1 => 'one',
            default => 'other'
        };
    }
}
`;

    const result = await compile(code, 'MatchTest.php');
    assert.equal(result.success, false);
    const kil104 = result.diagnostics.find((d) => d.code === 'KIL-104');
    assert.ok(kil104, 'Harus mendeteksi KIL-104');
  });

  it('mendeteksi KIL-103 jika menggunakan global statement', async () => {
    const code = `<?php

declare(strict_types=1);

final class GlobalTest extends Component
{
    public function run(): void
    {
        global $database;
    }
}
`;

    const result = await compile(code, 'GlobalTest.php');
    assert.equal(result.success, false);
    const kil103 = result.diagnostics.find((d) => d.code === 'KIL-103');
    assert.ok(kil103, 'Harus mendeteksi KIL-103');
  });

  it('mendeteksi KIL-201 jika class tidak final', async () => {
    const code = `<?php

declare(strict_types=1);

class NonFinalComponent extends Component
{
    public int $count = 0;
}
`;

    const result = await compile(code, 'NonFinalComponent.php');
    assert.equal(result.success, false);
    const kil201 = result.diagnostics.find((d) => d.code === 'KIL-201');
    assert.ok(kil201, 'Harus mendeteksi KIL-201');
  });

  it('mendeteksi KIL-131 jika properti tidak bertipe', async () => {
    const code = `<?php

declare(strict_types=1);

final class UntypedProp extends Component
{
    public $counter = 0;
}
`;

    const result = await compile(code, 'UntypedProp.php');
    assert.equal(result.success, false);
    const kil131 = result.diagnostics.find((d) => d.code === 'KIL-131');
    assert.ok(kil131, 'Harus mendeteksi KIL-131 untuk tipe data hilang');
  });

  it('mendeteksi KIL-110 jika properti bertipe callable', async () => {
    const code = `<?php

declare(strict_types=1);

final class CallableProp extends Component
{
    public callable $callback;
}
`;

    const result = await compile(code, 'CallableProp.php');
    assert.equal(result.success, false);
    const kil110 = result.diagnostics.find((d) => d.code === 'KIL-110');
    assert.ok(kil110, 'Harus mendeteksi KIL-110 untuk tipe callable di luar allowlist');
  });

  it('mendeteksi KIL-131 jika properti tidak memiliki visibility eksplisit', async () => {
    const code = `<?php

declare(strict_types=1);

final class NoVisProp extends Component
{
    int $counter = 0;
}
`;

    const result = await compile(code, 'NoVisProp.php');
    assert.equal(result.success, false);
    const kil131 = result.diagnostics.find((d) => d.code === 'KIL-131');
    assert.ok(kil131, 'Harus mendeteksi KIL-131 untuk visibilitas hilang');
  });
});
