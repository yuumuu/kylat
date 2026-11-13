import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { kylat } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const counterSource = fs.readFileSync(
  path.resolve(__dirname, '../../../examples/01-counter/counter.kylat.php'),
  'utf-8'
);

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kylat-vite-'));
}

describe('@kylat/vite-plugin', () => {
  it('mengompilasi *.kylat.php menjadi modul JavaScript + source map', async () => {
    const plugin = kylat();
    const context = {
      error(message) {
        throw new Error(message);
      },
    };

    const result = await plugin.transform.call(context, counterSource, '/tmp/counter.kylat.php');
    assert.ok(result);
    assert.match(result.code, /export function createCounter/);
    assert.match(result.code, /CounterActions::saveCount/);
    assert.equal(result.map.version, 3);
    assert.deepEqual(result.map.sources, ['/tmp/counter.kylat.php']);
  });

  it('menyuntikkan HMR accept saat serve', async () => {
    const plugin = kylat();
    plugin.configResolved({ command: 'serve' });

    const result = await plugin.transform.call(
      { error: (message) => { throw new Error(message); } },
      counterSource,
      '/tmp/counter.kylat.php'
    );

    assert.match(result.code, /import\.meta\.hot\.accept/);
    assert.match(result.code, /updateIslandFactory\("Counter"/);
  });

  it('tidak menyuntikkan HMR pada build', async () => {
    const plugin = kylat();
    plugin.configResolved({ command: 'build' });

    const result = await plugin.transform.call(
      { error: (message) => { throw new Error(message); } },
      counterSource,
      '/tmp/counter.kylat.php'
    );

    assert.doesNotMatch(result.code, /import\.meta\.hot/);
    assert.doesNotMatch(result.code, /updateIslandFactory/);
  });

  it('mengabaikan berkas non-Kylat', async () => {
    const plugin = kylat();
    const result = await plugin.transform.call({ error: () => {} }, 'console.log(1)', '/tmp/app.js');
    assert.equal(result, null);
  });

  it('memperbarui modul saat file berubah, atau full reload bila belum termonitor', () => {
    const plugin = kylat();
    const sent = [];
    const server = { ws: { send: (message) => sent.push(message) } };

    const monitored = { id: '/tmp/counter.kylat.php' };
    const modules = plugin.handleHotUpdate({
      file: '/tmp/counter.kylat.php',
      modules: [monitored],
      server,
    });
    assert.deepEqual(modules, [monitored]);
    assert.deepEqual(sent, []);

    const noModules = plugin.handleHotUpdate({
      file: '/tmp/New.kylat.php',
      modules: [],
      server,
    });
    assert.deepEqual(noModules, []);
    assert.deepEqual(sent, [{ type: 'full-reload' }]);
  });

  it('build Vite menghasilkan bundle dengan komponen terkompilasi', async () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'counter.kylat.php'), counterSource, 'utf-8');
    fs.writeFileSync(
      path.join(dir, 'main.js'),
      "import { createCounter } from './counter.kylat.php';\nexport const mount = () => createCounter({ initialCount: 1 });\n",
      'utf-8'
    );

    const outDir = path.join(dir, 'dist');
    await build({
      root: dir,
      logLevel: 'silent',
      plugins: [kylat()],
      build: {
        outDir,
        emptyOutDir: true,
        lib: {
          entry: path.join(dir, 'main.js'),
          formats: ['es'],
          fileName: () => 'bundle.js',
        },
        rollupOptions: {
          external: ['@kylat/runtime'],
        },
      },
    });

    const bundle = fs.readFileSync(path.join(outDir, 'bundle.js'), 'utf-8');
    assert.match(bundle, /CounterActions::saveCount/);
    assert.match(bundle, /data-kylat-component/);
    assert.match(bundle, /as mount/);
  });
});
