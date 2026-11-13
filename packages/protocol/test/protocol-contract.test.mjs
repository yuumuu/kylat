import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROTOCOL_PROBLEM_STATUS,
  PROTOCOL_PROBLEM_TYPES,
  PROTOCOL_HEADERS,
} from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../../spec/protocol.schema.json');

describe('@kylat/protocol - kontrak GET read/schema', () => {
  it('mendaftarkan ReadResponse dan SchemaResponse di schema JSON', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert.ok(schema.$defs.ReadResponse);
    assert.ok(schema.$defs.SchemaResponse);
    assert.ok(schema.$defs.SchemaAction);
    assert.ok(schema.$defs.SchemaParam);
    assert.ok(schema.oneOf.some((entry) => entry.$ref === '#/$defs/ReadResponse'));
    assert.ok(schema.oneOf.some((entry) => entry.$ref === '#/$defs/SchemaResponse'));
  });

  it('menetapkan status Problem Details yang stabil', () => {
    assert.equal(PROTOCOL_PROBLEM_TYPES.STALE_BUILD, 'urn:kylat:stale_build');
    assert.equal(PROTOCOL_PROBLEM_STATUS.STALE_BUILD, 409);
    assert.equal(PROTOCOL_PROBLEM_TYPES.RATE_LIMITED, 'urn:kylat:rate_limited');
    assert.equal(PROTOCOL_PROBLEM_STATUS.RATE_LIMITED, 429);
    assert.equal(PROTOCOL_HEADERS.BUILD_ID, 'X-Kylat-Build');
  });

  it('mewajibkan field schema aksi yang dibutuhkan generator tipe', () => {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    assert.deepEqual(schema.$defs.SchemaAction.required, [
      'name',
      'read',
      'public',
      'params',
      'returnType',
    ]);
    assert.deepEqual(schema.$defs.SchemaParam.required, [
      'name',
      'type',
      'required',
      'nullable',
    ]);
  });
});
