/**
 * @kylat/compiler - analyzer.ts
 * Penganalisis semantik AST PHP subset v0 dan validator aturan sesuai spec/errors.md.
 */

import type Parser from 'web-tree-sitter';
import { type Diagnostic, createDiagnostic, ERROR_MESSAGES } from './diagnostics.js';
import { camelToKebab } from './case-converter.js';
import type {
  ComponentIR,
  PropDefinition,
  StateDefinition,
  MethodDefinition,
  ChildComponentDefinition,
  ServerActionContract,
} from './ir.js';

const CLIENT_ALLOWED_FUNCTIONS = new Set([
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
  'usort',
  'implode',
  'explode',
]);

const CLIENT_IO_FUNCTIONS = new Set([
  'file_get_contents',
  'file_put_contents',
  'fopen',
  'fwrite',
  'fread',
  'unlink',
  'mkdir',
  'rmdir',
  'scandir',
  'glob',
  'exec',
  'shell_exec',
  'system',
  'passthru',
  'proc_open',
  'curl_exec',
  'mysqli_query',
  'unserialize',
]);

const CLIENT_BYTE_STRING_FUNCTIONS = new Set([
  'substr',
  'strlen',
  'strpos',
  'strrpos',
  'strtolower',
  'strtoupper',
  'trim',
  'ltrim',
  'rtrim',
  'str_replace',
  'str_repeat',
  'ucfirst',
  'ucwords',
]);

const CLIENT_CALLBACK_ARGUMENT_INDEX = new Map([
  ['array_map', 0],
  ['array_filter', 1],
  ['usort', 1],
]);

const CLIENT_SUPERGLOBALS = new Set([
  '$_GET',
  '$_POST',
  '$_SESSION',
  '$_COOKIE',
  '$_SERVER',
  '$_FILES',
  '$_ENV',
  '$_REQUEST',
]);

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

  // KIL-103: static local (pola singleton) tetap ditolak; static helper murni tanpa state tidak.
  for (const staticDeclaration of root.descendantsOfType('function_static_declaration')) {
    diagnostics.push(
      createDiagnostic(
        'KIL-103',
        filename,
        staticDeclaration.startPosition.row + 1,
        staticDeclaration.startPosition.column + 1,
        'Variabel static lokal tidak diizinkan dalam komponen Kylat.',
        'Gunakan state komponen atau props.'
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
        tag: `x-${camelToKebab(childName.split('\\').pop() ?? childName)}`,
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
      const propAttribute = p
        .descendantsOfType('attribute_group')
        .find((attribute) => attribute.text.includes('Prop'));
      if (propAttribute) {
        const explicitlyRequired =
          /required\s*:\s*true/.test(propAttribute.text) ||
          /#\[Prop\s*\(\s*true\s*\)\]/.test(propAttribute.text);
        propDefinitions.push({
          name: propName,
          type: typeStr,
          isRequired: explicitlyRequired || defaultValue === undefined,
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
    const returnTypeNode = m.childForFieldName('return_type');
    const returnType = returnTypeNode?.text || 'void';
    if (!returnTypeNode) {
      diagnostics.push(
        createDiagnostic(
          'KIL-131',
          filename,
          m.startPosition.row + 1,
          m.startPosition.column + 1,
          'Method wajib memiliki tipe kembali eksplisit.',
          'Tambahkan tipe kembali seperti : void atau : int.'
        )
      );
    }

    const serverAttrs = m.descendantsOfType('attribute_group').filter((a) => a.text.includes('Server'));
    const clientAttrs = m.descendantsOfType('attribute_group').filter((a) => a.text.includes('Client'));
    const isPrivate = m.descendantsOfType('visibility_modifier').some((v) => v.text === 'private');
    const isServer = serverAttrs.length > 0;
    const isClient = clientAttrs.length > 0;
    const isAction = !isPrivate && (isServer || isClient || (!serverAttrs.length && !clientAttrs.length));
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

    const isEffect = m.descendantsOfType('attribute_group').some((a) => a.text.includes('Effect'));
    if (isEffect) {
      if (bodyText.includes('->server(') || isServer) {
        diagnostics.push(
          createDiagnostic(
            'KIL-157',
            filename,
            m.startPosition.row + 1,
            m.startPosition.column + 1,
            ERROR_MESSAGES.KIL_157,
            'Pindahkan pemanggilan aksi server ke #[OnMount] atau aksi yang dipicu interaksi pengguna langsung.'
          )
        );
      }
    }

    if (bodyNode && kind === 'client') {
      // KIL-110 / KIL-120 / KIL-140: panggilan fungsi dan konstruksi berbahaya.
      for (const call of bodyNode.descendantsOfType('function_call_expression')) {
        const functionNode = call.childForFieldName('function');
        const functionName = functionNode?.text ?? '';
        const loc = {
          line: call.startPosition.row + 1,
          column: call.startPosition.column + 1,
        };

        const callbackIndex = CLIENT_CALLBACK_ARGUMENT_INDEX.get(functionName);
        if (callbackIndex !== undefined) {
          const argsNode = call.childForFieldName('arguments');
          const argumentNodes = (argsNode?.children ?? []).filter((child) => child.type === 'argument');
          const callbackArgument = argumentNodes[callbackIndex]?.children[0];
          if (callbackArgument) {
            if (callbackArgument.type === 'array_creation_expression') {
              diagnostics.push(
                createDiagnostic(
                  'KIL-120',
                  filename,
                  callbackArgument.startPosition.row + 1,
                  callbackArgument.startPosition.column + 1,
                  `Callback array pada '${functionName}' dapat menjalankan method database/objek dari client.`,
                  'Pindahkan pemanggilan callback ke aksi server.'
                )
              );
            } else if (callbackArgument.type === 'string') {
              const callbackText = callbackArgument.text.replace(/^['"]|['"]$/g, '');
              if (callbackText.includes('::')) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-120',
                    filename,
                    callbackArgument.startPosition.row + 1,
                    callbackArgument.startPosition.column + 1,
                    `Callback string '${callbackText}' mengarah ke static/class call yang tidak diizinkan di client.`,
                    'Pindahkan pemanggilan callback ke aksi server.'
                  )
                );
              } else if (CLIENT_BYTE_STRING_FUNCTIONS.has(callbackText)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-140',
                    filename,
                    callbackArgument.startPosition.row + 1,
                    callbackArgument.startPosition.column + 1,
                    `Callback string byte-level '${callbackText}' tidak diizinkan di client.`
                  )
                );
              } else if (!CLIENT_ALLOWED_FUNCTIONS.has(callbackText)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-110',
                    filename,
                    callbackArgument.startPosition.row + 1,
                    callbackArgument.startPosition.column + 1,
                    `Callback string '${callbackText}' tidak ada di allowlist v0.`
                  )
                );
              }
            } else if (callbackArgument.type === 'function_call_expression') {
              const callbackFunction = callbackArgument.childForFieldName('function')?.text ?? '';
              if (CLIENT_BYTE_STRING_FUNCTIONS.has(callbackFunction)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-140',
                    filename,
                    callbackArgument.startPosition.row + 1,
                    callbackArgument.startPosition.column + 1,
                    `First-class callable byte-level '${callbackFunction}' tidak diizinkan di client.`
                  )
                );
              } else if (!CLIENT_ALLOWED_FUNCTIONS.has(callbackFunction)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-110',
                    filename,
                    callbackArgument.startPosition.row + 1,
                    callbackArgument.startPosition.column + 1,
                    `First-class callable '${callbackFunction}' tidak ada di allowlist v0.`
                  )
                );
              }
            }
          }
        }

        if (functionName === 'eval') {
          diagnostics.push(
            createDiagnostic(
              'KIL-104',
              filename,
              loc.line,
              loc.column,
              'eval() dilarang di seluruh Kylat.'
            )
          );
        } else if (CLIENT_IO_FUNCTIONS.has(functionName)) {
          diagnostics.push(
            createDiagnostic(
              'KIL-120',
              filename,
              loc.line,
              loc.column,
              `Fungsi I/O '${functionName}' tidak boleh dipanggil di method client.`,
              'Pindahkan akses data ke aksi server.'
            )
          );
        } else if (CLIENT_BYTE_STRING_FUNCTIONS.has(functionName)) {
          diagnostics.push(
            createDiagnostic(
              'KIL-140',
              filename,
              loc.line,
              loc.column,
              `Fungsi string byte-level '${functionName}' tidak diizinkan. Gunakan fungsi mb_* yang setara.`
            )
          );
        } else if (!CLIENT_ALLOWED_FUNCTIONS.has(functionName)) {
          diagnostics.push(
            createDiagnostic(
              'KIL-110',
              filename,
              loc.line,
              loc.column,
              `Fungsi '${functionName}' tidak ada di allowlist v0.`,
              'Gunakan allowlist fungsi di spec/php-subset.md atau pindahkan ke aksi server.'
            )
          );
        }
      }

      for (const scopedCall of bodyNode.descendantsOfType('scoped_call_expression')) {
        const scope = scopedCall.childForFieldName('scope')?.text ?? '';
        const scopedMethod = scopedCall.childForFieldName('name')?.text ?? '';
        diagnostics.push(
          createDiagnostic(
            'KIL-120',
            filename,
            scopedCall.startPosition.row + 1,
            scopedCall.startPosition.column + 1,
            `Pemanggilan static '${scope}::${scopedMethod}()' tidak diizinkan di method client; akses kelas/ORM harus lewat aksi server.`,
            'Pindahkan akses database/ORM ke aksi server.'
          )
        );
      }

      for (const memberCall of bodyNode.descendantsOfType('member_call_expression')) {
        const objectText = memberCall.childForFieldName('object')?.text ?? '';
        const methodName = memberCall.childForFieldName('name')?.text ?? '';
        diagnostics.push(
          createDiagnostic(
            'KIL-120',
            filename,
            memberCall.startPosition.row + 1,
            memberCall.startPosition.column + 1,
            `Pemanggilan method '${objectText}->${methodName}()' tidak diizinkan di method client; akses objek/ORM harus lewat aksi server.`,
            'Pindahkan akses database/ORM ke aksi server.'
          )
        );
      }

      for (const creation of bodyNode.descendantsOfType('object_creation_expression')) {
        diagnostics.push(
          createDiagnostic(
            'KIL-110',
            filename,
            creation.startPosition.row + 1,
            creation.startPosition.column + 1,
            `Instansiasi kelas 'new' tidak diizinkan di client: '${creation.text}'.`,
            'Gunakan nilai dari props/state atau pindahkan ke aksi server.'
          )
        );
      }

      for (const inclusion of [
        ...bodyNode.descendantsOfType('include_expression'),
        ...bodyNode.descendantsOfType('require_expression'),
        ...bodyNode.descendantsOfType('include_once_expression'),
        ...bodyNode.descendantsOfType('require_once_expression'),
      ]) {
        diagnostics.push(
          createDiagnostic(
            'KIL-120',
            filename,
            inclusion.startPosition.row + 1,
            inclusion.startPosition.column + 1,
            'Include/require tidak diizinkan di method client.'
          )
        );
      }

      for (const variable of bodyNode.descendantsOfType('variable_name')) {
        if (CLIENT_SUPERGLOBALS.has(variable.text)) {
          diagnostics.push(
            createDiagnostic(
              'KIL-120',
              filename,
              variable.startPosition.row + 1,
              variable.startPosition.column + 1,
              `Superglobal '${variable.text}' tidak boleh diakses di method client.`,
              'Kirim data melalui props atau aksi server.'
            )
          );
        }
      }

      if (bodyNode.descendantsOfType('eval_expression').length > 0) {
        for (const evalNode of bodyNode.descendantsOfType('eval_expression')) {
          diagnostics.push(
            createDiagnostic(
              'KIL-104',
              filename,
              evalNode.startPosition.row + 1,
              evalNode.startPosition.column + 1,
              'eval() dilarang di seluruh Kylat.'
            )
          );
        }
      }

      // Traversal AST statements di dalam compound_statement
      for (const stmt of bodyNode.children) {
        if (stmt.type === '{' || stmt.type === '}' || stmt.type === 'comment') continue;

        if (stmt.type === 'expression_statement') {
          const expr = stmt.children[0];
          if (!expr) continue;

          // 1. $this->count += 1, -= 1, atau = ekspresi
          if (expr.type === 'augmented_assignment_expression' || expr.type === 'assignment_expression') {
            const lhs = expr.childForFieldName('left')?.text || '';
            const augmented = expr.type === 'augmented_assignment_expression';
            const op = augmented
              ? (expr.children.find((c) => c.text === '+=' || c.text === '-=')?.text as '+=' | '-=' | undefined)
              : '=';
            const rhs = expr.childForFieldName('right')?.text || 'null';

            const propMatch = lhs.match(/^\$this->([a-zA-Z0-9_]+)$/);
            if (propMatch && propMatch[1] && op) {
              const target = propMatch[1];
              if (propDefinitions.some((p) => p.name === target)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-104',
                    filename,
                    expr.startPosition.row + 1,
                    expr.startPosition.column + 1,
                    `Prop '\${target}' tidak boleh dimutasi dari client. Gunakan state lokal.`,
                    'Salin prop ke state saat inisialisasi jika nilainya perlu berubah.'
                  )
                );
              } else if (!stateDefinitions.some((s) => s.name === target)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-104',
                    filename,
                    expr.startPosition.row + 1,
                    expr.startPosition.column + 1,
                    `Properti '\${target}' tidak dideklarasikan sebagai state komponen.`,
                    'Deklarasikan properti state di kelas komponen.'
                  )
                );
              } else {
                operations.push({
                  type: 'mutate_state',
                  target,
                  operator: op,
                  operand: rhs,
                });
              }
              continue;
            }
          }

          // 2. $this->count++ atau $this->count--
          if (expr.type === 'update_expression') {
            const arg = expr.childForFieldName('argument')?.text || '';
            const op = expr.children.find((c) => c.text === '++' || c.text === '--')?.text;
            const propMatch = arg.match(/^\$this->([a-zA-Z0-9_]+)$/);
            if (propMatch && propMatch[1] && op) {
              const target = propMatch[1];
              if (propDefinitions.some((p) => p.name === target)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-104',
                    filename,
                    expr.startPosition.row + 1,
                    expr.startPosition.column + 1,
                    `Prop '\${target}' tidak boleh dimutasi dari client.`,
                    'Gunakan state lokal.'
                  )
                );
              } else if (!stateDefinitions.some((s) => s.name === target)) {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-104',
                    filename,
                    expr.startPosition.row + 1,
                    expr.startPosition.column + 1,
                    `Properti '\${target}' tidak dideklarasikan sebagai state komponen.`
                  )
                );
              } else {
                operations.push({
                  type: 'mutate_state',
                  target,
                  operator: op === '++' ? '+=' : '-=',
                  operand: '1',
                });
              }
              continue;
            }
          }

          // Jika pelanggaran sudah punya kode spesifik (KIL-110/120/140),
          // jangan tambah KIL-104 generik yang hanya membuat noise.
          const callsInStatement = stmt.descendantsOfType('function_call_expression');
          const hasSpecificViolation =
            callsInStatement.some((call) => {
              const functionName = call.childForFieldName('function')?.text ?? '';
              return (
                CLIENT_IO_FUNCTIONS.has(functionName) ||
                CLIENT_BYTE_STRING_FUNCTIONS.has(functionName) ||
                !CLIENT_ALLOWED_FUNCTIONS.has(functionName)
              );
            }) ||
            stmt.descendantsOfType('object_creation_expression').length > 0 ||
            stmt.descendantsOfType('include_expression').length > 0 ||
            stmt.descendantsOfType('require_expression').length > 0 ||
            stmt.descendantsOfType('eval_expression').length > 0 ||
            callsInStatement.some((call) => call.childForFieldName('function')?.text === 'eval') ||
            stmt.descendantsOfType('scoped_call_expression').length > 0 ||
            stmt.descendantsOfType('member_call_expression').length > 0 ||
            stmt
              .descendantsOfType('variable_name')
              .some((variable) => CLIENT_SUPERGLOBALS.has(variable.text));

          if (!hasSpecificViolation) {
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
          }
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
                const isProp = propDefinitions.some((p) => p.name === prop);
                const isState = stateDefinitions.some((s) => s.name === prop);

                if (isProp) {
                  argsList.push({ name: prop, valueExpr: `prop_${prop}` });
                  continue;
                }
                if (isState) {
                  argsList.push({ name: prop, valueExpr: `${prop}()` });
                  continue;
                }

                // Jika properti tidak terdaftar di kelas komponen
                diagnostics.push(
                  createDiagnostic(
                    'KIL-104',
                    filename,
                    arg.startPosition.row + 1,
                    arg.startPosition.column + 1,
                    `Properti '$this->${prop}' tidak dideklarasikan di komponen.`,
                    `Deklarasikan properti '${prop}' sebagai #[Prop] atau state komponen.`
                  )
                );
                continue;
              }

              // 2. Variabel lokal ($varName) ditolak di v0 (wajib melalui properti komponen)
              const varMatch = argText.match(/^\$([a-zA-Z0-9_]+)$/);
              if (varMatch && varMatch[1] && argText !== '$this') {
                diagnostics.push(
                  createDiagnostic(
                    'KIL-104',
                    filename,
                    arg.startPosition.row + 1,
                    arg.startPosition.column + 1,
                    `Argumen berupa variabel lokal '$${varMatch[1]}' tidak didukung. Argumen wajib berupa properti komponen ($this->prop).`,
                    `Simpan nilai '$${varMatch[1]}' ke properti state $this->${varMatch[1]} terlebih dahulu.`
                  )
                );
                continue;
              }

              // 3. Literal atau ekspresi tidak diizinkan di v0 (KIL-104)
              diagnostics.push(
                createDiagnostic(
                  'KIL-104',
                  filename,
                  arg.startPosition.row + 1,
                  arg.startPosition.column + 1,
                  `Argumen aksi server '${argText}' tidak didukung. Argumen wajib berupa referensi properti komponen ($this->prop).`,
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

    const params: Array<{ name: string; type: string }> = [];
    const paramsNode = m.childForFieldName('parameters');
    if (paramsNode) {
      for (const child of paramsNode.children) {
        if (child.type !== 'simple_parameter' && child.type !== 'property_promotion_parameter') continue;
        const nameNode = child.childForFieldName('name');
        const typeNode = child.childForFieldName('type');
        const paramName = nameNode?.text.replace('$', '') ?? '';
        if (!paramName) continue;
        params.push({ name: paramName, type: typeNode?.text ?? 'mixed' });
        if (!typeNode) {
          diagnostics.push(
            createDiagnostic(
              'KIL-131',
              filename,
              child.startPosition.row + 1,
              child.startPosition.column + 1,
              'Parameter $' + paramName + ' wajib memiliki tipe eksplisit.',
              'Tambahkan tipe seperti int, string, atau list<T>.'
            )
          );
        }
      }
    }

    methodDefinitions.push({
      name: mName,
      params,
      returnType,
      kind,
      isAction,
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

/**
 * KIL-310: kontrak/kelas aksi yang mengekspos method #[Server] wajib
 * mendeklarasikan authorize(). Komponen (extends Component) dilewati karena
 * method #[Server] di komponen hanyalah proxy ke kontrak aksi.
 */
export function analyzeActionContract(tree: Parser.Tree, filename: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const declarations = [
    ...tree.rootNode.descendantsOfType('interface_declaration'),
    ...tree.rootNode.descendantsOfType('class_declaration'),
  ];

  for (const declaration of declarations) {
    if (declaration.type === 'class_declaration' && /extends\s+(\\?[A-Za-z_][A-Za-z0-9_\\]*)*Component\b/.test(declaration.text)) {
      continue;
    }

    const methods = declaration.descendantsOfType('method_declaration');
    const serverMethods = methods.filter((method) =>
      method
        .descendantsOfType('attribute_group')
        .some((attribute) => /#\[\s*(?:Kylat\\Attributes\\)?Server\b/.test(attribute.text))
    );
    if (serverMethods.length === 0) continue;

    const hasAuthorize = methods.some(
      (method) => method.childForFieldName('name')?.text === 'authorize'
    );
    if (hasAuthorize) continue;

    const first = serverMethods[0]!;
    const name = declaration.childForFieldName('name')?.text ?? 'Unknown';
    diagnostics.push(
      createDiagnostic(
        'KIL-310',
        filename,
        first.startPosition.row + 1,
        first.startPosition.column + 1,
        `Kontrak aksi '${name}' memiliki method #[Server] tetapi tidak mendeklarasikan authorize().`,
        'Tambahkan public function authorize(): bool dengan default-deny ke kontrak aksi.'
      )
    );
  }

  return diagnostics;
}
