import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { compile } from '../dist/index.js';
import * as runtime from '../../runtime/dist/index.js';
import { createDocument, findOne } from './dom-harness.mjs';

const hasPhp = spawnSync('php', ['-v'], { encoding: 'utf8' }).status === 0;

const component = (body) => `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;
final class Demo extends Component {
${body}
}`;

function load(code) {
  const stripped = code
    .replace(/^import[\s\S]*?from '@kylat\/runtime';/m, '')
    .replace(/export\s+function/g, 'function')
    .replace(/export\s+default\s+[^;]+;?/g, '');
  return new Function(
    'document',
    'bindAttr',
    'bindIf',
    'bindInput',
    'bindChecked',
    'bindText',
    'createSignal',
    'createComputed',
    'createEffect',
    'createIdempotencyKey',
    'on',
    'reconcileKeyedList',
    `${stripped}; return createDemo;`
  )(
    globalThis.document,
    runtime.bindAttr,
    runtime.bindIf,
    runtime.bindInput,
    runtime.bindChecked,
    runtime.bindText,
    runtime.createSignal,
    runtime.createComputed,
    runtime.createEffect,
    runtime.createIdempotencyKey,
    runtime.on,
    runtime.reconcileKeyedList
  );
}

function phpValue(expression, declarations) {
  const script = `${declarations}\n$value = ${expression};\necho json_encode($value, JSON_UNESCAPED_UNICODE);`;
  const raw = execFileSync('php', ['-r', script], { encoding: 'utf8' }).trim();
  return String(JSON.parse(raw));
}

const cases = [
  {
    name: 'aritmetika dan presedensi',
    expr: '$this->a + $this->b * 2',
    phpExpr: '$a + $b * 2',
    declarations: '$a = 3; $b = 4;',
    state: 'public int $a = 3; public int $b = 4;',
  },
  {
    name: 'konkatenasi string dengan titik',
    expr: "'total: ' . (string) $this->a",
    phpExpr: "'total: ' . (string) $a",
    declarations: '$a = 3;',
    state: 'public int $a = 3;',
  },
  {
    name: 'perbandingan strict dan ternary',
    expr: '$this->a > 2 ? "yes" : "no"',
    phpExpr: '$a > 2 ? "yes" : "no"',
    declarations: '$a = 3;',
    state: 'public int $a = 3;',
  },
  {
    name: 'null coalescing',
    expr: '$this->missing ?? "fallback"',
    phpExpr: '$missing ?? "fallback"',
    declarations: '$missing = null;',
    state: 'public ?string $missing = null;',
  },
  {
    name: 'mb_strlen menghitung code point',
    expr: "mb_strlen('héllo')",
    phpExpr: "mb_strlen('héllo')",
    declarations: '',
  },
  {
    name: 'str_contains',
    expr: "str_contains('hello', 'ell')",
    phpExpr: "str_contains('hello', 'ell')",
    declarations: '',
  },
  {
    name: 'implode list',
    expr: "implode('-', [1, 2, 3])",
    phpExpr: "implode('-', [1, 2, 3])",
    declarations: '',
  },
  {
    name: 'explode dan count',
    expr: "count(explode(',', 'a,b,c'))",
    phpExpr: "count(explode(',', 'a,b,c'))",
    declarations: '',
  },
  {
    name: 'array_filter dan count',
    expr: 'count(array_filter([1, 2, 3, 4], fn($n) => $n % 2 === 0))',
    phpExpr: 'count(array_filter([1, 2, 3, 4], fn($n) => $n % 2 === 0))',
    declarations: '',
  },
  {
    name: 'array_values dan array_map',
    expr: "implode(',', array_values(array_map(fn($n) => $n * 2, [1, 2, 3])))",
    phpExpr: "implode(',', array_values(array_map(fn($n) => $n * 2, [1, 2, 3])))",
    declarations: '',
  },
  {
    name: 'mb_substr dan mb_strtolower',
    expr: "mb_strtolower(mb_substr('HÉLLO', 1, 3))",
    phpExpr: "mb_strtolower(mb_substr('HÉLLO', 1, 3))",
    declarations: '',
  },
  {
    name: 'str_starts_with',
    expr: "str_starts_with('kylat', 'ky')",
    phpExpr: "str_starts_with('kylat', 'ky')",
    declarations: '',
  },
  {
    name: 'array_slice',
    expr: "implode(',', array_slice([1, 2, 3, 4], 1, 2))",
    phpExpr: "implode(',', array_slice([1, 2, 3, 4], 1, 2))",
    declarations: '',
  },
];

describe('@kylat/compiler - differential test PHP vs JavaScript', () => {
  let originalDocument;

  before(() => {
    originalDocument = globalThis.document;
    globalThis.document = createDocument();
  });

  after(() => {
    globalThis.document = originalDocument;
  });

  for (const testCase of cases) {
    it(testCase.name, async (t) => {
      if (!hasPhp) {
        t.skip('PHP tidak tersedia; differential test dilewati.');
        return;
      }
      const source = component(`    public string $result = "";
    ${testCase.state ?? ''}
    #[Client]
    public function run(): void { $this->result = ${testCase.expr}; }`);
      const result = await compile(source, 'demo.kylat.php', {
        template: '<div><button on:click="run">run</button><span>{{ $result }}</span></div>',
      });
      assert.equal(result.success, true, JSON.stringify(result.diagnostics));

      const root = load(result.code)();
      findOne(root, 'button').click();
      const jsValue = findOne(root, 'span').textContent;
      const php = phpValue(testCase.phpExpr, testCase.declarations);
      assert.equal(jsValue, php, `Nilai JS '${jsValue}' harus sama dengan PHP '${php}'`);
    });
  }
});
