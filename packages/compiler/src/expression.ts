/**
 * @kylat/compiler - expression.ts
 * Penerjemah ekspresi PHP subset v0 ke JavaScript.
 *
 * Yang didukung: variabel state/prop/loop, akses properti `->`, indeks array,
 * literal, operator aritmetika/perbandingan strict/logika, concat `.`,
 * ternary, null-coalescing, dan allowlist fungsi string/array sederhana.
 *
 * Yang ditolak: `$this`, pemanggilan method, `==`/`!=`, fungsi di luar allowlist,
 * dan nama yang tidak dapat di-resolve.
 */

export interface ExpressionContext {
  state: ReadonlySet<string>;
  props: ReadonlySet<string>;
  /** Nama variabel loop PHP -> identifier JavaScript. */
  loops: ReadonlyMap<string, string>;
}

export class ExpressionError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ExpressionError';
    this.code = code;
  }
}

interface Token {
  type: 'var' | 'ident' | 'number' | 'string' | 'op' | 'punct';
  value: string;
}

const ALLOWED_FUNCTIONS = new Set([
  'count',
  'mb_strlen',
  'str_contains',
  'str_starts_with',
  'implode',
  'explode',
  'array_values',
]);

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const push = (type: Token['type'], value: string): void => {
    tokens.push({ type, value });
  };

  while (i < source.length) {
    const ch = source[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '$') {
      const match = /^\$([A-Za-z_][A-Za-z0-9_]*)/.exec(source.slice(i));
      if (!match) throw new ExpressionError('KIL-104', `Variabel tidak valid pada '${source}'.`);
      push('var', match[1]!);
      i += match[0].length;
      continue;
    }

    if (/[A-Za-z_]/.test(ch)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(i))!;
      push('ident', match[0]);
      i += match[0].length;
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const match = /^[0-9]+(?:\.[0-9]+)?/.exec(source.slice(i))!;
      push('number', match[0]);
      i += match[0].length;
      continue;
    }

    if (ch === "'" || ch === '"') {
      const quote = ch;
      let value = '';
      i++;
      let closed = false;
      while (i < source.length) {
        const current = source[i]!;
        if (current === '\\' && i + 1 < source.length) {
          const next = source[i + 1]!;
          if (quote === "'" && next !== "'" && next !== '\\') {
            value += '\\' + next;
          } else {
            value += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
          }
          i += 2;
          continue;
        }
        if (current === quote) {
          i++;
          closed = true;
          break;
        }
        value += current;
        i++;
      }
      if (!closed) throw new ExpressionError('KIL-104', 'String pada ekspresi tidak ditutup.');
      if (quote === '"' && value.includes('$')) {
        throw new ExpressionError(
          'KIL-104',
          'Interpolasi variabel di dalam string belum didukung. Gunakan penggabungan dengan titik (.).'
        );
      }
      push('string', value);
      continue;
    }

    const three = source.slice(i, i + 3);
    if (three === '===' || three === '!==' || three === '?->') {
      push('op', three);
      i += 3;
      continue;
    }

    const two = source.slice(i, i + 2);
    if (['==', '!=', '<=', '>=', '&&', '||', '??', '->'].includes(two)) {
      push('op', two);
      i += 2;
      continue;
    }

    if ('+-*/.%<>!?:()[],'.includes(ch)) {
      push('punct', ch);
      i++;
      continue;
    }

    throw new ExpressionError('KIL-104', `Karakter '${ch}' tidak didukung pada ekspresi Kylat.`);
  }

  return tokens;
}

class ExpressionParser {
  private readonly tokens: Token[];
  private index = 0;

  constructor(
    private readonly source: string,
    private readonly context: ExpressionContext
  ) {
    this.tokens = tokenize(source);
  }

  public parse(): string {
    if (this.tokens.length === 0) {
      throw new ExpressionError('KIL-104', 'Ekspresi kosong tidak sah.');
    }
    const result = this.parseTernary();
    if (this.index < this.tokens.length) {
      throw new ExpressionError(
        'KIL-104',
        `Ekspresi '${this.source}' memiliki token tak terduga '${this.tokens[this.index]!.value}'.`
      );
    }
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.index];
  }

  private match(value: string): boolean {
    const token = this.peek();
    if (token && token.value === value) {
      this.index++;
      return true;
    }
    return false;
  }

  private expect(value: string): void {
    if (!this.match(value)) {
      throw new ExpressionError('KIL-104', `Diharapkan '${value}' pada ekspresi '${this.source}'.`);
    }
  }

  private parseTernary(): string {
    const condition = this.parseBinary(0);
    if (this.match('?')) {
      const consequent = this.parseTernary();
      this.expect(':');
      const alternate = this.parseTernary();
      return `(${condition} ? ${consequent} : ${alternate})`;
    }
    return condition;
  }

  private precedence(token: Token): number {
    if (token.type === 'ident' && token.value === 'or') return 1;
    if (token.type === 'ident' && token.value === 'and') return 2;
    if (token.value === '||') return 1;
    if (token.value === '&&') return 2;
    if (token.value === '??') return 3;
    if (['===', '!==', '==', '!='].includes(token.value)) return 4;
    if (['<', '>', '<=', '>='].includes(token.value)) return 5;
    if (['.', '+', '-'].includes(token.value)) return 6;
    if (['*', '/', '%'].includes(token.value)) return 7;
    return -1;
  }

  private parseBinary(minPrecedence: number): string {
    let left = this.parseUnary();
    while (true) {
      const token = this.peek();
      if (!token) break;
      const prec = this.precedence(token);
      if (prec < minPrecedence || prec === -1) break;
      this.index++;

      if (token.value === '==' || token.value === '!=') {
        throw new ExpressionError(
          'KIL-101',
          "Operator perbandingan longgar '==' dan '!=' dilarang. Gunakan '===' atau '!=='."
        );
      }

      const right = this.parseBinary(prec + 1);
      if (token.value === '.') {
        // Titik adalah konkatenasi string di PHP. String() mencegah JS
        // menjumlahkan dua angka ketika kedua operand bertipe number.
        left = `(String(${left}) + String(${right}))`;
        continue;
      }
      const operator =
        token.value === 'or' ? '||' : token.value === 'and' ? '&&' : token.value;
      left = `(${left} ${operator} ${right})`;
    }
    return left;
  }

  private parseUnary(): string {
    if (this.match('!')) return `!${this.parseUnary()}`;
    if (this.match('-')) return `-${this.parseUnary()}`;
    if (this.match('+')) return `+${this.parseUnary()}`;
    return this.parsePostfix();
  }

  private parsePostfix(): string {
    let value = this.parsePrimary();
    while (true) {
      if (this.match('->')) {
        const name = this.peek();
        if (!name || name.type !== 'ident') {
          throw new ExpressionError('KIL-104', "Akses properti '->' wajib diikuti nama properti.");
        }
        this.index++;
        if (this.peek()?.value === '(') {
          throw new ExpressionError(
            'KIL-104',
            'Pemanggilan method di dalam template dilarang. Pindahkan logika ke computed/aksi.'
          );
        }
        value = `${value}.${name.value}`;
        continue;
      }
      if (this.match('?->')) {
        const name = this.peek();
        if (!name || name.type !== 'ident') {
          throw new ExpressionError('KIL-104', "Akses properti '?->' wajib diikuti nama properti.");
        }
        this.index++;
        value = `${value}?.${name.value}`;
        continue;
      }
      if (this.match('[')) {
        const indexExpression = this.parseTernary();
        this.expect(']');
        value = `${value}[${indexExpression}]`;
        continue;
      }
      break;
    }
    return value;
  }

  private parsePrimary(): string {
    const token = this.peek();
    if (!token) {
      throw new ExpressionError('KIL-104', `Ekspresi '${this.source}' tidak lengkap.`);
    }

    if (token.type === 'number' || token.type === 'string') {
      this.index++;
      return token.type === 'number' ? token.value : JSON.stringify(token.value);
    }

    if (token.type === 'var') {
      this.index++;
      return this.resolveVariable(token.value);
    }

    if (token.type === 'ident') {
      this.index++;
      if (token.value === 'true') return 'true';
      if (token.value === 'false') return 'false';
      if (token.value === 'null') return 'null';
      if (this.peek()?.value === '(') {
        return this.parseFunctionCall(token.value);
      }
      throw new ExpressionError(
        'KIL-110',
        `Konstanta/nama '${token.value}' tidak didukung di template. Gunakan state, prop, atau variabel loop.`
      );
    }

    if (this.match('(')) {
      const inner = this.parseTernary();
      this.expect(')');
      return `(${inner})`;
    }

    if (this.match('[')) {
      const values: string[] = [];
      if (!this.match(']')) {
        do {
          values.push(this.parseTernary());
        } while (this.match(','));
        this.expect(']');
      }
      return `[${values.join(', ')}]`;
    }

    throw new ExpressionError(
      'KIL-104',
      `Token '${token.value}' tidak dapat dipakai pada awal ekspresi '${this.source}'.`
    );
  }

  private parseFunctionCall(name: string): string {
    if (!ALLOWED_FUNCTIONS.has(name)) {
      throw new ExpressionError(
        'KIL-110',
        `Fungsi '${name}' tidak ada di allowlist v0. Gunakan computed atau aksi server.`
      );
    }
    this.expect('(');
    const args: string[] = [];
    if (!this.match(')')) {
      do {
        args.push(this.parseTernary());
      } while (this.match(','));
      this.expect(')');
    }

    const one = args[0] ?? 'undefined';
    switch (name) {
      case 'count':
        return `(${one}).length`;
      case 'mb_strlen':
        return `String(${one}).length`;
      case 'str_contains':
        return `String(${one}).includes(String(${args[1] ?? "''"}))`;
      case 'str_starts_with':
        return `String(${one}).startsWith(String(${args[1] ?? "''"}))`;
      case 'implode':
        return `(${args[1] ?? '[]'}).join(${one})`;
      case 'explode':
        return `String(${args[1] ?? "''"}).split(${one})`;
      case 'array_values':
        return `Object.values(${one})`;
      default:
        throw new ExpressionError('KIL-110', `Fungsi '${name}' belum didukung.`);
    }
  }

  private resolveVariable(name: string): string {
    if (name === 'this') {
      throw new ExpressionError('KIL-104', '`$this` tidak boleh dipakai di template.');
    }
    const loop = this.context.loops.get(name);
    if (loop) return loop;
    if (this.context.state.has(name)) return `${name}()`;
    if (this.context.props.has(name)) {
      return `(typeof prop_${name} === 'function' ? prop_${name}() : prop_${name})`;
    }
    throw new ExpressionError(
      'KIL-104',
      `Nama '$${name}' tidak merujuk state, prop, atau variabel loop yang dideklarasikan.`
    );
  }
}

export function compileExpression(source: string, context: ExpressionContext): string {
  return new ExpressionParser(source.trim(), context).parse();
}

export function isSimpleVariable(source: string): string | null {
  const match = /^\$([A-Za-z_][A-Za-z0-9_]*)$/.exec(source.trim());
  return match?.[1] ?? null;
}
