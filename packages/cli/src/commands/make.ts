/**
 * @kylat/cli - commands/make.ts
 * Scaffold komponen single-file agar onboarding seperti framework frontend modern.
 *
 * Nama komponen memakai kebab-case: `kylat make:component cart-product`
 * menghasilkan `cart-product.kylat.php` dengan class `CartProduct`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { kebabToPascal } from '@kylat/compiler';

export interface MakeOptions {
  dir?: string;
}

const COMPONENT_NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

export function runMakeComponentCommand(name: string | undefined, options?: MakeOptions): number {
  if (!name) {
    console.error('❌ Nama komponen wajib diisi. Contoh: kylat make:component cart-product');
    return 1;
  }
  if (!COMPONENT_NAME.test(name)) {
    console.error('❌ Nama komponen wajib kebab-case, misal: counter atau cart-product.');
    return 1;
  }

  const className = kebabToPascal(name);
  const dir = path.resolve(process.cwd(), options?.dir ?? 'resources/views/components');
  fs.mkdirSync(dir, { recursive: true });
  const destination = path.join(dir, `${name}.kylat.php`);
  if (fs.existsSync(destination)) {
    console.error(`❌ Berkas '${path.relative(process.cwd(), destination)}' sudah ada.`);
    return 1;
  }

  const source = `<?php

declare(strict_types=1);

namespace App\\Components;

use Kylat\\Component;
use Kylat\\Attributes\\Client;

final class ${className} extends Component
{
    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count += 1;
    }
}
?>
<div class="kylat-${name}">
    <h1>${className}</h1>
    <button on:click="increment()">Klik: {{ $count }}</button>
</div>
`;

  fs.writeFileSync(destination, source, 'utf-8');
  console.log(`✅ Komponen dibuat: ${path.relative(process.cwd(), destination)}`);
  console.log('   Jalankan: kylat build resources/views/components');
  return 0;
}
