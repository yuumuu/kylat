import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('@kylat/compiler - Golden Master Test (Counter)', () => {
  it('menghasilkan output JavaScript yang sama persis dengan Counter.expected.js', async () => {
    const counterPhpPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.php');
    const counterBladePath = path.resolve(__dirname, '../../../examples/counter-app/counter.blade.php');
    const expectedJsPath = path.resolve(__dirname, '../../../examples/counter-app/Counter.expected.js');

    const phpSource = fs.readFileSync(counterPhpPath, 'utf-8');
    const bladeSource = fs.readFileSync(counterBladePath, 'utf-8');
    const expectedJs = fs.readFileSync(expectedJsPath, 'utf-8').trim().replace(/\r\n/g, '\n');

    const result = await compile(phpSource, 'Counter.php', { template: bladeSource });

    assert.equal(result.success, true);
    const actualJs = result.code.trim().replace(/\r\n/g, '\n');

    assert.equal(actualJs, expectedJs, 'Output kompilasi harus identik persis dengan golden file Counter.expected.js');
  });
});
