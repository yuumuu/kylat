/**
 * @kylat/cli - commands/new.ts
 * Generator proyek Kylat minimal dengan Vite + plugin resmi.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface NewProjectOptions {
  dir?: string;
}

const PROJECT_NAME = /^[a-z][a-z0-9-]*$/;

function packageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      private: true,
      version: '0.0.1',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        '@kylat/runtime': '^0.0.1',
      },
      devDependencies: {
        '@kylat/vite-plugin': '^0.0.1',
        vite: '^8.0.0',
      },
    },
    null,
    2
  ) + '\n';
}

const VITE_CONFIG = `import { defineConfig } from 'vite';
import { kylat } from '@kylat/vite-plugin';

export default defineConfig({
  plugins: [kylat()],
});
`;

const INDEX_HTML = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kylat App</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;

const MAIN_JS = `import { createCounter } from './Counter.kylat.php';

const app = document.getElementById('app');
app.replaceChildren(createCounter({ initialCount: 0 }));
`;

const COUNTER_SFC = `<?php

declare(strict_types=1);

namespace App\\Components;

use Kylat\\Component;
use Kylat\\Attributes\\Prop;
use Kylat\\Attributes\\Client;

final class Counter extends Component
{
    #[Prop]
    public int $initialCount = 0;

    public int $count = 0;

    #[Client]
    public function increment(): void
    {
        $this->count += 1;
    }

    #[Client]
    public function decrement(): void
    {
        $this->count -= 1;
    }
}
?>
<div class="counter">
    <h1>Kylat Counter</h1>
    <div class="row">
        <button on:click="decrement()">-</button>
        <span class="count">{{ $count }}</span>
        <button on:click="increment()">+</button>
    </div>
</div>
`;

const README = (name: string): string => `# ${name}

Proyek Kylat minimal yang dibuat oleh \`kylat new\`.

## Menjalankan

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Build produksi

\`\`\`bash
pnpm build
\`\`\`

Komponen berada di \`src/*.kylat.php\` dan dikompilasi oleh \`@kylat/vite-plugin\`.
`;

const GITIGNORE = `node_modules/
dist/
.vite/
`;

export function runNewProjectCommand(name: string | undefined, options?: NewProjectOptions): number {
  if (!name) {
    console.error('❌ Nama proyek wajib diisi. Contoh: kylat new my-app');
    return 1;
  }

  if (!PROJECT_NAME.test(name)) {
    console.error('❌ Nama proyek wajib kebab-case, misal: my-app atau toko-online.');
    return 1;
  }

  const targetDir = path.resolve(process.cwd(), options?.dir ?? name);
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(`❌ Direktori '${path.relative(process.cwd(), targetDir)}' sudah ada dan tidak kosong.`);
    return 1;
  }

  fs.mkdirSync(path.join(targetDir, 'src'), { recursive: true });

  fs.writeFileSync(path.join(targetDir, 'package.json'), packageJson(name), 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'vite.config.ts'), VITE_CONFIG, 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'index.html'), INDEX_HTML, 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'src', 'main.js'), MAIN_JS, 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'src', 'Counter.kylat.php'), COUNTER_SFC, 'utf-8');
  fs.writeFileSync(path.join(targetDir, 'README.md'), README(name), 'utf-8');
  fs.writeFileSync(path.join(targetDir, '.gitignore'), GITIGNORE, 'utf-8');

  console.log(`✅ Proyek '${name}' dibuat di ${path.relative(process.cwd(), targetDir)}`);
  console.log('');
  console.log('   Langkah berikutnya:');
  console.log(`   cd ${path.relative(process.cwd(), targetDir)}`);
  console.log('   pnpm install');
  console.log('   pnpm dev');

  return 0;
}
