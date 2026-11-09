/**
 * @kylat/cli - commands/make.ts
 * Scaffold komponen single-file agar onboarding seperti framework frontend modern.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface MakeOptions {
  dir?: string;
}

export function runMakeComponentCommand(name: string | undefined, options?: MakeOptions): number {
  if (!name) {
    console.error('❌ Nama komponen wajib diisi. Contoh: kylat make:component Counter');
    return 1;
  }
  if (!/^[A-Z][A-Za-z0-9]*$/.test(name)) {
    console.error('❌ Nama komponen wajib PascalCase, misal: Counter atau ProductCard.');
    return 1;
  }

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

final class ${name} extends Component
{
    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count += 1;
    }
}
?>
<div class="kylat-${name.toLowerCase()}">
    <h1>${name}</h1>
    <button on:click="increment">Klik: {{ $count }}</button>
</div>
`;

  fs.writeFileSync(destination, source, 'utf-8');
  console.log(`✅ Komponen dibuat: ${path.relative(process.cwd(), destination)}`);
  console.log('   Jalankan: kylat build resources/views/components');
  return 0;
}
