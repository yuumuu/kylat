import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generateTypes, mapPhpTypeToTs, runTypesCommand } from '../dist/commands/types.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kylat-types-'));
}

describe('@kylat/cli - generator tipe dari schema', () => {
  it('memetakan tipe PHP subset ke TypeScript', () => {
    assert.equal(mapPhpTypeToTs('int'), 'number');
    assert.equal(mapPhpTypeToTs('float'), 'number');
    assert.equal(mapPhpTypeToTs('string'), 'string');
    assert.equal(mapPhpTypeToTs('bool'), 'boolean');
    assert.equal(mapPhpTypeToTs('void'), 'void');
    assert.equal(mapPhpTypeToTs('mixed'), 'unknown');
    assert.equal(mapPhpTypeToTs('?string'), 'string | null');
    assert.equal(mapPhpTypeToTs('int|null'), 'number | null');
    assert.equal(mapPhpTypeToTs('array<int>'), 'number[]');
    assert.equal(mapPhpTypeToTs('array<string, int>'), 'Record<string, number>');
    assert.equal(mapPhpTypeToTs('App\\Models\\User'), 'unknown');
    assert.equal(mapPhpTypeToTs('string', true), 'string | null');
  });

  it('menghasilkan modul deterministik dengan args, result, read, dan public', () => {
    const output = generateTypes({
      protocol: '0.1',
      build: 'b-1',
      actions: [
        {
          name: 'CounterActions::saveCount',
          read: false,
          public: false,
          params: [{ name: 'count', type: 'int', required: true }],
          returnType: 'bool',
        },
        {
          name: 'CartActions::summary',
          read: true,
          public: true,
          params: [],
          returnType: 'array<string, int>',
        },
      ],
    });

    assert.match(output, /AUTO-GENERATED/);
    assert.match(output, /Build: b-1/);
    assert.match(output, /"CartActions::summary"/);
    assert.match(output, /"CounterActions::saveCount"/);
    assert.match(output, /args: \{\n      "count": number;\n    \};/);
    assert.match(output, /args: Record<string, never>;/);
    assert.match(output, /result: Record<string, number>;/);
    assert.match(output, /read: true;/);
    assert.match(output, /public: true;/);
    assert.match(output, /export function callKylatAction/);
    assert.ok(
      output.indexOf('"CartActions::summary"') < output.indexOf('"CounterActions::saveCount"'),
      'aksi harus diurutkan deterministik'
    );
  });

  it('menolak schema tanpa actions', () => {
    assert.throws(() => generateTypes({ actions: [] }), /tidak memuat actions/);
  });

  it('menulis file, check sinkron, dan mendeteksi drift', async () => {
    const dir = tempDir();
    const schemaPath = path.join(dir, 'schema.json');
    const outPath = path.join(dir, 'kylat-actions.ts');

    fs.writeFileSync(
      schemaPath,
      JSON.stringify({
        protocol: '0.1',
        actions: [
          {
            name: 'CounterActions::saveCount',
            read: false,
            public: false,
            params: [{ name: 'count', type: 'int', required: true }],
            returnType: 'bool',
          },
        ],
      })
    );

    assert.equal(await runTypesCommand(schemaPath, { out: outPath }), 0);
    assert.ok(fs.existsSync(outPath));

    assert.equal(await runTypesCommand(schemaPath, { out: outPath, check: true }), 0);

    fs.writeFileSync(
      schemaPath,
      JSON.stringify({
        protocol: '0.1',
        actions: [
          {
            name: 'CounterActions::saveCount',
            read: false,
            public: false,
            params: [{ name: 'count', type: 'int', required: true }],
            returnType: 'string',
          },
        ],
      })
    );

    assert.equal(await runTypesCommand(schemaPath, { out: outPath, check: true }), 1);
  });

  it('mengembalikan exit 1 untuk schema rusak atau file check yang hilang', async () => {
    const dir = tempDir();
    const badSchema = path.join(dir, 'bad.json');
    fs.writeFileSync(badSchema, '{not json');

    assert.equal(await runTypesCommand(badSchema, { out: path.join(dir, 'out.ts') }), 1);
    assert.equal(await runTypesCommand(undefined, {}), 1);
    assert.equal(await runTypesCommand(badSchema, { out: path.join(dir, 'out.ts'), check: true }), 1);
  });
});
