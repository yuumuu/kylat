/**
 * @kylat/compiler - types.ts
 * Model tipe v0 dan parser anotasi tipe PHP/docblock.
 */

export type KylatType =
  | { kind: 'primitive'; name: 'int' | 'float' | 'string' | 'bool' | 'null' }
  | { kind: 'list'; itemType: KylatType }
  | { kind: 'map'; keyType: 'string'; valueType: KylatType }
  | { kind: 'nullable'; innerType: KylatType }
  | { kind: 'enum'; enumName: string; cases: string[] }
  | { kind: 'function'; params: KylatType[]; returnType: KylatType }
  | { kind: 'unknown' };

export const UNKNOWN: KylatType = { kind: 'unknown' };

export function primitive(name: 'int' | 'float' | 'string' | 'bool' | 'null'): KylatType {
  return { kind: 'primitive', name };
}

/**
 * Mengurai tipe PHP v0. Docblock `@var` hanya dipakai bila tipe deklarasi
 * berupa `array` tanpa parameter generik.
 */
export function parsePhpType(typeText: string | undefined, docblock?: string): KylatType {
  const docType = docblock ? extractVarDocType(docblock) : undefined;
  const text = (docType ?? typeText ?? '').trim();
  if (!text) return UNKNOWN;
  if (docType && (text === 'array' || text === 'iterable')) {
    return parseTypeExpression(docType);
  }
  return parseTypeExpression(text);
}

export function parseTypeExpression(text: string): KylatType {
  let value = text.trim();
  if (!value) return UNKNOWN;

  let nullable = false;
  if (value.startsWith('?')) {
    nullable = true;
    value = value.slice(1).trim();
  }

  // Union `T|null` / `null|T`; union lain belum didukung.
  if (value.includes('|')) {
    const parts = value.split('|').map((part) => part.trim()).filter(Boolean);
    const nonNull = parts.filter((part) => part.toLowerCase() !== 'null');
    if (nonNull.length === 1 && nonNull.length !== parts.length) {
      nullable = true;
      value = nonNull[0]!;
    } else {
      return UNKNOWN;
    }
  }

  const parsed = parseAtomicType(value);
  return nullable ? { kind: 'nullable', innerType: parsed } : parsed;
}

function parseAtomicType(value: string): KylatType {
  const lower = value.toLowerCase();
  if (lower === 'int' || lower === 'integer') return primitive('int');
  if (lower === 'float' || lower === 'double') return primitive('float');
  if (lower === 'string') return primitive('string');
  if (lower === 'bool' || lower === 'boolean') return primitive('bool');
  if (lower === 'null') return primitive('null');
  if (lower === 'array' || lower === 'iterable') return UNKNOWN;
  if (lower === 'mixed' || lower === 'void') return UNKNOWN;
  if (lower === 'callable' || lower === 'closure') return { kind: 'function', params: [], returnType: UNKNOWN };

  const list = parseGenericType(value, 'list');
  if (list && list.length === 1) {
    return { kind: 'list', itemType: parseTypeExpression(list[0]!) };
  }

  const map = parseGenericType(value, 'array');
  if (map && map.length === 2) {
    const keyType = map[0]!.trim().toLowerCase();
    if (keyType === 'string' || keyType === 'int' || keyType === 'integer') {
      return { kind: 'map', keyType: 'string', valueType: parseTypeExpression(map[1]!) };
    }
    return UNKNOWN;
  }

  return UNKNOWN;
}

/**
 * Parser generik tanpa regex berulang, untuk menghindari ReDoS pada input
 * docblock yang panjang.
 */
function parseGenericType(value: string, prefix: string): string[] | null {
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith(prefix)) return null;
  const rest = trimmed.slice(prefix.length).trimStart();
  if (!rest.startsWith('<')) return null;
  const open = trimmed.indexOf('<');
  if (open === -1 || !trimmed.endsWith('>')) return null;
  const inner = trimmed.slice(open + 1, -1).trim();
  if (!inner) return null;
  return splitTopLevel(inner);
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of value) {
    if (char === '<' || char === '(' || char === '[') depth++;
    if (char === '>' || char === ')' || char === ']') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

export function extractVarDocType(docblock: string): string | undefined {
  const match = /@var\s+([^\n]+)/i.exec(docblock);
  if (!match?.[1]) return undefined;
  const end = match[1].indexOf('*/');
  return (end === -1 ? match[1] : match[1].slice(0, end)).trim();
}

export function extractParamDocType(docblock: string, parameterName: string): string | undefined {
  const pattern = /@param\s+([^\s]+)\s+\$([A-Za-z_][A-Za-z0-9_]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(docblock)) !== null) {
    if (match[2] === parameterName) return match[1];
  }
  return undefined;
}

export function typeToString(type: KylatType): string {
  switch (type.kind) {
    case 'primitive':
      return type.name;
    case 'list':
      return `list<${typeToString(type.itemType)}>`;
    case 'map':
      return `array<string, ${typeToString(type.valueType)}>`;
    case 'nullable':
      return `${typeToString(type.innerType)}|null`;
    case 'enum':
      return type.enumName;
    case 'function':
      return 'callable';
    case 'unknown':
      return 'mixed';
  }
}

export function unwrapNullable(type: KylatType): KylatType {
  return type.kind === 'nullable' ? type.innerType : type;
}

export function isStringType(type: KylatType): boolean {
  return type.kind === 'primitive' && type.name === 'string';
}

export function isNumericType(type: KylatType): boolean {
  return type.kind === 'primitive' && (type.name === 'int' || type.name === 'float');
}

export function isKnown(type: KylatType): boolean {
  return type.kind !== 'unknown';
}

/**
 * Kesetaraan tipe sederhana untuk pemeriksaan assignment/return. Tipe unknown
 * selalu kompatibel agar analisis tetap progresif tanpa false positive.
 */
export function isAssignable(from: KylatType, to: KylatType): boolean {
  if (from.kind === 'unknown' || to.kind === 'unknown') return true;
  if (to.kind === 'nullable') {
    if (from.kind === 'primitive' && from.name === 'null') return true;
    return isAssignable(from, to.innerType);
  }
  if (from.kind === 'nullable') return isAssignable(from.innerType, to);
  if (from.kind !== to.kind) {
    if (isNumericType(from) && isNumericType(to)) return true;
    return false;
  }
  if (from.kind === 'primitive' && to.kind === 'primitive') {
    if (from.name === to.name) return true;
    return isNumericType(from) && isNumericType(to);
  }
  if (from.kind === 'list' && to.kind === 'list') {
    return isAssignable(from.itemType, to.itemType);
  }
  if (from.kind === 'map' && to.kind === 'map') {
    return isAssignable(from.valueType, to.valueType);
  }
  if (from.kind === 'enum' && to.kind === 'enum') {
    return from.enumName === to.enumName;
  }
  if (from.kind === 'function' && to.kind === 'function') return true;
  return false;
}
