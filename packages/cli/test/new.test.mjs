import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { compile } from '@kylat/compiler';
import { runNewProjectCommand } from '../dist/commands/new.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kylat-new-'));
}

describe('@kylat/cli - generator proyek', () => {
  it('membuat proyek minimal yang bisa dikompilasi', async () => {
    const root = tempDir();
    const target = path.join(root, 'my-app');

    assert.equal(runNewProjectCommand('my-app', { dir: target }), 0);

    for (const file of [
      'package.json',
      'vite.config.ts',
      'index.html',
      'README.md',
      '.gitignore',
      'src/main.js',
      'src/Counter.kylat.php',
    ]) {
      assert.ok(fs.existsSync(path.join(target, file)), `${file} harus dibuat`);
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf-8'));
    assert.equal(pkg.name, 'my-app');
    assert.equal(pkg.scripts.dev, 'vite');
    assert.equal(pkg.dependencies['@kylat/runtime'], '^0.0.1');
    assert.equal(pkg.devDependencies['@kylat/vite-plugin'], '^0.0.1');

    const viteConfig = fs.readFileSync(path.join(target, 'vite.config.ts'), 'utf-8');
    assert.match(viteConfig, /@kylat\/vite-plugin/);
    assert.match(viteConfig, /plugins: \[kylat\(\)\]/);

    const main = fs.readFileSync(path.join(target, 'src/main.js'), 'utf-8');
    assert.match(main, /from '\.\/Counter\.kylat\.php'/);
    assert.match(main, /createCounter/);

    const component = fs.readFileSync(path.join(target, 'src/Counter.kylat.php'), 'utf-8');
    assert.match(component, /final class Counter extends Component/);
    assert.match(component, /on:click="increment\(\)"/);

    const result = await compile(component, 'Counter.kylat.php');
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.match(result.code, /export function createCounter/);
  });

  it('menolak nama proyek yang tidak kebab-case', () => {
    const root = tempDir();
    for (const name of ['MyApp', 'my_app', '1app', '-app']) {
      assert.equal(runNewProjectCommand(name, { dir: path.join(root, name) }), 1, `${name} harus ditolak`);
      assert.equal(fs.existsSync(path.join(root, name)), false, `${name} tidak boleh membuat direktori`);
    }
    assert.equal(runNewProjectCommand(undefined, {}), 1);
  });

  it('menolak direktori tujuan yang sudah tidak kosong', () => {
    const root = tempDir();
    const target = path.join(root, 'existing');
    fs.mkdirSync(target, { recursive: true });
    fs.writeFileSync(path.join(target, 'keep.txt'), 'jangan ditimpa', 'utf-8');

    assert.equal(runNewProjectCommand('existing', { dir: target }), 1);
    assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf-8'), 'jangan ditimpa');
    assert.equal(fs.existsSync(path.join(target, 'package.json')), false);
  });

  it('mengizinkan direktori kosong yang sudah ada', () => {
    const root = tempDir();
    const target = path.join(root, 'empty');
    fs.mkdirSync(target, { recursive: true });

    assert.equal(runNewProjectCommand('empty', { dir: target }), 0);
    assert.ok(fs.existsSync(path.join(target, 'package.json')));
  });
});
