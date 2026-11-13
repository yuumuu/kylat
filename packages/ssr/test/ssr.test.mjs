import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseHTML } from 'linkedom';
import { compile } from '@kylat/compiler';
import { renderToString } from '../dist/index.js';
import { clearIslands, hydrateIsland, registerIsland } from '../../runtime/dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const WIDGET = `<?php

declare(strict_types=1);

namespace App\\Components;

use Kylat\\Component;
use Kylat\\Attributes\\Prop;
use Kylat\\Attributes\\Client;

final class Widget extends Component
{
    #[Prop]
    public string $label = 'x';

    public int $count = 0;

    #[Client]
    public function inc(): void
    {
        $this->count += 1;
    }
}
?>
<div data-kylat-component="Widget">
    <span class="label">{{ $label }}</span>
    <span class="count">{{ $count }}</span>
</div>
`;

async function loadWidget() {
  const result = await compile(WIDGET, 'Widget.kylat.php');
  assert.equal(result.success, true, JSON.stringify(result.diagnostics));

  const runtimeUrl = pathToFileURL(path.resolve(__dirname, '../../runtime/dist/index.js')).href;
  const code = result.code.replace(
    /from\s+['"]@kylat\/runtime['"]/g,
    `from ${JSON.stringify(runtimeUrl)}`
  );

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kylat-ssr-'));
  const file = path.join(dir, 'Widget.mjs');
  fs.writeFileSync(file, code, 'utf-8');

  const module = await import(pathToFileURL(file).href);
  return module.createWidget;
}

describe('@kylat/ssr - prerender dan hydration mismatch', () => {
  let originalDocument;

  beforeEach(() => {
    originalDocument = globalThis.document;
    clearIslands();
  });

  afterEach(() => {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
    clearIslands();
  });

  it('merender komponen menjadi string HTML dan memulihkan global document', async () => {
    const createWidget = await loadWidget();
    const html = renderToString(createWidget, { label: 'Halo' });

    assert.match(html, /data-kylat-component="Widget"/);
    assert.match(html, /class="label">Halo</);
    assert.match(html, /class="count">0</);

    assert.equal(globalThis.document, originalDocument, 'global document harus dipulihkan');
  });

  it('hidrasi markup server yang cocok tanpa mismatch', async () => {
    const createWidget = await loadWidget();
    const serverHtml = renderToString(createWidget, { label: 'Halo' });

    const { document } = parseHTML('<!doctype html><html><body></body></html>');
    globalThis.document = document;

    const container = document.createElement('div');
    container.setAttribute('data-island', 'Widget');
    container.setAttribute('data-props', JSON.stringify({ label: 'Halo' }));
    container.innerHTML = serverHtml;

    registerIsland('Widget', createWidget);
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      hydrateIsland(container);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(container.getAttribute('data-kylat-hydrated'), 'true');
    assert.equal(container.getAttribute('data-kylat-hydration-mismatch'), null);
    assert.deepEqual(warnings, []);
    assert.match(container.textContent, /Halo/);
  });

  it('menandai dan memperingatkan hydration mismatch', async () => {
    const createWidget = await loadWidget();
    const serverHtml = renderToString(createWidget, { label: 'Server' });

    const { document } = parseHTML('<!doctype html><html><body></body></html>');
    globalThis.document = document;

    const container = document.createElement('div');
    container.setAttribute('data-island', 'Widget');
    container.setAttribute('data-props', JSON.stringify({ label: 'Client' }));
    container.innerHTML = serverHtml;

    registerIsland('Widget', createWidget);
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    try {
      hydrateIsland(container);
    } finally {
      console.warn = originalWarn;
    }

    assert.equal(container.getAttribute('data-kylat-hydration-mismatch'), 'true');
    assert.ok(warnings.some((message) => message.includes('Hydration mismatch')));
  });
});
