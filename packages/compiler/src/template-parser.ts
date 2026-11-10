/**
 * @kylat/compiler - template-parser.ts
 * Parser template Kylat v0 (subset Blade) menjadi AST kecil yang deterministik.
 *
 * Aturan penting:
 * - Semua konstruksi yang tidak dikenal gagal cepat dengan KIL-151, bukan diabaikan.
 * - Karakter `<` yang bukan awal tag diperlakukan sebagai teks (tidak boleh hang).
 * - Teks, interpolasi, @if, @foreach, dan elemen disimpan dalam urutan dokumen.
 */

export interface SourceLocation {
  line: number;
  column: number;
}

export interface ParsedEvent {
  event: string;
  handlerCall: string;
  loc: SourceLocation;
}

export interface ParsedText {
  type: 'text';
  value: string;
  loc: SourceLocation;
}

export interface ParsedExpression {
  type: 'expression';
  expression: string;
  loc: SourceLocation;
}

export interface ParsedIfBranch {
  condition?: string;
  children: ParsedNode[];
  loc: SourceLocation;
}

export interface ParsedIf {
  type: 'if';
  branches: ParsedIfBranch[];
  loc: SourceLocation;
}

export interface ParsedForEach {
  type: 'foreach';
  collection: string;
  item: string;
  keyVar?: string;
  keyExpression?: string;
  children: ParsedNode[];
  emptyChildren: ParsedNode[];
  loc: SourceLocation;
}

export interface ParsedElement {
  type: 'element';
  tag: string;
  attributes: Record<string, string>;
  events: ParsedEvent[];
  children: ParsedElement[];
  nodes: ParsedNode[];
  bindings: Record<string, string>;
  dynamicAttributes: Record<string, string>;
  keyExpression?: string;
  errorPath?: string;
  /** Kompatibilitas parser lama: teks statis pada elemen daun. */
  textContent?: string;
  /** Kompatibilitas parser lama: `$state` pada elemen daun. */
  expressionBinding?: string;
  loc: SourceLocation;
}

export type ParsedNode =
  | ParsedElement
  | ParsedText
  | ParsedExpression
  | ParsedIf
  | ParsedForEach;

type Stop =
  | { kind: 'tag'; value: string }
  | { kind: 'directive'; values: ReadonlySet<string> };

interface SequenceResult {
  nodes: ParsedNode[];
  stop?: { kind: 'tag' | 'directive'; value: string };
}

export class TemplateError extends Error {
  public readonly code: string;
  public readonly line: number;
  public readonly column: number;

  constructor(code: string, message: string, loc: SourceLocation) {
    super(`${code}: ${message}`);
    this.name = 'TemplateError';
    this.code = code;
    this.line = loc.line;
    this.column = loc.column;
  }
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const UNSUPPORTED_DIRECTIVES = new Set([
  'for',
  'while',
  'switch',
  'php',
  'include',
  'extends',
  'yield',
  'section',
  'component',
  'slot',
]);

function isNameStart(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z_]/.test(ch);
}

function isNameChar(ch: string | undefined): boolean {
  return ch !== undefined && /[A-Za-z0-9_:-]/.test(ch);
}

/**
 * Mem-parse template menjadi AST. Melempar TemplateError dengan kode KIL-15x.
 */
export function parseTemplate(templateSource: string): ParsedElement[] {
  const parser = new TemplateParser(templateSource);
  const nodes = parser.parseRoot();

  // Kompatibilitas API lama: root harus berupa elemen. Teks root yang tidak
  // kosong tetap dipertahankan sebagai teks dan akan ditangani codegen.
  return nodes.filter((node): node is ParsedElement => node.type === 'element');
}

/**
 * Versi lengkap yang mempertahankan node teks/ekspresi/direktif di root.
 * Dipakai compiler dan codegen.
 */
export function parseTemplateNodes(templateSource: string): ParsedNode[] {
  return new TemplateParser(templateSource).parseRoot();
}

class TemplateParser {
  private readonly src: string;
  private readonly len: number;
  private readonly lineStarts: number[] = [0];
  private i = 0;

  constructor(src: string) {
    this.src = src;
    this.len = src.length;
    for (let index = 0; index < src.length; index++) {
      if (src[index] === '\n') this.lineStarts.push(index + 1);
    }
  }

  public parseRoot(): ParsedNode[] {
    const result = this.parseSequence(undefined);
    return this.mergeText(result.nodes);
  }

  private loc(index: number): SourceLocation {
    let low = 0;
    let high = this.lineStarts.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const start = this.lineStarts[mid] ?? 0;
      if (start <= index) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    const lineIndex = Math.max(0, high);
    const start = this.lineStarts[lineIndex] ?? 0;
    return { line: lineIndex + 1, column: index - start + 1 };
  }

  private error(code: string, message: string, index = this.i): never {
    throw new TemplateError(code, message, this.loc(index));
  }

  private parseSequence(stop: Stop | undefined): SequenceResult {
    const nodes: ParsedNode[] = [];

    while (this.i < this.len) {
      // Komentar HTML
      if (this.src.startsWith('<!--', this.i)) {
        const end = this.src.indexOf('-->', this.i + 4);
        if (end === -1) {
          this.error('KIL-150', 'Komentar HTML tidak ditutup dengan -->');
        }
        this.i = end + 3;
        continue;
      }

      // Tag penutup
      if (this.src.startsWith('</', this.i)) {
        const start = this.i;
        const end = this.src.indexOf('>', this.i + 2);
        if (end === -1) {
          this.error('KIL-150', 'Tag penutup tidak memiliki karakter penutup >');
        }
        const closing = this.src.slice(this.i + 2, end).trim().toLowerCase();
        this.i = end + 1;
        if (!closing) {
          this.error('KIL-150', 'Tag penutup kosong tidak sah', start);
        }
        if (stop?.kind === 'tag' && stop.value.toLowerCase() === closing) {
          return { nodes, stop: { kind: 'tag', value: closing } };
        }
        if (stop?.kind === 'tag') {
          this.error(
            'KIL-150',
            `Tag penutup </${closing}> tidak cocok dengan tag pembuka <${stop.value}>`,
            start
          );
        }
        this.error(
          'KIL-150',
          `Tag penutup </${closing}> tidak memiliki pasangan tag pembuka`,
          start
        );
      }

      // Direktif
      if (this.src[this.i] === '@') {
        const directiveStart = this.i;
        const name = this.peekDirectiveName();
        if (name) {
          if (stop?.kind === 'directive' && stop.values.has(name)) {
            this.i += name.length + 1;
            return { nodes, stop: { kind: 'directive', value: name } };
          }
          if (name === 'if') {
            nodes.push(this.parseIf());
            continue;
          }
          if (name === 'foreach') {
            nodes.push(this.parseForEach());
            continue;
          }
          if (UNSUPPORTED_DIRECTIVES.has(name)) {
            this.error(
              'KIL-151',
              `Direktif @${name} tidak didukung di Kylat v0. Gunakan @if, @foreach, atau <x-nama>.`,
              directiveStart
            );
          }
          this.error('KIL-151', `Direktif @${name} tidak dikenal.`, directiveStart);
        }
      }

      // Tag pembuka
      if (this.src[this.i] === '<' && isNameStart(this.src[this.i + 1])) {
        nodes.push(this.parseElement());
        continue;
      }

      // Teks / interpolasi
      const textNode = this.parseText();
      if (textNode) {
        nodes.push(textNode);
        continue;
      }

      // Jangan pernah membiarkan i tidak maju.
      const ch = this.src[this.i];
      if (ch !== undefined) {
        this.i++;
        nodes.push({
          type: 'text',
          value: ch,
          loc: this.loc(this.i - 1),
        });
      }
    }

    if (stop?.kind === 'tag') {
      this.error('KIL-150', `Tag <${stop.value}> tidak ditutup`);
    }
    if (stop?.kind === 'directive') {
      this.error('KIL-151', `Direktif ${Array.from(stop.values).join('/')} tidak ditutup`);
    }
    return { nodes };
  }

  private peekDirectiveName(): string | null {
    // @ dianggap direktif hanya bila berada di awal baris atau didahului
    // whitespace/penutup tag, agar email seperti a@b.com tetap teks biasa.
    const previous = this.i > 0 ? this.src[this.i - 1] : undefined;
    if (previous !== undefined && !/[\s>}]/.test(previous)) {
      return null;
    }
    const match = /^@([A-Za-z][A-Za-z0-9_]*)/.exec(this.src.slice(this.i));
    return match?.[1] ?? null;
  }

  private parseText(): ParsedNode | null {
    const start = this.i;
    let value = '';

    while (this.i < this.len) {
      if (this.src.startsWith('{{', this.i)) {
        if (value.length > 0) {
          return { type: 'text', value, loc: this.loc(start) };
        }
        return this.parseExpression();
      }
      if (this.src.startsWith('{!!', this.i)) {
        this.error('KIL-152', "HTML mentah '{!! !!}' dilarang. Gunakan interpolasi aman '{{ }}'.");
      }
      if (this.src[this.i] === '<') {
        break;
      }
      if (this.src[this.i] === '@') {
        if (this.src[this.i + 1] === '@') {
          value += '@';
          this.i += 2;
          continue;
        }
        if (this.peekDirectiveName()) {
          break;
        }
      }
      value += this.src[this.i];
      this.i++;
      if (this.src[this.i] === '<' || this.src[this.i] === '@' || this.src.startsWith('{{', this.i)) {
        break;
      }
    }

    if (value.length === 0) return null;
    return { type: 'text', value, loc: this.loc(start) };
  }

  private parseExpression(): ParsedExpression {
    const start = this.i;
    const end = this.src.indexOf('}}', this.i + 2);
    if (end === -1) {
      this.error('KIL-150', 'Interpolasi {{ }} tidak ditutup dengan }}', start);
    }
    const expression = this.src.slice(this.i + 2, end).trim();
    if (!expression) {
      this.error('KIL-150', 'Interpolasi {{ }} kosong tidak sah', start);
    }
    this.i = end + 2;
    return { type: 'expression', expression, loc: this.loc(start) };
  }

  private parseDirectiveParams(name: string): string {
    const start = this.i;
    this.skipWhitespace();
    if (this.src[this.i] !== '(') {
      this.error('KIL-151', `Direktif @${name} wajib memiliki tanda kurung.`, start);
    }
    const open = this.i;
    let depth = 0;
    let quote: string | null = null;
    this.i++;
    const contentStart = this.i;
    while (this.i < this.len) {
      const ch = this.src[this.i]!;
      if (quote) {
        if (ch === '\\') {
          this.i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        this.i++;
        continue;
      }
      if (ch === "'" || ch === '"') {
        quote = ch;
        this.i++;
        continue;
      }
      if (ch === '(') depth++;
      if (ch === ')') {
        if (depth === 0) {
          const content = this.src.slice(contentStart, this.i).trim();
          this.i++;
          return content;
        }
        depth--;
      }
      this.i++;
    }
    this.error('KIL-151', `Tanda kurung direktif @${name} tidak ditutup.`, open);
  }

  private parseIf(): ParsedIf {
    const start = this.i;
    this.i += 3; // @if
    const condition = this.parseDirectiveParams('if');
    const branches: ParsedIfBranch[] = [];

    let result = this.parseSequence({
      kind: 'directive',
      values: new Set(['elseif', 'else', 'endif']),
    });
    branches.push({ condition, children: result.nodes, loc: this.loc(start) });

    while (result.stop?.value === 'elseif') {
      const branchStart = this.i - 'elseif'.length;
      const nextCondition = this.parseDirectiveParams('elseif');
      result = this.parseSequence({
        kind: 'directive',
        values: new Set(['elseif', 'else', 'endif']),
      });
      branches.push({
        condition: nextCondition,
        children: result.nodes,
        loc: this.loc(branchStart),
      });
    }

    if (result.stop?.value === 'else') {
      const elseStart = this.i - 'else'.length;
      result = this.parseSequence({
        kind: 'directive',
        values: new Set(['endif']),
      });
      branches.push({ children: result.nodes, loc: this.loc(elseStart) });
    }

    if (result.stop?.value !== 'endif') {
      this.error('KIL-151', 'Direktif @if tidak ditutup dengan @endif', start);
    }
    return { type: 'if', branches, loc: this.loc(start) };
  }

  private parseForEach(): ParsedForEach {
    const start = this.i;
    this.i += 8; // @foreach
    const header = this.parseDirectiveParams('foreach');

    const match = /^\s*(\$[A-Za-z_][A-Za-z0-9_]*)\s+as\s+(?:(\$[A-Za-z_][A-Za-z0-9_]*)\s*=>\s*)?(\$[A-Za-z_][A-Za-z0-9_]*)\s*$/.exec(
      header
    );
    if (!match) {
      this.error(
        'KIL-151',
        'Sintaks @foreach wajib: @foreach ($items as $item) atau @foreach ($items as $key => $item).',
        start
      );
    }
    const collection = match[1]!;
    const keyVar = match[2] ? match[2].slice(1) : undefined;
    const item = match[3]!.slice(1);

    let result = this.parseSequence({
      kind: 'directive',
      values: new Set(['empty', 'endforeach']),
    });
    const children = result.nodes;
    let emptyChildren: ParsedNode[] = [];

    if (result.stop?.value === 'empty') {
      result = this.parseSequence({
        kind: 'directive',
        values: new Set(['endforeach']),
      });
      emptyChildren = result.nodes;
    }

    if (result.stop?.value !== 'endforeach') {
      this.error('KIL-151', 'Direktif @foreach tidak ditutup dengan @endforeach', start);
    }

    return {
      type: 'foreach',
      collection,
      item,
      keyVar,
      children,
      emptyChildren,
      loc: this.loc(start),
    };
  }

  private parseElement(): ParsedElement {
    const start = this.i;
    this.i++; // <
    let tag = '';
    while (this.i < this.len && isNameChar(this.src[this.i])) {
      tag += this.src[this.i];
      this.i++;
    }
    if (!tag) {
      this.error('KIL-150', 'Nama tag kosong tidak sah', start);
    }

    const attributes: Record<string, string> = {};
    const events: ParsedEvent[] = [];
    const bindings: Record<string, string> = {};
    const dynamicAttributes: Record<string, string> = {};
    let keyExpression: string | undefined;
    let errorPath: string | undefined;
    let selfClosing = false;

    while (this.i < this.len) {
      this.skipWhitespace();
      if (this.i >= this.len) {
        this.error('KIL-150', `Tag <${tag}> tidak selesai (kehilangan >)`, start);
      }
      if (this.src[this.i] === '>') {
        this.i++;
        break;
      }
      if (this.src[this.i] === '/' && this.src[this.i + 1] === '>') {
        selfClosing = true;
        this.i += 2;
        break;
      }

      const attrStart = this.i;
      let attrName = '';
      while (this.i < this.len && /[A-Za-z0-9_:@.-]/.test(this.src[this.i]!)) {
        attrName += this.src[this.i];
        this.i++;
      }
      if (!attrName) {
        // Karakter tak terduga; maju agar tidak pernah berputar selamanya.
        this.i++;
        continue;
      }

      this.skipWhitespace();
      let attrValue = '';
      if (this.src[this.i] === '=') {
        this.i++;
        this.skipWhitespace();
        if (this.src[this.i] === '"' || this.src[this.i] === "'") {
          const quote = this.src[this.i]!;
          this.i++;
          while (this.i < this.len) {
            if (this.src[this.i] === '\\' && this.i + 1 < this.len) {
              attrValue += this.src[this.i + 1];
              this.i += 2;
            } else if (this.src[this.i] === quote) {
              this.i++;
              break;
            } else {
              attrValue += this.src[this.i];
              this.i++;
            }
          }
        } else {
          while (this.i < this.len && !/[\s>]/.test(this.src[this.i]!)) {
            if (this.src[this.i] === '/' && this.src[this.i + 1] === '>') break;
            attrValue += this.src[this.i];
            this.i++;
          }
        }
      }

      attributes[attrName] = attrValue;

      if (attrName.startsWith('on:')) {
        const event = attrName.slice(3);
        if (!event) {
          this.error('KIL-151', 'Nama event pada on: tidak boleh kosong', attrStart);
        }
        events.push({ event, handlerCall: attrValue.trim(), loc: this.loc(attrStart) });
      } else if (attrName.startsWith('bind:')) {
        bindings[attrName.slice(5)] = attrValue.trim();
      } else if (attrName.startsWith(':')) {
        dynamicAttributes[attrName.slice(1)] = attrValue.trim();
      } else if (attrName === 'key') {
        keyExpression = attrValue.trim();
      } else if (attrName === 'error') {
        errorPath = attrValue.trim();
      }
    }

    if (VOID_TAGS.has(tag.toLowerCase())) selfClosing = true;

    const element: ParsedElement = {
      type: 'element',
      tag,
      attributes,
      events,
      children: [],
      nodes: [],
      bindings,
      dynamicAttributes,
      keyExpression,
      errorPath,
      loc: this.loc(start),
    };

    if (selfClosing) {
      return element;
    }

    const result = this.parseSequence({ kind: 'tag', value: tag });
    if (result.stop?.kind !== 'tag') {
      this.error('KIL-150', `Tag <${tag}> tidak ditutup`, start);
    }
    element.nodes = this.mergeText(result.nodes);
    element.children = element.nodes.filter(
      (node): node is ParsedElement => node.type === 'element'
    );

    const meaningful = element.nodes.filter(
      (node) => !(node.type === 'text' && node.value.trim() === '')
    );
    if (meaningful.length === 1) {
      const only = meaningful[0]!;
      if (only.type === 'text') {
        element.textContent = only.value.trim();
      } else if (only.type === 'expression') {
        const simple = /^\$([A-Za-z_][A-Za-z0-9_]*)$/.exec(only.expression);
        if (simple) element.expressionBinding = simple[1];
      }
    }

    return element;
  }

  private mergeText(nodes: ParsedNode[]): ParsedNode[] {
    const merged: ParsedNode[] = [];
    for (const node of nodes) {
      const previous = merged[merged.length - 1];
      if (node.type === 'text' && previous?.type === 'text') {
        previous.value += node.value;
      } else {
        merged.push(node);
      }
    }
    return merged;
  }

  private skipWhitespace(): void {
    while (this.i < this.len && /\s/.test(this.src[this.i]!)) this.i++;
  }
}
