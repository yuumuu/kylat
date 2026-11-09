import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL_LIMITS, PROTOCOL_HEADERS } from '../dist/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('@kylat/protocol - Wire & Limits Specification', () => {
  it('menegakkan batas protokol normatif PROTOCOL_LIMITS', () => {
    assert.equal(PROTOCOL_LIMITS.MAX_BODY_SIZE_BYTES, 256 * 1024, 'Batas ukuran body harus 256 KB');
    assert.equal(PROTOCOL_LIMITS.MAX_CALLS_PER_BATCH, 20, 'Batas panggilan per batch maksimal 20');
    assert.equal(PROTOCOL_LIMITS.MAX_JSON_DEPTH, 16, 'Batas kedalaman JSON maksimal 16');
    assert.equal(PROTOCOL_LIMITS.MAX_ARRAY_ITEMS, 1000, 'Batas array items maksimal 1000');
    assert.equal(PROTOCOL_LIMITS.MAX_STRING_LENGTH, 10000, 'Batas panjang string maksimal 10.000 karakter');
    assert.equal(PROTOCOL_LIMITS.ACTION_TIMEOUT_SECONDS, 10, 'Batas waktu aksi server default 10 detik');
    assert.equal(PROTOCOL_LIMITS.IDEMPOTENCY_TTL_SECONDS, 86400, 'Batas TTL idempotensi wajib 24 jam');
  });

  it('mendefinisikan header protokol resmi PROTOCOL_HEADERS', () => {
    assert.equal(PROTOCOL_HEADERS.BUILD_ID, 'X-Kylat-Build');
    assert.equal(PROTOCOL_HEADERS.CSRF_TOKEN, 'X-CSRF-Token');
    assert.equal(PROTOCOL_HEADERS.IDEMPOTENCY_KEY, 'Idempotency-Key');
    assert.equal(PROTOCOL_HEADERS.AUTHORIZATION, 'Authorization');
  });

  it('memvalidasi berkas skema wire JSON spec/protocol.schema.json', () => {
    const schemaPath = path.resolve(__dirname, '../../../spec/protocol.schema.json');
    assert.ok(fs.existsSync(schemaPath), 'Berkas spec/protocol.schema.json harus ada');

    const schemaRaw = fs.readFileSync(schemaPath, 'utf-8');
    const schema = JSON.parse(schemaRaw);

    assert.ok(schema.$schema, 'Skema harus mendefinisikan meta-schema JSON');
    const defs = schema.$defs ?? schema.definitions;
    assert.ok(defs?.BatchRequest, 'Skema harus mendefinisikan tipe BatchRequest');
    assert.ok(defs?.BatchResponse, 'Skema harus mendefinisikan tipe BatchResponse');
    assert.ok(defs?.Call, 'Skema harus mendefinisikan tipe Call');
    assert.ok(defs?.CallResult, 'Skema harus mendefinisikan tipe CallResult');
    assert.ok(defs?.ProblemDetails, 'Skema harus mendefinisikan tipe RFC 9457 ProblemDetails');
  });
});
