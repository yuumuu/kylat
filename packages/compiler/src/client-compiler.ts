/**
 * @kylat/compiler - client-compiler.ts
 * Compiler AST PHP subset v0 untuk body method client/computed/lifecycle.
 *
 * Modul ini menghasilkan baris JavaScript dari AST, bukan dari string PHP.
 * Semua akses state/prop/computed melewati resolver simbol sehingga codegen
 * tidak perlu mengetahui sintaks PHP.
 */

import type Parser from 'web-tree-sitter';
import {
  isAssignable,
  isKnown,
  isNumericType,
  isStringType,
  parsePhpType,
  primitive,
  typeToString,
  UNKNOWN,
  type KylatType,
} from './types.js';

export class ClientCompileError extends Error {
  public readonly code: string;
  public readonly line: number;
  public readonly column: number;

  constructor(code: string, message: string, line = 1, column = 1) {
    super(message);
    this.name = 'ClientCompileError';
    this.code = code;
    this.line = line;
    this.column = column;
  }
}

export interface MethodSymbols {
  props: Map<string, KylatType>;
  state: Map<string, KylatType>;
  computed: Map<string, KylatType>;
  clientMethods: Set<string>;
}

export interface CompileMethodOptions {
  methodName: string;
  returnType: KylatType;
  params: Array<{ name: string; type: KylatType }>;
  symbols: MethodSymbols;
}

export interface CompiledMethodBody {
  lines: string[];
  locations: Array<{ line: number; column: number }>;
  dependencies: string[];
  hasControlFlow: boolean;
}

interface LocalBinding {
  jsName: string;
  type: KylatType;
  readonly: boolean;
}

const ALLOWED_FUNCTIONS = new Set([
  'count',
  'str_contains',
  'str_starts_with',
  'mb_strlen',
  'mb_substr',
  'mb_strtolower',
  'mb_strtoupper',
  'array_map',
  'array_filter',
  'array_slice',
  'array_values',
  'implode',
  'explode',
]);

const JS_RESERVED = new Set([
  'await','break','case','catch','class','const','continue','debugger','default','delete','do','else','enum','export','extends','false','finally','for','function','if','implements','import','in','instanceof','interface','let','new','null','package','private','protected','public','return','static','super','switch','this','throw','true','try','typeof','var','void','while','with','yield','undefined','NaN','Infinity',
]);

export function compileClientMethodBody(
  bodyNode: Parser.SyntaxNode | null,
  options: CompileMethodOptions
): CompiledMethodBody {
  const compiler = new ClientBodyCompiler(options);
  return compiler.compile(bodyNode);
}

class ClientBodyCompiler {
  private lines: string[] = [];
  private locations: Array<{ line: number; column: number }> = [];
  private readonly scopes: Array<Map<string, LocalBinding>> = [new Map()];
  private readonly dependencies = new Set<string>();
  private indent = 1;
  private loopDepth = 0;
  private tempCounter = 0;
  private hasControlFlow = false;
  private currentLocation = { line: 1, column: 0 };

  constructor(private readonly options: CompileMethodOptions) {
    for (const parameter of options.params) {
      this.scopes[0]!.set(parameter.name, {
        jsName: this.localName(parameter.name),
        type: parameter.type,
        readonly: true,
      });
    }
  }

  public compile(bodyNode: Parser.SyntaxNode | null): CompiledMethodBody {
    if (!bodyNode) return { lines: [], locations: [], dependencies: [], hasControlFlow: false };
    this.compileBlock(bodyNode, false);
    return {
      lines: this.lines,
      locations: this.locations,
      dependencies: Array.from(this.dependencies),
      hasControlFlow: this.hasControlFlow,
    };
  }

  private push(line: string): void {
    const prefix = '  '.repeat(this.indent);
    for (const part of line.split('\n')) {
      this.lines.push(`${prefix}${part}`);
      this.locations.push(this.currentLocation);
    }
  }

  private error(code: string, node: Parser.SyntaxNode, message: string): never {
    throw new ClientCompileError(
      code,
      message,
      node.startPosition.row + 1,
      node.startPosition.column + 1
    );
  }

  private unsupported(node: Parser.SyntaxNode, detail?: string): never {
    this.error(
      'KIL-104',
      node,
      `Konstruksi '${node.type}'${detail ? ` (${detail})` : ''} tidak didukung di method client v0.`
    );
  }

  private compileBlock(node: Parser.SyntaxNode, newScope = true): void {
    if (newScope) this.scopes.push(new Map());
    for (const child of node.namedChildren) {
      if (child.type === 'comment') continue;
      this.compileStatement(child);
    }
    if (newScope) this.scopes.pop();
  }

  private compileStatement(node: Parser.SyntaxNode): void {
    this.currentLocation = {
      line: node.startPosition.row + 1,
      column: node.startPosition.column,
    };
    switch (node.type) {
      case 'compound_statement':
        this.compileBlock(node);
        return;
      case 'expression_statement': {
        const expression = node.namedChildren[0];
        if (!expression) return;
        const code = this.emitExpression(expression, false);
        this.push(`${code};`);
        return;
      }
      case 'if_statement':
        this.hasControlFlow = true;
        this.compileIf(node);
        return;
      case 'foreach_statement':
        this.hasControlFlow = true;
        this.compileForeach(node);
        return;
      case 'for_statement':
        this.hasControlFlow = true;
        this.compileFor(node);
        return;
      case 'return_statement':
        this.hasControlFlow = true;
        this.compileReturn(node);
        return;
      case 'break_statement':
        if (this.loopDepth === 0) this.error('KIL-104', node, '`break` hanya sah di dalam loop.');
        this.push('break;');
        return;
      case 'continue_statement':
        if (this.loopDepth === 0) this.error('KIL-104', node, '`continue` hanya sah di dalam loop.');
        this.push('continue;');
        return;
      case 'echo_statement':
      case 'unset_statement':
      case 'global_declaration':
      case 'static_variable_declaration':
      case 'while_statement':
      case 'do_statement':
      case 'switch_statement':
      case 'try_statement':
      case 'throw_expression':
      case 'goto_statement':
      case 'labeled_statement':
      case 'function_definition':
      case 'class_declaration':
        this.unsupported(node);
        return;
      case 'empty_statement':
        return;
      default:
        this.unsupported(node);
    }
  }

  private compileIf(node: Parser.SyntaxNode): void {
    const branches: Array<{ condition: Parser.SyntaxNode | null; body: Parser.SyntaxNode }> = [];
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');
    if (!condition || !body) this.unsupported(node, 'if tanpa kondisi/body');
    branches.push({ condition: condition!, body: body! });

    for (const child of node.children) {
      if (child.type === 'else_if_clause') {
        const nestedCondition = child.childForFieldName('condition');
        const nestedBody = child.childForFieldName('body');
        if (!nestedCondition || !nestedBody) this.unsupported(child);
        branches.push({ condition: nestedCondition, body: nestedBody });
      } else if (child.type === 'else_clause') {
        const nestedBody = child.childForFieldName('body');
        if (!nestedBody) this.unsupported(child);
        branches.push({ condition: null, body: nestedBody });
      }
    }

    branches.forEach((branch, index) => {
      if (index === 0) {
        this.push(`if (${this.emitExpression(branch.condition!, true)}) {`);
      } else if (branch.condition) {
        this.push(`} else if (${this.emitExpression(branch.condition, true)}) {`);
      } else {
        this.push('} else {');
      }
      this.indent++;
      this.compileBlock(branch.body);
      this.indent--;
    });
    this.push('}');
  }

  private compileForeach(node: Parser.SyntaxNode): void {
    const children = node.children;
    const asIndex = children.findIndex((child) => child.type === 'as');
    if (asIndex <= 0) this.unsupported(node, 'foreach tanpa as');
    const sourceNode = children[asIndex - 1];
    const targetNode = children[asIndex + 1];
    if (!sourceNode || !targetNode) this.unsupported(node, 'foreach tanpa sumber/target');

    const source = this.emitExpression(sourceNode, true);
    const temp = `iter_${++this.tempCounter}`;
    this.push(`const ${temp} = ${source};`);

    let keyName: string | null = null;
    let itemName: string;
    let keyPhpName: string | null = null;
    let itemPhpName: string;
    if (targetNode.type === 'pair') {
      const targetChildren = targetNode.namedChildren;
      const keyNode = targetChildren[0];
      const valueNode = targetChildren[1];
      if (!keyNode || !valueNode || keyNode.type !== 'variable_name' || valueNode.type !== 'variable_name') {
        this.unsupported(targetNode, 'destructuring foreach belum didukung');
      }
      keyPhpName = keyNode!.text.replace(/^\$/, '');
      itemPhpName = valueNode!.text.replace(/^\$/, '');
      keyName = this.localName(keyPhpName);
      itemName = this.localName(itemPhpName);
    } else if (targetNode.type === 'variable_name') {
      itemPhpName = targetNode.text.replace(/^\$/, '');
      itemName = this.localName(itemPhpName);
    } else {
      this.unsupported(targetNode, 'target foreach harus variabel');
    }

    const sourceType = this.inferExpression(sourceNode);
    const itemType =
      sourceType.kind === 'list'
        ? sourceType.itemType
        : sourceType.kind === 'map'
          ? sourceType.valueType
          : UNKNOWN;
    const keyType = sourceType.kind === 'map' ? primitive('string') : primitive('int');

    this.scopes.push(new Map());
    this.declareLocal(itemPhpName, itemType, true);
    if (keyPhpName) this.declareLocal(keyPhpName, keyType, true);

    if (keyName) {
      this.push(
        `for (const [${keyName}, ${itemName}] of (Array.isArray(${temp}) ? ${temp}.map((value, index) => [index, value]) : Object.entries(${temp}))) {`
      );
    } else {
      this.push(
        `for (const ${itemName} of (Array.isArray(${temp}) ? ${temp} : Object.values(${temp}))) {`
      );
    }
    this.indent++;
    this.loopDepth++;
    const body = node.childForFieldName('body');
    if (!body) this.unsupported(node, 'foreach tanpa body');
    this.compileBlock(body!);
    this.loopDepth--;
    this.indent--;
    this.push('}');
    this.scopes.pop();
  }

  private compileFor(node: Parser.SyntaxNode): void {
    const init = node.childForFieldName('initialize');
    const condition = node.childForFieldName('condition');
    const update = node.childForFieldName('update');
    const body = node.childForFieldName('body');
    if (!body) this.unsupported(node, 'for tanpa body');

    this.scopes.push(new Map());
    const initCode = init ? this.emitExpression(init, false, true) : '';
    const conditionCode = condition ? this.emitExpression(condition, true) : 'true';
    const updateCode = update ? this.emitExpression(update, false) : '';
    this.push(`for (${initCode}; ${conditionCode}; ${updateCode}) {`);
    this.indent++;
    this.loopDepth++;
    this.compileBlock(body);
    this.loopDepth--;
    this.indent--;
    this.push('}');
    this.scopes.pop();
  }

  private compileReturn(node: Parser.SyntaxNode): void {
    const expression = node.namedChildren[0];
    if (!expression) {
      this.push('return;');
      return;
    }
    const type = this.inferExpression(expression);
    if (isKnown(this.options.returnType) && isKnown(type) && !isAssignable(type, this.options.returnType)) {
      this.error(
        'KIL-131',
        expression,
        `Nilai return bertipe '${typeToString(type)}' tidak kompatibel dengan tipe method '${typeToString(this.options.returnType)}'.`
      );
    }
    this.push(`return ${this.emitExpression(expression, false)};`);
  }

  private emitExpression(
    node: Parser.SyntaxNode,
    inBooleanContext: boolean,
    forInit = false
  ): string {
    switch (node.type) {
      case 'variable_name':
        return this.emitVariable(node);
      case 'member_access_expression':
      case 'nullsafe_member_access_expression':
        return this.emitMemberAccess(node);
      case 'subscript_expression':
        return this.emitSubscript(node);
      case 'binary_expression':
        return this.emitBinary(node);
      case 'unary_op_expression':
        return this.emitUnary(node);
      case 'update_expression':
        return this.emitUpdate(node, false);
      case 'assignment_expression':
        return this.emitAssignment(node, forInit);
      case 'augmented_assignment_expression':
        return this.emitAugmentedAssignment(node, forInit);
      case 'conditional_expression':
        return this.emitConditional(node);
      case 'parenthesized_expression': {
        const inner = node.namedChildren[0];
        if (!inner) this.unsupported(node);
        return `(${this.emitExpression(inner!, inBooleanContext)})`;
      }
      case 'function_call_expression':
        return this.emitFunctionCall(node);
      case 'member_call_expression':
        return this.emitMemberCall(node);
      case 'object_creation_expression':
        this.error('KIL-110', node, 'Instansiasi kelas dengan `new` tidak diizinkan di client.');
        return '';
      case 'array_creation_expression':
        return this.emitArray(node);
      case 'arrow_function':
        return this.emitArrowFunction(node);
      case 'anonymous_function':
      case 'anonymous_function_creation_expression':
        return this.emitAnonymousFunction(node);
      case 'cast_expression':
        return this.emitCast(node);
      case 'integer':
        return this.emitInteger(node);
      case 'float':
        return node.text;
      case 'string':
        return JSON.stringify(decodePhpStringLiteral(node.text));
      case 'boolean':
        return node.text.toLowerCase() === 'true' ? 'true' : 'false';
      case 'null':
        return 'null';
      case 'name':
        return this.emitNameConstant(node);
      case 'match_expression':
        this.error('KIL-104', node, 'Ekspresi match ditunda ke v0.1.');
        return '';
      case 'encapsed_string':
        return this.emitEncapsedString(node);
      case 'include_expression':
      case 'require_expression':
      case 'include_once_expression':
      case 'require_once_expression':
        this.error('KIL-120', node, 'Include/require tidak diizinkan di method client.');
        return '';
      case 'eval_expression':
        this.error('KIL-104', node, 'eval() dilarang di seluruh Kylat.');
        return '';
      case 'yield_expression':
        this.error('KIL-104', node, 'Generator yield tidak diizinkan.');
        return '';
      default:
        this.unsupported(node);
    }
  }

  private emitVariable(node: Parser.SyntaxNode): string {
    if (node.text === '$this') {
      this.error('KIL-104', node, '`$this` hanya sah sebagai `$this->properti`.');
    }
    const name = node.text.replace(/^\$/, '');
    const local = this.lookupLocal(name);
    if (local) return local.jsName;

    if (this.options.symbols.state.has(name)) {
      this.dependencies.add(name);
      return `${name}()`;
    }
    if (this.options.symbols.computed.has(name)) {
      this.dependencies.add(name);
      return `${name}()`;
    }
    if (this.options.symbols.props.has(name)) {
      this.dependencies.add(name);
      return this.readProp(name);
    }
    this.error(
      'KIL-104',
      node,
      `Variabel '$${name}' tidak dideklarasikan. Deklarasikan state, prop, parameter, atau variabel lokal.`
    );
  }

  private emitMemberAccess(node: Parser.SyntaxNode): string {
    const object = node.childForFieldName('object');
    const nameNode = node.childForFieldName('name');
    if (!object || !nameNode) this.unsupported(node);
    const property = nameNode!.text;
    const nullsafe = node.type === 'nullsafe_member_access_expression';
    if (object!.text === '$this') {
      if (this.options.symbols.state.has(property)) {
        this.dependencies.add(property);
        return `${property}()`;
      }
      if (this.options.symbols.computed.has(property)) {
        this.dependencies.add(property);
        return `${property}()`;
      }
      if (this.options.symbols.props.has(property)) {
        this.dependencies.add(property);
        return this.readProp(property);
      }
      this.error('KIL-104', node, `Properti '$this->${property}' tidak dideklarasikan.`);
    }
    const objectCode = this.emitExpression(object!, false);
    return `${objectCode}${nullsafe ? '?.' : '.'}${property}`;
  }

  private emitSubscript(node: Parser.SyntaxNode): string {
    const object = node.namedChildren[0];
    const index = node.namedChildren[1];
    if (!object) this.unsupported(node);
    const objectCode = this.emitExpression(object!, false);
    const indexCode = index ? this.emitExpression(index, false) : 'undefined';
    return `${objectCode}[${indexCode}]`;
  }

  private emitBinary(node: Parser.SyntaxNode): string {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    const operator = node.childForFieldName('operator')?.text ?? '';
    if (!left || !right) this.unsupported(node);
    if (operator === '==' || operator === '!=') {
      this.error(
        'KIL-101',
        node,
        "Operator perbandingan longgar '==' dan '!=' dilarang. Gunakan '===' atau '!=='."
      );
    }

    if (operator === '.') {
      const leftType = this.inferExpression(left!);
      const rightType = this.inferExpression(right!);
      if ((isKnown(leftType) && !isStringType(leftType)) || (isKnown(rightType) && !isStringType(rightType))) {
        this.error(
          'KIL-131',
          node,
          `Operator '.' hanya sah untuk dua operand string; ditemukan '${typeToString(leftType)}' dan '${typeToString(rightType)}'.`
        );
      }
      return `(String(${this.emitExpression(left!, false)}) + String(${this.emitExpression(right!, false)}))`;
    }

    const leftCode = this.emitExpression(left!, false);
    const rightCode = this.emitExpression(right!, false);
    if (operator === 'and') return `(${leftCode} && ${rightCode})`;
    if (operator === 'or') return `(${leftCode} || ${rightCode})`;
    if (operator === 'xor') return `(Boolean(${leftCode}) !== Boolean(${rightCode}))`;
    if (operator === '??') {
      return `(${leftCode} ?? ${rightCode})`;
    }
    if (['+', '-', '*', '/', '%', '**', '<', '>', '<=', '>=', '===', '!==', '&&', '||'].includes(operator)) {
      return `(${leftCode} ${operator} ${rightCode})`;
    }
    this.unsupported(node, `operator ${operator}`);
  }

  private emitUnary(node: Parser.SyntaxNode): string {
    const operator = node.children.find((child) => ['!', '-', '+', '~'].includes(child.text))?.text;
    const operand = node.namedChildren[0];
    if (!operator || !operand) this.unsupported(node);
    if (operator === '~') this.unsupported(node, 'bitwise not');
    return `${operator}${this.emitExpression(operand!, false)}`;
  }

  private emitUpdate(node: Parser.SyntaxNode, _forInit: boolean): string {
    const argument = node.childForFieldName('argument') ?? node.namedChildren[0];
    const operator = node.childForFieldName('operator')?.text ?? node.children.find((child) => ['++', '--'].includes(child.text))?.text;
    if (!argument || !operator) this.unsupported(node);
    const target = this.resolveWritableTarget(argument!);
    if (target.kind === 'state') {
      const delta = operator === '++' ? '+ 1' : '- 1';
      if (target.statement) return `set_${target.name}(${target.name}() ${delta})`;
      return `(set_${target.name}(${target.name}() ${delta}), ${target.name}())`;
    }
    if (target.kind === 'local') {
      return `${target.jsName}${operator}`;
    }
    this.error('KIL-104', argument!, 'Target ++/-- harus state lokal atau variabel lokal.');
  }

  private emitAssignment(node: Parser.SyntaxNode, forInit: boolean): string {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    if (!left || !right) this.unsupported(node);
    const target = this.resolveWritableTarget(left!);
    const valueCode = this.emitExpression(right!, false, forInit);
    const valueType = this.inferExpression(right!);
    if (target.kind === 'invalid') {
      this.error('KIL-104', left!, target.message);
    }
    this.checkAssignmentType(target.type, valueType, right!);

    if (target.kind === 'state') {
      return forInit
        ? `set_${target.name}(${valueCode})`
        : `(set_${target.name}(${valueCode}), ${target.name}())`;
    }
    if (target.kind === 'local') {
      if (target.declare) {
        this.declareLocal(target.name, valueType, false);
        return `let ${target.jsName} = ${valueCode}`;
      }
      return `${target.jsName} = ${valueCode}`;
    }
    this.error('KIL-104', left!, 'Target assignment tidak didukung.');
  }

  private emitAugmentedAssignment(node: Parser.SyntaxNode, _forInit: boolean): string {
    const left = node.childForFieldName('left');
    const right = node.childForFieldName('right');
    const operator = node.childForFieldName('operator')?.text ?? '';
    if (!left || !right || !operator) this.unsupported(node);
    const target = this.resolveWritableTarget(left!);
    const valueCode = this.emitExpression(right!, false);
    const operatorJs = operator === '.=' ? '+' : operator.slice(0, -1);
    const value = operator === '.=' ? `String(${valueCode})` : valueCode;

    if (target.kind === 'state') {
      const leftValue = operator === '.=' ? `String(${target.name}())` : `${target.name}()`;
      return `set_${target.name}(${leftValue} ${operatorJs} ${value})`;
    }
    if (target.kind === 'local') {
      return `${target.jsName} ${operatorJs}= ${value}`;
    }
    this.error('KIL-104', left!, target.message);
  }

  private emitConditional(node: Parser.SyntaxNode): string {
    const condition = node.childForFieldName('condition');
    const body = node.childForFieldName('body');
    const alternative = node.childForFieldName('alternative');
    if (!condition || !body || !alternative) this.unsupported(node);
    return `(${this.emitExpression(condition!, true)} ? ${this.emitExpression(body!, false)} : ${this.emitExpression(alternative!, false)})`;
  }

  private emitFunctionCall(node: Parser.SyntaxNode): string {
    const functionNode = node.childForFieldName('function');
    const argsNode = node.childForFieldName('arguments');
    if (!functionNode) this.unsupported(node);
    if (functionNode!.type === 'variable_name') {
      const localName = functionNode!.text.replace(/^\$/, '');
      const local = this.lookupLocal(localName);
      if (!local || local.type.kind !== 'function') {
        this.error('KIL-110', node, `Variabel fungsi '$${localName}' bukan closure lokal yang sah.`);
      }
      const args = this.argumentNodes(argsNode).map((arg) => this.emitExpression(arg, false));
      return `${local!.jsName}(${args.join(', ')})`;
    }
    const rawName = functionNode!.text.replace(/^\\/, '');
    if (rawName === 'eval') {
      this.error('KIL-104', node, 'eval() dilarang di seluruh Kylat.');
    }
    if (rawName === 'usort') {
      this.error('KIL-110', node, '`usort` ditunda ke v0.1 dan tidak ada di allowlist v0.');
    }
    if (!ALLOWED_FUNCTIONS.has(rawName)) {
      this.error('KIL-110', node, `Fungsi '${rawName}' tidak ada di allowlist v0.`);
    }
    const args = this.argumentNodes(argsNode);

    switch (rawName) {
      case 'count': {
        const value = args[0] ? this.emitExpression(args[0], false) : 'undefined';
        return `(Array.isArray(${value}) ? ${value}.length : Object.keys(${value} ?? {}).length)`;
      }
      case 'mb_strlen': {
        const value = args[0] ? `String(${this.emitExpression(args[0], false)})` : "''";
        return `Array.from(${value}).length`;
      }
      case 'mb_substr': {
        const value = args[0] ? `String(${this.emitExpression(args[0], false)})` : "''";
        const start = args[1] ? this.emitExpression(args[1], false) : '0';
        if (args[2]) {
          const length = this.emitExpression(args[2], false);
          return `${value}.slice(${start}, ${start} + ${length})`;
        }
        return `${value}.slice(${start})`;
      }
      case 'mb_strtolower':
        return `String(${args[0] ? this.emitExpression(args[0], false) : "''"}).toLowerCase()`;
      case 'mb_strtoupper':
        return `String(${args[0] ? this.emitExpression(args[0], false) : "''"}).toUpperCase()`;
      case 'str_contains': {
        const haystack = args[0] ? `String(${this.emitExpression(args[0], false)})` : "''";
        const needle = args[1] ? `String(${this.emitExpression(args[1], false)})` : "''";
        return `${haystack}.includes(${needle})`;
      }
      case 'str_starts_with': {
        const haystack = args[0] ? `String(${this.emitExpression(args[0], false)})` : "''";
        const needle = args[1] ? `String(${this.emitExpression(args[1], false)})` : "''";
        return `${haystack}.startsWith(${needle})`;
      }
      case 'implode': {
        const glue = args[0] ? this.emitExpression(args[0], false) : "''";
        const array = args[1] ? this.emitExpression(args[1], false) : '[]';
        return `Object.values(${array}).join(${glue})`;
      }
      case 'explode': {
        const delimiter = args[0] ? this.emitExpression(args[0], false) : "''";
        const value = args[1] ? `String(${this.emitExpression(args[1], false)})` : "''";
        return `${value}.split(${delimiter})`;
      }
      case 'array_values': {
        const array = args[0] ? this.emitExpression(args[0], false) : '[]';
        return `Object.values(${array})`;
      }
      case 'array_slice': {
        const array = args[0] ? this.emitExpression(args[0], false) : '[]';
        const offset = args[1] ? this.emitExpression(args[1], false) : '0';
        if (args[2]) {
          const length = this.emitExpression(args[2], false);
          return `Object.values(${array}).slice(${offset}, ${offset} + ${length})`;
        }
        return `Object.values(${array}).slice(${offset})`;
      }
      case 'array_filter': {
        const array = args[0] ? this.emitExpression(args[0], false) : '[]';
        const callback = args[1] ? this.emitExpression(args[1], false) : '(value) => Boolean(value)';
        return `Object.fromEntries(Object.entries(${array}).filter(([__key, __value]) => Boolean((${callback})(__value, __key))))`;
      }
      case 'array_map': {
        const callback = args[0] ? this.emitExpression(args[0], false) : '(value) => value';
        const array = args[1] ? this.emitExpression(args[1], false) : '[]';
        return `(Array.isArray(${array}) ? ${array}.map((__value, __key) => (${callback})(__value, __key)) : Object.fromEntries(Object.entries(${array}).map(([__key, __value]) => [__key, (${callback})(__value, __key)])))`;
      }
      default:
        this.error('KIL-110', node, `Fungsi '${rawName}' belum didukung.`);
    }
  }

  private emitMemberCall(node: Parser.SyntaxNode): string {
    const object = node.childForFieldName('object');
    const nameNode = node.childForFieldName('name');
    const argsNode = node.childForFieldName('arguments');
    if (!object || !nameNode) this.unsupported(node);
    if (object!.text === '$this') {
      const method = nameNode!.text;
      if (this.options.symbols.clientMethods.has(method)) {
        const args = this.argumentNodes(argsNode).map((arg) => this.emitExpression(arg, false));
        return `${method}(${args.join(', ')})`;
      }
      this.error(
        'KIL-120',
        node,
        `Method '$this->${method}()' bukan method client yang dideklarasikan; akses objek/ORM harus lewat aksi server.`
      );
    }
    this.error('KIL-120', node, 'Pemanggilan method pada objek tidak diizinkan di client.');
  }

  private emitArray(node: Parser.SyntaxNode): string {
    const elements = node.namedChildren.filter((child) => child.type === 'array_element_initializer');
    let hasKey = false;
    const parts: string[] = [];
    elements.forEach((element) => {
      const children = element.namedChildren;
      if (children.length >= 2) {
        hasKey = true;
        const key = this.emitExpression(children[0]!, false);
        const value = this.emitExpression(children[1]!, false);
        parts.push(`[${key}]: ${value}`);
      } else if (children[0]) {
        parts.push(this.emitExpression(children[0], false));
      }
    });
    if (hasKey) {
      return `{ ${parts.join(', ')} }`;
    }
    return `[${parts.join(', ')}]`;
  }

  private emitArrowFunction(node: Parser.SyntaxNode): string {
    const parameters = this.parameterNodes(node.childForFieldName('parameters'));
    const body = node.namedChildren.find((child) => child.type !== 'formal_parameters');
    if (!body) this.unsupported(node);
    this.scopes.push(new Map());
    const paramCodes = parameters.map((param) => {
      const name = param.name;
      this.declareLocal(name, param.type, true);
      return this.localName(name);
    });
    const bodyCode = this.emitExpression(body!, false);
    this.scopes.pop();
    return `(${paramCodes.join(', ')}) => ${bodyCode}`;
  }

  private emitAnonymousFunction(node: Parser.SyntaxNode): string {
    const parameters = this.parameterNodes(node.childForFieldName('parameters'));
    const body = node.childForFieldName('body');
    if (!body) this.unsupported(node);
    this.scopes.push(new Map());
    const paramCodes = parameters.map((param) => {
      this.declareLocal(param.name, param.type, true);
      return this.localName(param.name);
    });

    const savedLines = this.lines;
    const savedLocations = this.locations;
    const savedIndent = this.indent;
    const innerLines: string[] = [];
    this.lines = innerLines;
    this.locations = [];
    this.indent = 1;
    this.compileBlock(body!, false);
    const bodyCode = innerLines.join('\n');
    this.lines = savedLines;
    this.locations = savedLocations;
    this.indent = savedIndent;
    this.scopes.pop();

    return `function (${paramCodes.join(', ')}) {\n${bodyCode}\n${'  '.repeat(savedIndent)}}`;
  }

  private emitCast(node: Parser.SyntaxNode): string {
    let typeNode: Parser.SyntaxNode | null = null;
    let valueNode: Parser.SyntaxNode | null = null;
    for (const child of node.children) {
      if (child.type === 'cast_type') typeNode = child;
      else if (child.type !== '(' && child.type !== ')') valueNode = child;
    }
    if (!typeNode || !valueNode) this.unsupported(node);
    const value = this.emitExpression(valueNode!, false);
    const type = typeNode!.text.toLowerCase();
    if (type === 'string' || type === 'binary') return `String(${value})`;
    if (type === 'int' || type === 'integer') return `Math.trunc(Number(${value}))`;
    if (type === 'float' || type === 'double') return `Number(${value})`;
    if (type === 'bool' || type === 'boolean') return `Boolean(${value})`;
    this.unsupported(node, `cast ${type}`);
  }

  private emitInteger(node: Parser.SyntaxNode): string {
    const value = Number(node.text.replace(/_/g, ''));
    if (!Number.isSafeInteger(value)) {
      this.error('KIL-131', node, `Integer '${node.text}' di luar rentang aman JavaScript.`);
    }
    return String(value);
  }

  private emitNameConstant(node: Parser.SyntaxNode): string {
    const name = node.text;
    if (name === 'true') return 'true';
    if (name === 'false') return 'false';
    if (name === 'null') return 'null';
    this.error('KIL-110', node, `Konstanta '${name}' tidak ada di allowlist v0.`);
  }

  private emitEncapsedString(node: Parser.SyntaxNode): string {
    const text = node.text;
    if (!text.startsWith('"') || !text.endsWith('"')) {
      this.error('KIL-104', node, 'Bentuk string tidak didukung.');
    }
    const inner = text.slice(1, -1);
    if (/(?<!\\)\$/.test(inner)) {
      this.error('KIL-104', node, 'Interpolasi string `$var` belum didukung. Gunakan konkatenasi titik.');
    }
    return JSON.stringify(decodePhpStringLiteral(text));
  }

  private resolveWritableTarget(node: Parser.SyntaxNode):
    | { kind: 'state'; name: string; type: KylatType; statement: boolean }
    | { kind: 'local'; name: string; jsName: string; type: KylatType; declare: boolean }
    | { kind: 'invalid'; message: string } {
    if (node.type === 'member_access_expression') {
      const object = node.childForFieldName('object');
      const nameNode = node.childForFieldName('name');
      if (object?.text === '$this' && nameNode) {
        const property = nameNode.text;
        if (this.options.symbols.props.has(property)) {
          return { kind: 'invalid', message: `Prop '$${property}' tidak boleh dimutasi dari client.` };
        }
        if (this.options.symbols.computed.has(property)) {
          return { kind: 'invalid', message: `Computed '$${property}' tidak boleh dimutasi.` };
        }
        const type = this.options.symbols.state.get(property);
        if (!type) {
          return { kind: 'invalid', message: `Properti '$${property}' tidak dideklarasikan sebagai state.` };
        }
        return { kind: 'state', name: property, type, statement: true };
      }
      return { kind: 'invalid', message: 'Assignment ke properti objek belum didukung.' };
    }
    if (node.type === 'variable_name') {
      if (node.text === '$this') return { kind: 'invalid', message: '`$this` tidak dapat menjadi target assignment.' };
      const name = node.text.replace(/^\$/, '');
      const local = this.lookupLocal(name);
      if (local) {
        if (local.readonly) return { kind: 'invalid', message: `Parameter '$${name}' tidak dapat dimutasi.` };
        return { kind: 'local', name, jsName: local.jsName, type: local.type, declare: false };
      }
      return { kind: 'local', name, jsName: this.localName(name), type: UNKNOWN, declare: true };
    }
    return { kind: 'invalid', message: 'Target assignment harus variabel lokal atau state `$this->...`.' };
  }

  private checkAssignmentType(target: KylatType, value: KylatType, node: Parser.SyntaxNode): void {
    if (!isKnown(target) || !isKnown(value)) return;
    if (target.kind === 'primitive' && target.name === 'null') return;
    if (!isAssignable(value, target)) {
      // Tipe numerik dan string dari mb_* sengaja tidak dipaksa pada v0;
      // KIL-131 hanya ditegakkan untuk operator titik dan return.
      if (isNumericType(target) || isStringType(target)) return;
      this.error(
        'KIL-131',
        node,
        `Nilai bertipe '${typeToString(value)}' tidak kompatibel dengan target '${typeToString(target)}'.`
      );
    }
  }

  private inferExpression(node: Parser.SyntaxNode): KylatType {
    switch (node.type) {
      case 'variable_name': {
        if (node.text === '$this') return UNKNOWN;
        const name = node.text.replace(/^\$/, '');
        const local = this.lookupLocal(name);
        if (local) return local.type;
        return (
          this.options.symbols.state.get(name) ??
          this.options.symbols.computed.get(name) ??
          this.options.symbols.props.get(name) ??
          UNKNOWN
        );
      }
      case 'integer':
        return primitive('int');
      case 'float':
        return primitive('float');
      case 'string':
        return primitive('string');
      case 'encapsed_string':
        return primitive('string');
      case 'boolean':
        return primitive('bool');
      case 'null':
        return primitive('null');
      case 'array_creation_expression': {
        const elements = node.namedChildren.filter((child) => child.type === 'array_element_initializer');
        const hasKey = elements.some((element) => element.namedChildren.length >= 2);
        if (hasKey) return { kind: 'map', keyType: 'string', valueType: UNKNOWN };
        return { kind: 'list', itemType: elements[0] ? this.inferExpression(elements[0].namedChildren[0] ?? elements[0]) : UNKNOWN };
      }
      case 'conditional_expression': {
        const body = node.childForFieldName('body');
        return body ? this.inferExpression(body) : UNKNOWN;
      }
      case 'parenthesized_expression': {
        const inner = node.namedChildren[0];
        return inner ? this.inferExpression(inner) : UNKNOWN;
      }
      case 'cast_expression': {
        const typeNode = node.children.find((child) => child.type === 'cast_type');
        return parsePhpType(typeNode?.text);
      }
      case 'binary_expression': {
        const operator = node.childForFieldName('operator')?.text ?? '';
        if (['===', '!==', '<', '>', '<=', '>=', '&&', '||', 'and', 'or', 'xor'].includes(operator)) {
          return primitive('bool');
        }
        if (operator === '.') return primitive('string');
        if (operator === '??') {
          const left = node.childForFieldName('left');
          const right = node.childForFieldName('right');
          const leftType = left ? this.inferExpression(left) : UNKNOWN;
          const rightType = right ? this.inferExpression(right) : UNKNOWN;
          if (leftType.kind === 'nullable') return rightType.kind === 'unknown' ? leftType.innerType : rightType;
          return leftType.kind === 'unknown' ? rightType : leftType;
        }
        return primitive('int');
      }
      case 'unary_op_expression': {
        const operand = node.namedChildren[0];
        return operand ? this.inferExpression(operand) : UNKNOWN;
      }
      case 'update_expression':
        return primitive('int');
      case 'assignment_expression': {
        const right = node.childForFieldName('right');
        return right ? this.inferExpression(right) : UNKNOWN;
      }
      case 'augmented_assignment_expression': {
        const left = node.childForFieldName('left');
        return left ? this.inferExpression(left) : UNKNOWN;
      }
      case 'function_call_expression': {
        const name = node.childForFieldName('function')?.text.replace(/^\\/, '') ?? '';
        if (name === 'count' || name === 'mb_strlen' || name === 'array_slice') return primitive('int');
        if (name === 'str_contains' || name === 'str_starts_with') return primitive('bool');
        if (name === 'mb_strtolower' || name === 'mb_strtoupper' || name === 'implode') return primitive('string');
        if (name === 'explode' || name === 'array_values' || name === 'array_slice' || name === 'array_filter') {
          return { kind: 'list', itemType: UNKNOWN };
        }
        if (name === 'array_map') {
          const args = this.argumentNodes(node.childForFieldName('arguments'));
          const arrayType = args[1] ? this.inferExpression(args[1]) : UNKNOWN;
          if (arrayType.kind === 'list') return { kind: 'list', itemType: UNKNOWN };
          return { kind: 'map', keyType: 'string', valueType: UNKNOWN };
        }
        return UNKNOWN;
      }
      case 'member_access_expression':
      case 'nullsafe_member_access_expression': {
        const object = node.childForFieldName('object');
        const nameNode = node.childForFieldName('name');
        if (object?.text === '$this' && nameNode) {
          return (
            this.options.symbols.state.get(nameNode.text) ??
            this.options.symbols.computed.get(nameNode.text) ??
            this.options.symbols.props.get(nameNode.text) ??
            UNKNOWN
          );
        }
        return UNKNOWN;
      }
      case 'subscript_expression': {
        const object = node.namedChildren[0];
        const objectType = object ? this.inferExpression(object) : UNKNOWN;
        if (objectType.kind === 'list') return objectType.itemType;
        if (objectType.kind === 'map') return objectType.valueType;
        return UNKNOWN;
      }
      case 'arrow_function':
      case 'anonymous_function':
      case 'anonymous_function_creation_expression':
        return { kind: 'function', params: [], returnType: UNKNOWN };
      case 'member_call_expression':
        return UNKNOWN;
      default:
        return UNKNOWN;
    }
  }

  private argumentNodes(argsNode: Parser.SyntaxNode | null): Parser.SyntaxNode[] {
    if (!argsNode) return [];
    return argsNode.namedChildren
      .filter((child) => child.type === 'argument')
      .map((argument) => argument.namedChildren[0] ?? argument);
  }

  private parameterNodes(
    paramsNode: Parser.SyntaxNode | null
  ): Array<{ name: string; type: KylatType }> {
    if (!paramsNode) return [];
    const params: Array<{ name: string; type: KylatType }> = [];
    for (const child of paramsNode.namedChildren) {
      if (child.type !== 'simple_parameter' && child.type !== 'property_promotion_parameter') continue;
      const nameNode = child.childForFieldName('name');
      const typeNode = child.childForFieldName('type');
      if (!nameNode) continue;
      params.push({
        name: nameNode.text.replace(/^\$/, ''),
        type: parsePhpType(typeNode?.text),
      });
    }
    return params;
  }

  private readProp(name: string): string {
    return `(typeof prop_${name} === 'function' ? prop_${name}() : prop_${name})`;
  }
  private lookupLocal(name: string): LocalBinding | undefined {
    for (let i = this.scopes.length - 1; i >= 0; i--) {
      const binding = this.scopes[i]!.get(name);
      if (binding) return binding;
    }
    return undefined;
  }

  private declareLocal(name: string, type: KylatType, readonly: boolean): LocalBinding {
    const existing = this.scopes[this.scopes.length - 1]!.get(name);
    if (existing) return existing;
    const binding: LocalBinding = {
      jsName: this.localName(name),
      type,
      readonly,
    };
    this.scopes[this.scopes.length - 1]!.set(name, binding);
    return binding;
  }

  private localName(name: string): string {
    const sanitized = name.replace(/[^A-Za-z0-9_]/g, '_');
    const candidate = `l_${sanitized}`;
    return JS_RESERVED.has(candidate) ? `v_${sanitized}` : candidate;
  }
}

export function decodePhpStringLiteral(text: string): string {
  if (text.length < 2) return text;
  const quote = text[0];
  const inner = text.slice(1, -1);
  if (quote === "'") {
    let result = '';
    for (let i = 0; i < inner.length; i++) {
      const ch = inner[i]!;
      if (ch === '\\' && (inner[i + 1] === '\\' || inner[i + 1] === "'")) {
        result += inner[++i]!;
      } else {
        result += ch;
      }
    }
    return result;
  }
  let result = '';
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (ch !== '\\') {
      result += ch;
      continue;
    }
    const next = inner[++i];
    if (next === undefined) break;
    switch (next) {
      case 'n': result += '\n'; break;
      case 'r': result += '\r'; break;
      case 't': result += '\t'; break;
      case 'v': result += '\v'; break;
      case 'f': result += '\f'; break;
      case '\\': result += '\\'; break;
      case '$': result += '$'; break;
      case '"': result += '"'; break;
      default: result += `\\${next}`;
    }
  }
  return result;
}
