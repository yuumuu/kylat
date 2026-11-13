/**
 * @kylat/compiler - codegen.ts
 * Emitter JavaScript reaktif fine-grained signals untuk @kylat/runtime.
 *
 * Codegen tidak pernah memakai innerHTML/eval. Semua teks masuk melalui
 * textContent/bindText dan semua atribut melalui setAttribute/bindAttr.
 */

import type { ComponentIR } from './ir.js';
import {
  parseTemplateNodes,
  type ParsedElement,
  type ParsedExpression,
  type ParsedForEach,
  type ParsedIf,
  type ParsedNode,
} from './template-parser.js';
import {
  compileExpression,
  isSimpleVariable,
  type ExpressionContext,
} from './expression.js';
import { kebabToCamel } from './case-converter.js';
import { compileDefaultValue } from './default-value.js';
import type { SourceMapBuilder } from './source-map.js';

export class CodegenError extends Error {
  public readonly code: string;
  public readonly line: number;
  public readonly column: number;

  constructor(code: string, message: string, line = 1, column = 1) {
    super(message);
    this.name = 'CodegenError';
    this.code = code;
    this.line = line;
    this.column = column;
  }
}

interface EmitContext extends ExpressionContext {
  loops: Map<string, string>;
}

export function generateJavaScript(
  ir: ComponentIR,
  templateSource?: string,
  sourceMap?: SourceMapBuilder,
  templateLineOffset = 0
): string {
  const bodyLines: string[] = [];
  const usedImports = new Set<string>();
  const childImports = new Map<string, string>();
  let temporaryCounter = 0;

  const assertJsIdentifier = (name: string, kind: string): void => {
    if (JS_RESERVED.has(name) || !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
      throw new CodegenError(
        'KIL-104',
        `Nama ${kind} '${name}' tidak dapat dipakai sebagai identifier JavaScript. Ganti namanya.`
      );
    }
  };
  for (const state of ir.state) assertJsIdentifier(state.name, 'state');
  for (const method of ir.methods) {
    assertJsIdentifier(method.name, 'method');
    for (const parameter of method.params) assertJsIdentifier(parameter.name, 'parameter');
  }

  bodyLines.push(`export function create${ir.name}(props = {}) {`);
  bodyLines.push('  // 1. Inisialisasi Props & State Sinyal');

  for (const p of ir.props) {
    const fallback = p.defaultValue !== undefined ? compileDefaultValue(p.defaultValue) : 'undefined';
    bodyLines.push(
      `  const prop_${p.name} = props[${JSON.stringify(p.name)}] !== undefined ? props[${JSON.stringify(p.name)}] : ${fallback};`
    );
    if (p.isRequired) {
      bodyLines.push(`  if (prop_${p.name} === undefined || prop_${p.name} === null) {`);
      bodyLines.push(
        `    throw new TypeError("Prop '${p.name}' wajib disertakan dan tidak boleh null untuk komponen ${ir.name}.");`
      );
      bodyLines.push('  }');
    }
  }

  for (const s of ir.state) {
    usedImports.add('createSignal');
    const matchingProp = ir.props.find(
      (p) => p.name.toLowerCase() === `initial${s.name.toLowerCase()}` || p.name === s.name
    );
    const initialExpr = matchingProp
      ? s.parsedType?.kind === 'map'
        ? `__kylatMapFrom(prop_${matchingProp.name})`
        : `prop_${matchingProp.name}`
      : compileDefaultValue(s.initialValue);
    bodyLines.push(`  const [${s.name}, set_${s.name}] = createSignal(${initialExpr});`);
  }

  for (const computed of ir.computeds) {
    usedImports.add('createComputed');
    bodyLines.push(`  const ${computed.name} = createComputed(() => {`);
    for (let i = 0; i < (computed.bodyCode ?? []).length; i++) {
      bodyLines.push(`    ${computed.bodyCode![i]}`);
      const location = computed.bodyLocations?.[i];
      if (location) sourceMap?.add(bodyLines.length, location.line, location.column);
    }
    bodyLines.push('  });');
  }

  const templateNodes = templateSource?.trim() ? parseTemplateNodes(templateSource) : [];
  const meaningfulNodes = templateNodes.filter(
    (node) => !(node.type === 'text' && node.value.trim() === '')
  );
  const hasErrorBinding = containsErrorBinding(meaningfulNodes);

  const methodStateNames = new Set(ir.state.map((s) => s.name));
  const methodPropNames = new Set(ir.props.map((p) => p.name));
  const methodContext = { state: methodStateNames, props: methodPropNames, loops: new Map<string, string>() };

  const compileMethodOperand = (operand: string, params: Array<{ name: string }> = []): string => {
    const normalized = operand.replace(
      /\$this->([A-Za-z_][A-Za-z0-9_]*)/g,
      (_match, name: string) => '$' + name
    );
    const loops = new Map<string, string>();
    for (const parameter of params) loops.set(parameter.name, parameter.name);
    try {
      return compileExpression(normalized, { ...methodContext, loops });
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : 'KIL-104';
      const message = err instanceof Error ? err.message : String(err);
      throw new CodegenError(code, message);
    }
  };

  const serverActionPendingSignals = new Map<string, string>();
  const serverActionErrorSignals = new Map<string, string>();

  for (const m of ir.methods) {
    if (m.kind === 'server') {
      usedImports.add('createSignal');
      const pendingSignalName = `is_pending_${m.name}`;
      const errorSignalName = `error_${m.name}`;
      serverActionPendingSignals.set(m.name, pendingSignalName);
      serverActionErrorSignals.set(m.name, errorSignalName);
      bodyLines.push(`  const [${pendingSignalName}, set_${pendingSignalName}] = createSignal(false);`);
      bodyLines.push(`  const [${errorSignalName}, set_${errorSignalName}] = createSignal(null);`);
      bodyLines.push(`  let current_idemp_${m.name} = null;`);
      bodyLines.push(`  let last_args_${m.name} = null;`);
    }
  }

  bodyLines.push('');
  bodyLines.push('  // 2. Definisi Aksi & Method');

  for (const m of ir.methods) {
    if (m.kind === 'computed') continue;
    if (m.kind === 'server') {
      usedImports.add('callServerAction');
      usedImports.add('createIdempotencyKey');
      const serverCall = m.serverCall;
      const contract = serverCall?.contract ?? (ir.serverUses[0]?.contractName ?? ir.name);
      const actionMethod = serverCall?.actionMethod ?? m.name;
      const isMutation = serverCall ? serverCall.isMutation : true;

      const pendingSignal = serverActionPendingSignals.get(m.name)!;
      const errorSignal = serverActionErrorSignals.get(m.name)!;

      const hasMapArgument =
        ir.state.some((state) => state.parsedType?.kind === 'map') ||
        ir.props.some((prop) => prop.parsedType?.kind === 'map');
      const argsObject =
        serverCall && serverCall.args.length > 0
          ? `{ ${serverCall.args
              .map(
                (a) =>
                  `${a.name}: ${hasMapArgument ? `__kylatPlain(${a.valueExpr})` : a.valueExpr}`
              )
              .join(', ')} }`
          : 'args';

      bodyLines.push(`  async function ${m.name}(args = {}) {`);
      bodyLines.push(`    set_${pendingSignal}(true);`);
      bodyLines.push(`    set_${errorSignal}(null);`);
      bodyLines.push('    try {');

      if (isMutation) {
        bodyLines.push(`      const current_payload_${m.name} = JSON.stringify(${argsObject});`);
        bodyLines.push(
          `      if (current_idemp_${m.name} === null || last_args_${m.name} !== current_payload_${m.name}) {`
        );
        bodyLines.push(`        current_idemp_${m.name} = createIdempotencyKey();`);
        bodyLines.push(`        last_args_${m.name} = current_payload_${m.name};`);
        bodyLines.push('      }');
        bodyLines.push(
          `      const res = await callServerAction(${JSON.stringify(`${contract}::${actionMethod}`)}, ${argsObject}, { idempotencyKey: current_idemp_${m.name} });`
        );
        bodyLines.push(`      current_idemp_${m.name} = null;`);
        bodyLines.push(`      last_args_${m.name} = null;`);
        if (hasErrorBinding) bodyLines.push('      __set_errors({});');
        bodyLines.push('      return res;');
      } else {
        bodyLines.push(
          `      return await callServerAction(${JSON.stringify(`${contract}::${actionMethod}`)}, ${argsObject});`
        );
      }

      bodyLines.push('    } catch (err) {');
      bodyLines.push(`      set_${errorSignal}(err instanceof Error ? err.message : String(err));`);
      if (hasErrorBinding) {
        bodyLines.push('      const rawErrors = err && typeof err === "object" && Array.isArray(err.rawError?.errors) ? err.rawError.errors : [];');
        bodyLines.push('      const mappedErrors = {};');
        bodyLines.push('      for (const item of rawErrors) {');
        bodyLines.push('        const pointer = String(item.pointer ?? "");');
        bodyLines.push('        const path = pointer.replace(/^\\/calls\\/\\d+\\/args\\//, "").replace(/\\//g, ".");');
        bodyLines.push('        if (path) mappedErrors[path] = item.message ?? "Nilai tidak valid.";');
        bodyLines.push('      }');
        bodyLines.push('      __set_errors(mappedErrors);');
      }
      bodyLines.push('    } finally {');
      bodyLines.push(`      set_${pendingSignal}(false);`);
      bodyLines.push('    }');
      bodyLines.push('  }');
    } else {
      const parameterNames = m.bodyCode
        ? m.params.map((parameter) => `l_${parameter.name}`)
        : m.params.map((parameter) => parameter.name);
      bodyLines.push(`  function ${m.name}(${parameterNames.join(', ')}) {`);

      if (m.bodyCode) {
        for (let i = 0; i < m.bodyCode.length; i++) {
          bodyLines.push(`  ${m.bodyCode[i]}`);
          const location = m.bodyLocations?.[i];
          if (location) sourceMap?.add(bodyLines.length, location.line, location.column);
        }
      } else if (m.operations && m.operations.length > 0) {
        for (const op of m.operations) {
          if (op.type === 'mutate_state') {
            const operand = compileMethodOperand(op.operand, m.params);
            if (op.operator === '+=') {
              bodyLines.push(`    set_${op.target}(${op.target}() + ${operand});`);
            } else if (op.operator === '-=') {
              bodyLines.push(`    set_${op.target}(${op.target}() - ${operand});`);
            } else {
              bodyLines.push(`    set_${op.target}(${operand});`);
            }
          }
        }
      }

      bodyLines.push('  }');
    }
  }

  for (const lifecycle of ir.lifecycle ?? []) {
    bodyLines.push(`  function ${lifecycle.name}() {`);
    for (let i = 0; i < lifecycle.bodyCode.length; i++) {
      bodyLines.push(`  ${lifecycle.bodyCode[i]}`);
      const location = lifecycle.bodyLocations?.[i];
      if (location) sourceMap?.add(bodyLines.length, location.line, location.column);
    }
    bodyLines.push('  }');
  }

  bodyLines.push('');
  bodyLines.push('  // 3. Konstruksi DOM Element & Binding');

  let elemCounter = 0;

  const stateNames = new Set(ir.state.map((s) => s.name));
  const propNames = new Set(ir.props.map((p) => p.name));
  const computedNames = new Set(ir.computeds.map((c) => c.name));
  const rootContext: EmitContext = {
    state: stateNames,
    props: propNames,
    computed: computedNames,
    loops: new Map(),
  };

  if (hasErrorBinding) {
    usedImports.add('createSignal');
    bodyLines.push('  const [__errors, __set_errors] = createSignal({});');
  }

  const pad = (depth: number): string => '  '.repeat(depth + 1);

  const expressionContext = (ctx: EmitContext, extra?: Map<string, string>): ExpressionContext => ({
    state: ctx.state,
    props: ctx.props,
    computed: ctx.computed,
    loops: extra ?? ctx.loops,
  });

  const compile = (expression: string, ctx: EmitContext, loc: { line: number; column: number }): string => {
    try {
      return compileExpression(expression, expressionContext(ctx));
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : 'KIL-104';
      const message = err instanceof Error ? err.message : String(err);
      throw new CodegenError(code, message, loc.line, loc.column);
    }
  };

  const compileWithLoop = (
    expression: string,
    ctx: EmitContext,
    item: string,
    loc: { line: number; column: number }
  ): string => {
    const loops = new Map(ctx.loops);
    loops.set(item, 'item');
    try {
      return compileExpression(expression, expressionContext(ctx, loops));
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? String((err as { code: unknown }).code) : 'KIL-104';
      const message = err instanceof Error ? err.message : String(err);
      throw new CodegenError(code, message, loc.line, loc.column);
    }
  };

  const emitNodes = (nodes: ParsedNode[], parentVar: string, ctx: EmitContext, depth: number): void => {
    for (const node of nodes) {
      emitNode(node, parentVar, ctx, depth);
    }
  };

  const emitNodeBody = (node: ParsedNode, parentVar: string, ctx: EmitContext, depth: number): void => {
    if (node.type === 'text') {
      if (node.value.trim() === '') return;
      const id = ++temporaryCounter;
      const varName = `text_${id}`;
      bodyLines.push(`${pad(depth)}const ${varName} = document.createTextNode(${JSON.stringify(decodeEntities(node.value))});`);
      bodyLines.push(`${pad(depth)}${parentVar}.appendChild(${varName});`);
      return;
    }

    if (node.type === 'expression') {
      emitExpressionNode(node, parentVar, ctx, depth);
      return;
    }

    if (node.type === 'element') {
      const elVar = emitElement(node, parentVar, ctx, depth);
      bodyLines.push(`${pad(depth)}${parentVar}.appendChild(${elVar});`);
      return;
    }

    if (node.type === 'if') {
      emitIf(node, parentVar, ctx, depth);
      return;
    }

    if (node.type === 'foreach') {
      emitForEach(node, parentVar, ctx, depth);
    }
  };

  const emitNode = (node: ParsedNode, parentVar: string, ctx: EmitContext, depth: number): void => {
    const start = bodyLines.length;
    emitNodeBody(node, parentVar, ctx, depth);
    for (let line = start; line < bodyLines.length; line++) {
      sourceMap?.add(line + 1, node.loc.line + templateLineOffset, node.loc.column);
    }
  };

  const emitExpressionNode = (
    node: ParsedExpression,
    parentVar: string,
    ctx: EmitContext,
    depth: number
  ): void => {
    usedImports.add('bindText');
    const code = compile(node.expression, ctx, node.loc);
    const id = ++temporaryCounter;
    const varName = `text_${id}`;
    bodyLines.push(`${pad(depth)}const ${varName} = document.createTextNode("");`);
    bodyLines.push(`${pad(depth)}bindText(${varName}, () => ${code});`);
    bodyLines.push(`${pad(depth)}${parentVar}.appendChild(${varName});`);
  };

  const emitElement = (
    el: ParsedElement,
    parentVar: string | null,
    ctx: EmitContext,
    depth: number
  ): string => {
    elemCounter++;
    const elVar = `el_${el.tag.replace(/[^a-zA-Z0-9]/g, '_')}_${elemCounter}`;
    const child = ir.childComponents.find(
      (candidate) => candidate.tag.toLowerCase() === el.tag.toLowerCase()
    );

    if (child) {
      const childClass = child.className.split('\\').pop() ?? child.className;
      const factory = `create${childClass}`;
      const importPath = `./${childClass}.js`;
      childImports.set(childClass, importPath);

      const props: string[] = [];
      for (const [attrName, attrVal] of Object.entries(el.attributes)) {
        if (isDirectiveAttribute(attrName)) continue;
        const propName = kebabToCamel(attrName);
        const parts = parseAttributeParts(attrVal);
        if (parts.some((part) => part.expression !== undefined)) {
          const getter = parts
            .map((part) =>
              part.expression !== undefined
                ? `(${compile(part.expression, ctx, el.loc)})`
                : JSON.stringify(decodeEntities(part.text))
            )
            .join(' + ');
          props.push(`${JSON.stringify(propName)}: () => ${getter}`);
        } else {
          props.push(`${JSON.stringify(propName)}: ${JSON.stringify(attrVal)}`);
        }
      }
      for (const [attrName, expression] of Object.entries(el.dynamicAttributes)) {
        const propName = kebabToCamel(attrName);
        props.push(`${JSON.stringify(propName)}: () => ${compile(expression, ctx, el.loc)}`);
      }

      bodyLines.push(`${pad(depth)}const ${elVar} = ${factory}({ ${props.join(', ')} });`);

      for (const ev of el.events) {
        usedImports.add('on');
        const handler = parseHandler(ev.handlerCall);
        const args = handler.args.map((arg) => compile(arg, ctx, ev.loc));
        bodyLines.push(
          `${pad(depth)}on(${elVar}, ${JSON.stringify(ev.event)}, () => ${handler.method}(${args.join(', ')}));`
        );
      }

      const childContent = el.nodes.filter(
        (node) => !(node.type === 'text' && node.value.trim() === '')
      );
      if (childContent.length > 0) {
        throw new CodegenError(
          'KIL-212',
          'Komponen anak tidak mendukung slot/konten di v0. Kirim konten lewat prop.',
          el.loc.line,
          el.loc.column
        );
      }

      return elVar;
    }

    bodyLines.push(`${pad(depth)}const ${elVar} = document.createElement(${JSON.stringify(el.tag)});`);

    for (const [attrName, attrVal] of Object.entries(el.attributes)) {
      if (isDirectiveAttribute(attrName)) continue;

      const parts = parseAttributeParts(attrVal);
      if (parts.some((part) => part.expression !== undefined)) {
        usedImports.add('bindAttr');
        const getter = parts
          .map((part) =>
            part.expression !== undefined
              ? `(${compile(part.expression, ctx, el.loc)})`
              : JSON.stringify(decodeEntities(part.text))
          )
          .join(' + ');
        bodyLines.push(`${pad(depth)}bindAttr(${elVar}, ${JSON.stringify(attrName)}, () => ${getter});`);
      } else {
        bodyLines.push(
          `${pad(depth)}${elVar}.setAttribute(${JSON.stringify(attrName)}, ${JSON.stringify(decodeEntities(attrVal))});`
        );
      }
    }

    for (const [attrName, expression] of Object.entries(el.dynamicAttributes)) {
      usedImports.add('bindAttr');
      const code = compile(expression, ctx, el.loc);
      bodyLines.push(
        `${pad(depth)}bindAttr(${elVar}, ${JSON.stringify(attrName)}, () => ${code});`
      );
    }

    for (const ev of el.events) {
      usedImports.add('on');
      const handler = parseHandler(ev.handlerCall);
      const args = handler.args.map((arg) => compile(arg, ctx, ev.loc));
      const call = `${handler.method}(${args.join(', ')})`;
      bodyLines.push(`${pad(depth)}on(${elVar}, ${JSON.stringify(ev.event)}, () => ${call});`);

      const pendingSignal = serverActionPendingSignals.get(handler.method);
      if (pendingSignal) {
        usedImports.add('bindAttr');
        bodyLines.push(
          `${pad(depth)}bindAttr(${elVar}, "aria-busy", () => ${pendingSignal}() ? "true" : null);`
        );
        bodyLines.push(
          `${pad(depth)}bindAttr(${elVar}, "data-pending", () => ${pendingSignal}() ? "" : null);`
        );
        bodyLines.push(
          `${pad(depth)}bindAttr(${elVar}, "disabled", () => ${pendingSignal}() ? "disabled" : null);`
        );
      }
    }

    for (const [bindingName, target] of Object.entries(el.bindings)) {
      const stateName = isSimpleVariable(target);
      if (!stateName || !stateNames.has(stateName)) {
        throw new CodegenError(
          'KIL-154',
          `Target bind:${bindingName} wajib berupa state lokal, bukan prop atau ekspresi.`,
          el.loc.line,
          el.loc.column
        );
      }
      const runtimeBinding = bindingName === 'checked' ? 'bindChecked' : 'bindInput';
      usedImports.add(runtimeBinding);
      bodyLines.push(
        `${pad(depth)}${runtimeBinding}(${elVar}, () => ${stateName}(), set_${stateName});`
      );
    }

    if (el.errorPath) {
      if (!hasErrorBinding) {
        throw new CodegenError('KIL-156', 'Binding error membutuhkan sinyal error komponen.', el.loc.line, el.loc.column);
      }
      usedImports.add('bindText');
      usedImports.add('bindAttr');
      bodyLines.push(
        `${pad(depth)}bindText(${elVar}, () => __errors()?.[${JSON.stringify(el.errorPath)}] ?? "");`
      );
      bodyLines.push(
        `${pad(depth)}bindAttr(${elVar}, "aria-invalid", () => __errors()?.[${JSON.stringify(el.errorPath)}] ? "true" : null);`
      );
    }

    const content = el.nodes.filter(
      (node) => !(node.type === 'text' && node.value.trim() === '')
    );

    if (content.length === 1) {
      const only = content[0]!;
      if (only.type === 'text') {
        bodyLines.push(`${pad(depth)}${elVar}.textContent = ${JSON.stringify(decodeEntities(only.value.trim()))};`);
      } else if (only.type === 'expression') {
        usedImports.add('bindText');
        const code = compile(only.expression, ctx, only.loc);
        bodyLines.push(`${pad(depth)}bindText(${elVar}, () => ${code});`);
      } else if (only.type === 'element') {
        const childVar = emitElement(only, null, ctx, depth);
        bodyLines.push(`${pad(depth)}${elVar}.appendChild(${childVar});`);
      } else {
        emitNode(only, elVar, ctx, depth);
      }
    } else if (content.length > 1) {
      emitNodes(content, elVar, ctx, depth);
    }

    if (parentVar) {
      // Pemanggil yang menambahkan; tidak dilakukan di sini agar urutan anak tetap.
    }

    return elVar;
  };

  const emitIf = (node: ParsedIf, parentVar: string, ctx: EmitContext, depth: number): void => {
    usedImports.add('bindIf');
    const compiledConditions = node.branches.map((branch) =>
      branch.condition === undefined ? null : compile(branch.condition, ctx, branch.loc)
    );

    node.branches.forEach((branch, index) => {
      const marker = `if_marker_${++temporaryCounter}`;
      bodyLines.push(`${pad(depth)}const ${marker} = document.createComment("kylat-if");`);
      bodyLines.push(`${pad(depth)}${parentVar}.appendChild(${marker});`);

      const positive: string[] = [];
      const negative: string[] = [];
      for (let i = 0; i <= index; i++) {
        const condition = compiledConditions[i];
        if (!condition) continue;
        if (i === index) positive.push(condition);
        else negative.push(`!(${condition})`);
      }
      const getter =
        branch.condition === undefined
          ? negative.length > 0
            ? `(${negative.join(' && ')})`
            : 'true'
          : [...negative, ...positive].join(' && ');

      const fragment = `if_fragment_${++temporaryCounter}`;
      bodyLines.push(`${pad(depth)}bindIf(${parentVar}, () => ${getter}, () => {`);
      bodyLines.push(`${pad(depth + 1)}const ${fragment} = document.createDocumentFragment();`);
      emitNodes(branch.children, fragment, ctx, depth + 2);
      bodyLines.push(`${pad(depth + 1)}return ${fragment};`);
      bodyLines.push(`${pad(depth)}}, ${marker});`);
    });
  };

  const emitForEach = (node: ParsedForEach, parentVar: string, ctx: EmitContext, depth: number): void => {
    usedImports.add('reconcileKeyedList');
    const collection = compile(node.collection, ctx, node.loc);
    const marker = `list_marker_${++temporaryCounter}`;
    bodyLines.push(`${pad(depth)}const ${marker} = document.createComment("kylat-list-end");`);
    bodyLines.push(`${pad(depth)}${parentVar}.appendChild(${marker});`);

    const keyedChild = node.children.find(
      (child): child is ParsedElement => child.type === 'element' && Boolean(child.keyExpression)
    );
    const keyExpression = keyedChild?.keyExpression
      ? compileWithLoop(keyedChild.keyExpression, ctx, node.item, keyedChild.loc)
      : 'index';
    const fragment = `item_fragment_${++temporaryCounter}`;
    const loopContext: EmitContext = {
      state: ctx.state,
      props: ctx.props,
      loops: new Map(ctx.loops).set(node.item, 'item'),
    };

    bodyLines.push(
      `${pad(depth)}reconcileKeyedList(${parentVar}, () => __kylatValues(${collection}), (item, index) => ${keyExpression}, (item, index) => {`
    );
    bodyLines.push(`${pad(depth + 1)}const ${fragment} = document.createDocumentFragment();`);
    emitNodes(node.children, fragment, loopContext, depth + 2);
    bodyLines.push(`${pad(depth + 1)}return { node: ${fragment} };`);
    bodyLines.push(`${pad(depth)}}, ${marker});`);

    if (node.emptyChildren.length > 0) {
      usedImports.add('bindIf');
      const emptyMarker = `empty_marker_${++temporaryCounter}`;
      bodyLines.push(`${pad(depth)}const ${emptyMarker} = document.createComment("kylat-empty");`);
      bodyLines.push(`${pad(depth)}${parentVar}.appendChild(${emptyMarker});`);
      const emptyFragment = `empty_fragment_${++temporaryCounter}`;
      bodyLines.push(
        `${pad(depth)}bindIf(${parentVar}, () => __kylatValues(${collection}).length === 0, () => {`
      );
      bodyLines.push(`${pad(depth + 1)}const ${emptyFragment} = document.createDocumentFragment();`);
      emitNodes(node.emptyChildren, emptyFragment, ctx, depth + 2);
      bodyLines.push(`${pad(depth + 1)}return ${emptyFragment};`);
      bodyLines.push(`${pad(depth)}}, ${emptyMarker});`);
    }
  };

  let rootVar: string;
  const singleRoot = meaningfulNodes.length === 1 ? meaningfulNodes[0] : undefined;
  const singleRootIsChild =
    singleRoot?.type === 'element' &&
    ir.childComponents.some((child) => child.tag.toLowerCase() === singleRoot.tag.toLowerCase());

  if (singleRoot?.type === 'element' && !singleRootIsChild) {
    rootVar = emitElement(singleRoot, null, rootContext, 0);
  } else if (meaningfulNodes.length > 0) {
    rootVar = 'root';
    bodyLines.push('  const root = document.createElement("div");');
    bodyLines.push('  root.setAttribute("data-kylat-root", "");');
    emitNodes(meaningfulNodes, rootVar, rootContext, 0);
  } else {
    rootVar = 'root';
    bodyLines.push('  const root = document.createElement("div");');
  }

  for (const [, errorSignal] of serverActionErrorSignals) {
    elemCounter++;
    const errVar = `el_live_error_${elemCounter}`;
    bodyLines.push(`  const ${errVar} = document.createElement("div");`);
    bodyLines.push(`  ${errVar}.setAttribute("aria-live", "polite");`);
    bodyLines.push(`  ${errVar}.setAttribute("role", "status");`);
    usedImports.add('bindText');
    bodyLines.push(`  bindText(${errVar}, () => ${errorSignal}() ?? "");`);
    bodyLines.push(`  ${rootVar}.appendChild(${errVar});`);
  }

  bodyLines.push(
    `  ${rootVar}.setAttribute("data-kylat-component", ${JSON.stringify(ir.name)});`
  );
  for (const lifecycle of ir.lifecycle ?? []) {
    if (lifecycle.kind === 'onMount') {
      bodyLines.push(`  ${lifecycle.name}();`);
    }
  }
  for (const lifecycle of ir.lifecycle ?? []) {
    if (lifecycle.kind === 'effect') {
      usedImports.add('createEffect');
      bodyLines.push(`  createEffect(() => { ${lifecycle.name}(); });`);
    }
  }
  bodyLines.push(`  return ${rootVar};`);
  bodyLines.push('}');
  bodyLines.push('');
  bodyLines.push(`export default create${ir.name};`);
  bodyLines.push('');

  const headerLines: string[] = [
    '/**',
    ` * Komponen Kylat yang dikompilasi: ${ir.name}`,
    ' * Dihasilkan secara otomatis oleh @kylat/compiler',
    ' */',
    '',
  ];

  const sortedImports = Array.from(usedImports).sort();
  if (sortedImports.length > 0) {
    headerLines.push(`import { ${sortedImports.join(', ')} } from '@kylat/runtime';`);
    headerLines.push('');
  }

  for (const [childClass, importPath] of childImports) {
    headerLines.push(`import { create${childClass} } from '${importPath}';`);
  }
  if (childImports.size > 0) headerLines.push('');

  if (bodyLines.join('\n').includes('__kylat')) {
    headerLines.push(...PHP_RUNTIME_HELPERS, '');
  }

  sourceMap?.shift(headerLines.length);

  return [...headerLines, ...bodyLines].join('\n');
}

function isDirectiveAttribute(name: string): boolean {
  return (
    name.startsWith('on:') ||
    name.startsWith('bind:') ||
    name.startsWith(':') ||
    name === 'key' ||
    name === 'error'
  );
}

function parseHandler(raw: string): { method: string; args: string[] } {
  const trimmed = raw.trim();
  const open = trimmed.indexOf('(');
  if (open === -1) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
      throw new CodegenError('KIL-153', `Handler '${raw}' bukan nama method yang sah.`);
    }
    return { method: trimmed, args: [] };
  }
  const close = trimmed.lastIndexOf(')');
  if (close < open) throw new CodegenError('KIL-153', `Handler '${raw}' tidak memiliki penutup ).`);
  const method = trimmed.slice(0, open).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(method)) {
    throw new CodegenError('KIL-153', `Handler '${raw}' bukan nama method yang sah.`);
  }
  const inner = trimmed.slice(open + 1, close).trim();
  return { method, args: inner ? splitArguments(inner) : [] };
}

function splitArguments(source: string): string[] {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quote) {
      current += ch;
      if (ch === '\\') {
        if (i + 1 < source.length) current += source[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

interface AttributePart {
  text: string;
  expression?: string;
}

function parseAttributeParts(value: string): AttributePart[] {
  const parts: AttributePart[] = [];
  let i = 0;
  let text = '';
  while (i < value.length) {
    if (value.startsWith('{{', i)) {
      const end = value.indexOf('}}', i + 2);
      if (end === -1) {
        throw new CodegenError('KIL-150', 'Interpolasi {{ }} pada atribut tidak ditutup.');
      }
      if (text) {
        parts.push({ text });
        text = '';
      }
      parts.push({ text: '', expression: value.slice(i + 2, end).trim() });
      i = end + 2;
      continue;
    }
    text += value[i]!;
    i++;
  }
  if (text) parts.push({ text });
  return parts.length > 0 ? parts : [{ text: '' }];
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function containsErrorBinding(nodes: ParsedNode[]): boolean {
  for (const node of nodes) {
    if (node.type === 'element') {
      if (node.errorPath) return true;
      if (containsErrorBinding(node.nodes)) return true;
    } else if (node.type === 'if') {
      if (node.branches.some((branch) => containsErrorBinding(branch.children))) return true;
    } else if (node.type === 'foreach') {
      if (containsErrorBinding(node.children) || containsErrorBinding(node.emptyChildren)) return true;
    }
  }
  return false;
}

const PHP_RUNTIME_HELPERS = [
  'function __kylatEntries(value) {',
  '  if (value instanceof Map) return value.entries();',
  '  if (Array.isArray(value)) return value.map((item, index) => [index, item]);',
  '  return Object.entries(value ?? {});',
  '}',
  'function __kylatValues(value) {',
  '  if (value instanceof Map) return Array.from(value.values());',
  '  if (Array.isArray(value)) return value;',
  '  return Object.values(value ?? {});',
  '}',
  'function __kylatGet(value, key) {',
  '  if (value instanceof Map) return value.get(typeof key === "number" ? String(key) : key);',
  '  return value?.[key];',
  '}',
  'function __kylatCount(value) {',
  '  if (value instanceof Map) return value.size;',
  '  if (Array.isArray(value)) return value.length;',
  '  return Object.keys(value ?? {}).length;',
  '}',
  'function __kylatMapFrom(value) {',
  '  if (value instanceof Map || Array.isArray(value)) return value;',
  '  return new Map(Object.entries(value ?? {}));',
  '}',
  'function __kylatMap(value, callback) {',
  '  if (Array.isArray(value)) return value.map((item, index) => callback(item, index));',
  '  return new Map(Array.from(__kylatEntries(value)).map(([key, item]) => [key, callback(item, key)]));',
  '}',
  'function __kylatFilter(value, callback) {',
  '  return new Map(Array.from(__kylatEntries(value)).filter(([key, item]) => Boolean(callback(item, key))));',
  '}',
  'function __kylatPlain(value) {',
  '  if (value instanceof Map) {',
  '    const result = {};',
  '    for (const [key, item] of value) result[String(key)] = __kylatPlain(item);',
  '    return result;',
  '  }',
  '  if (Array.isArray(value)) return value.map(__kylatPlain);',
  '  if (value && typeof value === "object") {',
  '    const result = {};',
  '    for (const [key, item] of Object.entries(value)) result[key] = __kylatPlain(item);',
  '    return result;',
  '  }',
  '  return value;',
  '}',
];

const JS_RESERVED = new Set([
  'await','break','case','catch','class','const','continue','debugger','default','delete','do','else','enum','export','extends','false','finally','for','function','if','implements','import','in','instanceof','interface','let','new','null','package','private','protected','public','return','static','super','switch','this','throw','true','try','typeof','var','void','while','with','yield','undefined','NaN','Infinity',
]);
