import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compile } from '../dist/index.js';

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeVlq(segment) {
  const values = [];
  let value = 0;
  let shift = 0;
  for (const char of segment) {
    const digit = BASE64.indexOf(char);
    assert.ok(digit >= 0, `Karakter VLQ tidak sah: ${char}`);
    value += (digit & 31) << shift;
    if (digit & 32) {
      shift += 5;
    } else {
      const negative = value & 1;
      value >>>= 1;
      values.push(negative ? -value : value);
      value = 0;
      shift = 0;
    }
  }
  return values;
}

function decodeMappings(mappings) {
  const result = new Map();
  let sourceLine = 0;
  let sourceColumn = 0;
  mappings.split(';').forEach((line, lineIndex) => {
    if (!line) return;
    let generatedColumn = 0;
    for (const segment of line.split(',')) {
      const values = decodeVlq(segment);
      generatedColumn += values[0] ?? 0;
      if (values.length >= 4) {
        sourceLine += values[2] ?? 0;
        sourceColumn += values[3] ?? 0;
        result.set(lineIndex + 1, { generatedColumn, sourceLine: sourceLine + 1, sourceColumn });
      }
    }
  });
  return result;
}

describe('@kylat/compiler - source map', () => {
  it('memetakan baris method dan templat ke baris sumber asli', async () => {
    const source = `<?php
declare(strict_types=1);
final class Demo extends Component {
  public int $count = 0;
  #[Client]
  public function run(int $limit): void {
    for ($i = 0; $i < $limit; $i++) {
      $this->count += $i;
    }
  }
}
?>
<div><button on:click="run(3)">go</button><span>{{ $count }}</span></div>`;
    const result = await compile(source, 'demo.kylat.php');
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    assert.ok(result.map, 'CompileResult harus memuat source map');
    const map = JSON.parse(result.map);
    assert.equal(map.version, 3);
    assert.deepEqual(map.sources, ['demo.kylat.php']);
    assert.equal(map.sourcesContent[0], source);

    const mappings = decodeMappings(map.mappings);
    const generatedLines = result.code.split('\n');
    const stateMutationLine = generatedLines.findIndex((line) => line.includes('set_count(count() + l_i)')) + 1;
    assert.ok(stateMutationLine > 0);
    const mutationMapping = mappings.get(stateMutationLine);
    assert.ok(mutationMapping, 'Baris mutasi state harus memiliki mapping');
    assert.equal(mutationMapping.sourceLine, 8, 'Mutasi state harus menunjuk ke baris $this->count += $i');

    const templateLine = generatedLines.findIndex((line) => line.includes('bindText') && line.includes('count()')) + 1;
    assert.ok(templateLine > 0);
    const templateMapping = mappings.get(templateLine);
    assert.ok(templateMapping, 'Binding templat harus memiliki mapping');
    assert.equal(templateMapping.sourceLine, 13, 'Binding {{ $count }} harus menunjuk ke baris templat');
  });

  it('memetakan body computed dan lifecycle ke baris sumber masing-masing', async () => {
    const source = `<?php
declare(strict_types=1);
final class Demo extends Component {
  public int $count = 2;
  #[Computed]
  public function doubled(): int {
    return $this->count * 2;
  }
  #[OnMount]
  public function ready(): void {
    $this->count = 3;
  }
}
?>
<div>{{ $doubled }}</div>`;
    const result = await compile(source, 'demo.kylat.php');
    assert.equal(result.success, true, JSON.stringify(result.diagnostics));
    const map = JSON.parse(result.map);
    const mappings = decodeMappings(map.mappings);
    const generatedLines = result.code.split('\n');

    const computedLine = generatedLines.findIndex((line) => line.includes('return (count() * 2)')) + 1;
    assert.ok(computedLine > 0);
    assert.equal(mappings.get(computedLine).sourceLine, 7);

    const lifecycleLine = generatedLines.findIndex((line) => line.includes('set_count(3)')) + 1;
    assert.ok(lifecycleLine > 0);
    assert.equal(mappings.get(lifecycleLine).sourceLine, 11);
  });
});
