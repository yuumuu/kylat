/**
 * @kylat/cli - types.ts
 * Generator tipe TypeScript dari schema aksi GET /_kylat/schema.
 *
 * Pemakaian:
 *   kylat types schema.json --out kylat-actions.ts
 *   kylat types schema.json --out kylat-actions.ts --check
 *   kylat types - --out kylat-actions.ts        (schema dari stdin)
 */

import fs from 'node:fs';
import path from 'node:path';

export interface KylatSchemaParam {
  name: string;
  type: string;
  required?: boolean;
  nullable?: boolean;
}

export interface KylatSchemaAction {
  name: string;
  read?: boolean;
  public?: boolean;
  params?: KylatSchemaParam[];
  returnType?: string;
}

export interface KylatSchema {
  protocol?: string;
  build?: string;
  actions?: KylatSchemaAction[];
}

const TYPE_ALIASES: Record<string, string> = {
  int: 'number',
  integer: 'number',
  float: 'number',
  double: 'number',
  number: 'number',
  numeric: 'number',
  string: 'string',
  bool: 'boolean',
  boolean: 'boolean',
  void: 'void',
  null: 'null',
  mixed: 'unknown',
  object: 'Record<string, unknown>',
  callable: '(...args: unknown[]) => unknown',
  iterable: 'unknown[]',
  array: 'unknown[]',
};

/**
 * Memetakan tipe PHP subset Kylat ke tipe TypeScript.
 * Tipe yang tidak dikenal dipetakan ke unknown (fail-open untuk tipe,
 * tetapi tetap aman karena tidak mengklaim bentuk yang salah).
 */
export function mapPhpTypeToTs(type: string, nullable = false): string {
  const raw = (type || 'mixed').trim();
  if (raw === '') return 'unknown';

  if (raw.startsWith('?')) {
    return `${mapPhpTypeToTs(raw.slice(1), false)} | null`;
  }

  if (raw.includes('|')) {
    const members = raw
      .split('|')
      .map((member) => mapPhpTypeToTs(member, false))
      .filter((member, index, all) => all.indexOf(member) === index);
    const mapped = members.join(' | ');
    return nullable && !members.includes('null') ? `${mapped} | null` : mapped;
  }

  const listMatch = raw.match(/^(?:list|array)<([^,>]+)>$/);
  if (listMatch) {
    return `${mapPhpTypeToTs(listMatch[1]!, false)}[]`;
  }

  const mapMatch = raw.match(/^array<([^,>]+),\s*([^>]+)>$/);
  if (mapMatch) {
    return `Record<${mapPhpTypeToTs(mapMatch[1]!, false)}, ${mapPhpTypeToTs(mapMatch[2]!, false)}>`;
  }

  if (raw.endsWith('[]')) {
    return `${mapPhpTypeToTs(raw.slice(0, -2), false)}[]`;
  }

  const alias = TYPE_ALIASES[raw.toLowerCase()];
  if (alias) {
    if (nullable && alias !== 'null' && alias !== 'unknown') {
      return `${alias} | null`;
    }
    return alias;
  }

  return nullable ? 'unknown | null' : 'unknown';
}

function actionKey(action: KylatSchemaAction): string {
  return action.name;
}

function argsType(action: KylatSchemaAction): string {
  const params = action.params ?? [];
  if (params.length === 0) {
    return 'Record<string, never>';
  }

  const properties = params
    .map((param) => {
      const optional = param.required === false ? '?' : '';
      const type = mapPhpTypeToTs(param.type, param.nullable === true);
      return `      ${JSON.stringify(param.name)}${optional}: ${type};`;
    })
    .join('\n');

  return `{\n${properties}\n    }`;
}

/**
 * Menghasilkan modul TypeScript deterministik dari schema.
 */
export function generateTypes(schema: KylatSchema): string {
  const actions = [...(schema.actions ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  if (actions.length === 0) {
    throw new Error('Schema tidak memuat actions; tidak ada tipe yang dapat dihasilkan.');
  }

  const lines: string[] = [];
  lines.push('// AUTO-GENERATED oleh `kylat types`. Jangan edit manual.');
  if (schema.build) {
    lines.push(`// Build: ${schema.build}`);
  }
  if (schema.protocol) {
    lines.push(`// Protocol: ${schema.protocol}`);
  }
  lines.push('');
  lines.push("import { callServerAction } from '@kylat/runtime';");
  lines.push('');
  lines.push('export interface KylatActionMap {');

  for (const action of actions) {
    const read = action.read === true;
    const isPublic = action.public === true;
    const result = mapPhpTypeToTs(action.returnType ?? 'mixed', false);
    lines.push(`  ${JSON.stringify(actionKey(action))}: {`);
    lines.push(`    args: ${argsType(action)};`);
    lines.push(`    result: ${result};`);
    lines.push(`    read: ${read};`);
    lines.push(`    public: ${isPublic};`);
    lines.push('  };');
  }

  lines.push('}');
  lines.push('');
  lines.push('export type KylatActionName = keyof KylatActionMap;');
  lines.push('');
  lines.push('export function callKylatAction<K extends KylatActionName>(');
  lines.push('  action: K,');
  lines.push('  args: KylatActionMap[K][\'args\'],');
  lines.push('  options?: { idempotencyKey?: string }');
  lines.push('): Promise<KylatActionMap[K][\'result\']> {');
  lines.push('  return callServerAction(action, args as Record<string, unknown>, options);');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function readSchema(schemaPath: string): KylatSchema {
  const raw = schemaPath === '-'
    ? fs.readFileSync(0, 'utf-8')
    : fs.readFileSync(path.resolve(schemaPath), 'utf-8');

  const parsed = JSON.parse(raw) as KylatSchema;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.actions)) {
    throw new Error("Schema wajib berupa object dengan properti 'actions' berupa array.");
  }

  return parsed;
}

export interface TypesCommandOptions {
  out?: string;
  check?: boolean;
}

/**
 * Menjalankan perintah `kylat types`.
 * @returns exit code (0 sukses, 1 gagal/check mismatch)
 */
export async function runTypesCommand(
  schemaPath: string | undefined,
  options: TypesCommandOptions = {}
): Promise<number> {
  if (!schemaPath) {
    console.error('Penggunaan: kylat types <schema.json|-> [--out file] [--check]');
    return 1;
  }

  const outPath = path.resolve(options.out ?? 'kylat-actions.ts');

  let schema: KylatSchema;
  try {
    schema = readSchema(schemaPath);
  } catch (error) {
    console.error(`[Kylat types] Gagal membaca schema: ${(error as Error).message}`);
    return 1;
  }

  let generated: string;
  try {
    generated = generateTypes(schema);
  } catch (error) {
    console.error(`[Kylat types] ${(error as Error).message}`);
    return 1;
  }

  if (options.check) {
    if (!fs.existsSync(outPath)) {
      console.error(`[Kylat types] File ${outPath} tidak ditemukan; jalankan tanpa --check.`);
      return 1;
    }
    const existing = fs.readFileSync(outPath, 'utf-8');
    if (existing !== generated) {
      console.error(
        `[Kylat types] ${outPath} tidak sinkron dengan schema. Jalankan ulang \`kylat types\` dan commit hasilnya.`
      );
      return 1;
    }
    console.log(`✅ Tipe ${outPath} sinkron dengan schema.`);
    return 0;
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, generated, 'utf-8');
  console.log(`✅ Tipe ditulis ke ${outPath} (${schema.actions?.length ?? 0} aksi).`);
  return 0;
}
