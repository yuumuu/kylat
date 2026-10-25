/**
 * @kylat/compiler - analyzer.ts
 * Penganalisis semantik AST PHP subset v0 dan validator aturan sesuai spec/errors.md.
 */

import type Parser from 'web-tree-sitter';
import { type Diagnostic, createDiagnostic, ERROR_MESSAGES } from './diagnostics.js';
import type {
  ComponentIR,
  PropDefinition,
  StateDefinition,
  MethodDefinition,
  ChildComponentDefinition,
  ServerActionContract,
} from './ir.js';

export interface AnalysisResult {
  ir: ComponentIR | null;
  diagnostics: Diagnostic[];
}

export function analyzePhpComponent(
  tree: Parser.Tree,
  filename: string
): AnalysisResult {
  const diagnostics: Diagnostic[] = [];
  const root = tree.rootNode;

  // 1. KIL-102: Periksa declare(strict_types=1) sesuai spec/errors.md
  const declareNodes = root.descendantsOfType('declare_statement');
  const hasStrictTypes = declareNodes.some((d) => d.text.includes('strict_types=1') || d.text.includes('strict_types = 1'));
  if (!hasStrictTypes) {
    diagnostics.push(
      createDiagnostic(
        'KIL-102',
        filename,
        1,
        1,
        ERROR_MESSAGES.KIL_102,
        'Tambahkan "declare(strict_types=1);" tepat di bawah tag <?php di awal berkas.'
      )
    );
  }

  // 2. KIL-104: Cek sintaks terlarang (eval, match, yield, goto)
  const illegalMatchNodes = root.descendantsOfType('match_expression');
  for (const node of illegalMatchNodes) {
    diagnostics.push(
      createDiagnostic(
        'KIL-104',
        filename,
        node.startPosition.row + 1,
        node.startPosition.column + 1,
        'Ekspresi match tidak diizinkan di subset Kylat v0.',
        'Gunakan pernyataan if/else sederhana.'
      )
    );
  }

  const illegalYieldNodes = root.descendantsOfType('yield_expression');
  for (const node of illegalYieldNodes) {
    diagnostics.push(
      createDiagnostic(
        'KIL-104',
        filename,
        node.startPosition.row + 1,
        node.startPosition.column + 1,
        'Generator yield tidak diizinkan dalam komponen Kylat.',
        'Kembalikan array biasa.'
      )
    );
  }

  const illegalGotoNodes = root.descendantsOfType('goto_statement');
  for (const node of illegalGotoNodes) {
    diagnostics.push(
      createDiagnostic(
        'KIL-104',
        filename,
        node.startPosition.row + 1,
        node.startPosition.column + 1,
        'Pernyataan goto tidak diizinkan dalam komponen Kylat.'
      )
    );
  }

  // 3. KIL-103: Dilarang static, global, $$var
  const globalStatements = root.descendantsOfType('global_declaration');
  for (const node of globalStatements) {
    diagnostics.push(
      createDiagnostic(
        'KIL-103',
        filename,
        node.startPosition.row + 1,
        node.startPosition.column + 1,
        ERROR_MESSAGES.KIL_103,
        'Gunakan dependency injection atau props untuk meneruskan data.'
      )
    );
  }

  // 4. Cari Class Declaration Komponen
  const classNodes = root.descendantsOfType('class_declaration');
  if (classNodes.length === 0) {
    diagnostics.push(
      createDiagnostic(
        'KIL-201',
        filename,
        1,
        1,
        'Tidak ditemukan definisi class komponen di dalam berkas.',
        'Definisikan class komponen yang mewarisi Component (misal: final class Counter extends Component).'
      )
    );
    return { ir: null, diagnostics };
  }

  const classNode = classNodes[0];
  if (!classNode) {
    return { ir: null, diagnostics };
  }

  const classNameNode = classNode.childForFieldName('name');
  const className = classNameNode ? classNameNode.text : 'UnknownComponent';

  // KIL-201: Class komponen wajib final
  const isFinal = classNode.children.some((c) => c.type === 'final_modifier');
  if (!isFinal) {
    diagnostics.push(
      createDiagnostic(
        'KIL-201',
        filename,
        classNode.startPosition.row + 1,
        classNode.startPosition.column + 1,
        ERROR_MESSAGES.KIL_201,
        `Ubah deklarasi menjadi: final class ${className} extends Component`
      )
    );
  }

  // Cek namespace
  const namespaceNode = root.descendantsOfType('namespace_definition')[0];
  const namespace = namespaceNode?.childForFieldName('name')?.text;

  // Cek atribut kelas: #[Uses(...)] dan #[Child(...)]
  const serverUses: ServerActionContract[] = [];
  const childComponents: ChildComponentDefinition[] = [];

  const classAttributes = classNode.descendantsOfType('attribute_group');
  for (const attr of classAttributes) {
    const text = attr.text;
    const usesMatch = text.match(/#\[Uses\((.+?)::class\)]/);
    if (usesMatch && usesMatch[1]) {
      serverUses.push({ contractName: usesMatch[1].trim() });
    }

    const childMatch = text.match(/#\[Child\((.+?)::class\)]/);
    if (childMatch && childMatch[1]) {
      const childName = childMatch[1].trim();
      childComponents.push({
        className: childName,
        tag: `x-${childName.toLowerCase()}`,
      });
    }
  }

  // 5. Analisis Properti (KIL-103, KIL-110, KIL-131)
  const propDefinitions: PropDefinition[] = [];
  const stateDefinitions: StateDefinition[] = [];

  const propDecls = classNode.descendantsOfType('property_declaration');
  for (const p of propDecls) {
    const isStatic = p.children.some((c) => c.type === 'static_modifier');
    if (isStatic) {
      diagnostics.push(
        createDiagnostic(
          'KIL-103',
          filename,
          p.startPosition.row + 1,
          p.startPosition.column + 1,
          ERROR_MESSAGES.KIL_103,
          'Gunakan properti instance biasa (public string $name).'
        )
      );
    }

    // KIL-131: Cek visibility (public / protected / private)
    const hasVisibility = p.children.some((c) =>
      c.type === 'visibility_modifier' || c.text === 'public' || c.text === 'protected' || c.text === 'private'
    );
    if (!hasVisibility) {
      diagnostics.push(
        createDiagnostic(
          'KIL-131',
          filename,
          p.startPosition.row + 1,
          p.startPosition.column + 1,
          ERROR_MESSAGES.KIL_131,
          'Tambahkan kata kunci public, protected, atau private.'
        )
      );
    }

    // KIL-131: Cek tipe data properti
    const typeNode = p.childForFieldName('type') || p.children.find((c) => c.type === 'primitive_type' || c.type === 'named_type');
    if (!typeNode) {
      diagnostics.push(
        createDiagnostic(
          'KIL-131',
          filename,
          p.startPosition.row + 1,
          p.startPosition.column + 1,
          ERROR_MESSAGES.KIL_131,
          'Berikan tipe data eksplisit (misal: public int $count = 0;).'
        )
      );
    } else {
      const typeText = typeNode.text;
      // KIL-110: Dilarang callable / Closure
      if (typeText.toLowerCase() === 'callable' || typeText.toLowerCase() === 'closure') {
        diagnostics.push(
          createDiagnostic(
            'KIL-110',
            filename,
            p.startPosition.row + 1,
            p.startPosition.column + 1,
            ERROR_MESSAGES.KIL_110.replace('{tipe}', typeText),
            'Gunakan tipe data skalar, array, atau objek yang dapat diserialisasi JSON.'
          )
        );
      }
    }

    // Ekstraksi property_element (variable_name dan property_initializer)
    const elemNode = p.descendantsOfType('property_element')[0];
    if (elemNode) {
      const varNameNode = elemNode.children.find((c) => c.type === 'variable_name');
      const propName = varNameNode ? varNameNode.text.replace('$', '') : '';

      const initNode = elemNode.children.find((c) => c.type === 'property_initializer');
      const defaultValue = initNode ? initNode.text.replace(/^=\s*/, '').trim() : undefined;
      const typeStr = typeNode ? typeNode.text : 'mixed';

      // Cek apakah memiliki atribut #[Prop]
      const hasPropAttr = p.descendantsOfType('attribute_group').some((a) => a.text.includes('Prop'));
      if (hasPropAttr) {
        propDefinitions.push({
          name: propName,
          type: typeStr,
          isRequired: defaultValue === undefined,
          defaultValue,
        });
      } else {
        stateDefinitions.push({
          name: propName,
          type: typeStr,
          initialValue: defaultValue ?? 'null',
        });
      }
    }
  }

  // 6. Analisis Methods & KIL-311 (Nama method aksi server unik)
  const methodDefinitions: MethodDefinition[] = [];
  const serverActionNames = new Set<string>();

  const methodDecls = classNode.descendantsOfType('method_declaration');
  for (const m of methodDecls) {
    const mName = m.childForFieldName('name')?.text || '';
    const returnType = m.childForFieldName('return_type')?.text || 'void';

    const serverAttrs = m.descendantsOfType('attribute_group').filter((a) => a.text.includes('Server'));
    const isServer = serverAttrs.length > 0;
    const isExplicitRead = serverAttrs.some((a) => /read\s*:\s*true/.test(a.text));
    const kind = isServer ? 'server' : 'client';

    if (isServer) {
      if (serverActionNames.has(mName)) {
        diagnostics.push(
          createDiagnostic(
            'KIL-311',
            filename,
            m.startPosition.row + 1,
            m.startPosition.column + 1,
            `Nama method aksi server '${mName}' duplikat dalam satu komponen.`,
            'Gunakan nama yang berbeda untuk setiap aksi server.'
          )
        );
      } else {
        serverActionNames.add(mName);
      }
    }

    const bodyNode = m.childForFieldName('body');
    const bodyText = bodyNode ? bodyNode.text : '{}';
    const operations: import('./ir.js').ClientOperation[] = [];
    let serverCall: import('./ir.js').ServerCallDefinition | undefined;

    if (bodyNode && kind === 'client') {
      // Traversal AST statements di dalam compound_statement
      for (const stmt of bodyNode.children) {
        if (stmt.type === '{' || stmt.type === '}' || stmt.type === 'comment') continue;

        if (stmt.type === 'expression_statement') {
          const expr = stmt.children[0];
          if (!expr) continue;

          // 1. $this->count += 1 atau $this->count -= 1
          if (expr.type === 'augmented_assignment_expression') {
            const lhs = expr.childForFieldName('left')?.text || '';
            const op = expr.children.find((c) => c.text === '+=' || c.text === '-=')?.text as '+=' | '-=' | undefined;
            const rhs = expr.childForFieldName('right')?.text || '1';

            const propMatch = lhs.match(/^\$this->([a-zA-Z0-9_]+)$/);
            if (propMatch && propMatch[1] && op) {
              operations.push({
                type: 'mutate_state',
                target: propMatch[1],
                operator: op,
                operand: rhs,
              });
              continue;
            }
          }

          // 2. $this->count++ atau $this->count--
          if (expr.type === 'update_expression') {
            const arg = expr.childForFieldName('argument')?.text || '';
            const op = expr.children.find((c) => c.text === '++' || c.text === '--')?.text;
            const propMatch = arg.match(/^\$this->([a-zA-Z0-9_]+)$/);
            if (propMatch && propMatch[1] && op) {
              operations.push({
                type: 'mutate_state',
                target: propMatch[1],
                operator: op === '++' ? '+=' : '-=',
                operand: '1',
              });
              continue;
            }
          }

          // Jika statement ekspresi tidak didukung di subset v0: fail fast (KIL-104)
          diagnostics.push(
            createDiagnostic(
              'KIL-104',
              filename,
              stmt.startPosition.row + 1,
              stmt.startPosition.column + 1,
              `Ekspresi statement '${stmt.text.trim()}' tidak didukung dalam method client di subset v0.`,
              'Gunakan operasi mutasi state yang didukung ($this->state += 1 atau assignment).'
            )
          );
        } else {
          // Statement tak dikenal di method client
          diagnostics.push(
            createDiagnostic(
              'KIL-104',
              filename,
              stmt.startPosition.row + 1,
              stmt.startPosition.column + 1,
              `Pernyataan tipe '${stmt.type}' tidak didukung dalam method client.`,
              'Pindahkan logika ke aksi server atau sederhanakan.'
            )
          );
        }
      }
    } else if (bodyNode && kind === 'server') {
      // Traversal AST untuk panggilan server action
      const memberCalls = bodyNode.descendantsOfType('member_call_expression');
      for (const call of memberCalls) {
        const callNameNode = call.childForFieldName('name');
        const callName = callNameNode?.text;

        // Cari panggilan ->saveCount(...) atau method aksi setelah ->server(...)
        if (callName && callName !== 'server') {
          const contract = serverUses[0]?.contractName ?? className;
          const argsList: Array<{ name: string; valueExpr: string }> = [];

          const argsNode = call.childForFieldName('arguments');
          if (argsNode) {
            for (const rawArg of argsNode.children) {
              if (rawArg.type === '(' || rawArg.type === ')' || rawArg.type === ',') continue;

              const arg = rawArg.type === 'argument' && rawArg.children.length > 0 ? rawArg.children[0]! : rawArg;
              const argText = arg.text.trim();

              // 1. $this->propName
              const propMatch = argText.match(/^\$this->([a-zA-Z0-9_]+)$/);
              if (propMatch && propMatch[1]) {
                const prop = propMatch[1];
                argsList.push({ name: prop, valueExpr: `${prop}()` });
                continue;
              }

              // 2. $varName
              const varMatch = argText.match(/^\$([a-zA-Z0-9_]+)$/);
              if (varMatch && varMatch[1] && argText !== '$this') {
                const varName = varMatch[1];
                argsList.push({ name: varName, valueExpr: `${varName}()` });
                continue;
              }

              // 3. Literal atau ekspresi tidak diizinkan di v0 (KIL-104)
              diagnostics.push(
                createDiagnostic(
                  'KIL-104',
                  filename,
                  arg.startPosition.row + 1,
                  arg.startPosition.column + 1,
                  `Argumen aksi server '${argText}' tidak didukung. Argumen wajib berupa referensi properti ($this->prop) atau variabel.`,
                  'Simpan nilai atau hasil kalkulasi ke dalam properti komponen sebelum memanggil aksi server.'
                )
              );
            }
          }

          serverCall = {
            contract,
            actionMethod: callName,
            args: argsList,
            isMutation: !isExplicitRead, // Default deny: mutasi secara default KECUALI #[Server(read: true)]
          };
          break;
        }
      }
    }

    methodDefinitions.push({
      name: mName,
      params: [],
      returnType,
      kind,
      body: bodyText,
      operations,
      serverCall,
    });
  }

  const ir: ComponentIR = {
    name: className,
    namespace,
    isFinal,
    props: propDefinitions,
    state: stateDefinitions,
    computeds: [],
    methods: methodDefinitions,
    serverUses,
    childComponents,
  };

  return { ir, diagnostics };
}
