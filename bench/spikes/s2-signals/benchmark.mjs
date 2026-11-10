import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

// 1. Import kandidat A: alien-signals (v3.2.1)
import {
  signal as alienSignal,
  computed as alienComputed,
  effect as alienEffect,
} from 'alien-signals';

// 2. Import kandidat B: @solidjs/signals (v2.0.0-rc.0)
import {
  createSignal as solidSignal,
  createMemo as solidMemo,
  createRenderEffect as solidRenderEffect,
  createRoot as solidRoot,
  flush as solidFlush,
} from '@solidjs/signals';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('================================================================');
console.log(' SPIKE S2: BENCHMARK INTI SIGNALS (alien-signals vs @solidjs/signals) ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// BAGIAN 1: PENGUKURAN UKURAN INTI DENGAN BUNDLER YANG SAMA (esbuild minify + gzip)
// -----------------------------------------------------------------------------
console.log('--- 1. UKURAN BUNDLE GZIP INTI (esbuild minify ESM) ---');

const buildAlien = esbuild.buildSync({
  stdin: {
    contents: "export { signal, computed, effect } from 'alien-signals';",
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  minify: true,
  format: 'esm',
  write: false,
});

const buildSolid = esbuild.buildSync({
  stdin: {
    contents:
      "export { createSignal, createMemo, createEffect, createRoot } from '@solidjs/signals';",
    resolveDir: __dirname,
    loader: 'js',
  },
  bundle: true,
  minify: true,
  format: 'esm',
  write: false,
});

const alienRaw = buildAlien.outputFiles[0].contents;
const alienGzip = zlib.gzipSync(alienRaw);

const solidRaw = buildSolid.outputFiles[0].contents;
const solidGzip = zlib.gzipSync(solidRaw);

console.log(
  `alien-signals (v3.2.1)   : Minified: ${alienRaw.length} B (${(alienRaw.length / 1024).toFixed(2)} KB) | Gzip: ${alienGzip.length} B (${(alienGzip.length / 1024).toFixed(2)} KB)`
);
console.log(
  `@solidjs/signals (v2.0-rc): Minified: ${solidRaw.length} B (${(solidRaw.length / 1024).toFixed(2)} KB) | Gzip: ${solidGzip.length} B (${(solidGzip.length / 1024).toFixed(2)} KB)`
);

const sizeRatio = (solidGzip.length / alienGzip.length).toFixed(2);
console.log(`Perbandingan Gzip: alien-signals ${sizeRatio}x lebih kecil daripada @solidjs/signals core.\n`);

// -----------------------------------------------------------------------------
// BAGIAN 2: BENCHMARK COUNTER (1.000.000 Iterasi / 1 Juta Update)
// -----------------------------------------------------------------------------
console.log('--- 2. BENCHMARK COUNTER (1.000.000 Update) ---');
const COUNTER_ITERATIONS = 1_000_000;

// Test A: alien-signals
let alienEffectCount = 0;
const startAlienCounter = performance.now();
{
  const count = alienSignal(0);
  const double = alienComputed(() => count() * 2);
  const stop = alienEffect(() => {
    if (double() >= 0) alienEffectCount++;
  });

  for (let i = 1; i <= COUNTER_ITERATIONS; i++) {
    count(i);
  }
  stop();
}
const timeAlienCounter = performance.now() - startAlienCounter;
const alienOps = Math.round((COUNTER_ITERATIONS / timeAlienCounter) * 1000).toLocaleString();
console.log(
  `alien-signals    : ${timeAlienCounter.toFixed(2)} ms (${alienOps} ops/sec) | Effects run: ${alienEffectCount}`
);

// Test B: @solidjs/signals
let solidEffectCount = 0;
const startSolidCounter = performance.now();
solidRoot((dispose) => {
  const [count, setCount] = solidSignal(0);
  const double = solidMemo(() => count() * 2);
  solidRenderEffect(
    () => double(),
    (val) => {
      if (val >= 0) solidEffectCount++;
    }
  );

  for (let i = 1; i <= COUNTER_ITERATIONS; i++) {
    setCount(i);
    solidFlush();
  }
  dispose();
});
const timeSolidCounter = performance.now() - startSolidCounter;
const solidOps = Math.round((COUNTER_ITERATIONS / timeSolidCounter) * 1000).toLocaleString();
console.log(
  `@solidjs/signals : ${timeSolidCounter.toFixed(2)} ms (${solidOps} ops/sec) | Effects run: ${solidEffectCount}`
);

const counterSpeedup = (timeSolidCounter / timeAlienCounter).toFixed(2);
console.log(`Perbandingan Counter: alien-signals ${counterSpeedup}x lebih cepat daripada @solidjs/signals.\n`);

// -----------------------------------------------------------------------------
// BAGIAN 3: BENCHMARK TABEL 1.000 BARIS REAKTIF
// -----------------------------------------------------------------------------
console.log('--- 3. BENCHMARK TABEL 1.000 BARIS REAKTIF ---');
const ROWS = 1_000;
const ROUNDS = 5;

// Test A: alien-signals
let alienTableUpdates = 0;
const startAlienTable = performance.now();
{
  const rows = [];
  const stops = [];
  for (let i = 0; i < ROWS; i++) {
    const text = alienSignal(`Baris #${i}`);
    const selected = alienSignal(false);
    const rowSummary = alienComputed(() => `${text()} [${selected() ? 'X' : ' '}]`);
    const stop = alienEffect(() => {
      if (rowSummary()) alienTableUpdates++;
    });
    rows.push({ text, selected });
    stops.push(stop);
  }

  // Mutasi 1: Update teks 1.000 baris (5 putaran)
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < ROWS; i++) {
      rows[i].text(`Baris #${i} Putaran ${round}`);
    }
  }

  // Mutasi 2: Seleksi baris bergantian
  for (let i = 0; i < ROWS; i++) {
    rows[i].selected(true);
    if (i > 0) rows[i - 1].selected(false);
  }

  stops.forEach((s) => s());
}
const timeAlienTable = performance.now() - startAlienTable;
console.log(
  `alien-signals    : ${timeAlienTable.toFixed(2)} ms | Total updates: ${alienTableUpdates}`
);

// Test B: @solidjs/signals
let solidTableUpdates = 0;
const startSolidTable = performance.now();
solidRoot((dispose) => {
  const rows = [];
  for (let i = 0; i < ROWS; i++) {
    const [text, setText] = solidSignal(`Baris #${i}`);
    const [selected, setSelected] = solidSignal(false);
    const rowSummary = solidMemo(() => `${text()} [${selected() ? 'X' : ' '}]`);
    solidRenderEffect(
      () => rowSummary(),
      (val) => {
        if (val) solidTableUpdates++;
      }
    );
    rows.push({ setText, setSelected });
  }

  // Mutasi 1: Update teks 1.000 baris (5 putaran)
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < ROWS; i++) {
      rows[i].setText(`Baris #${i} Putaran ${round}`);
      solidFlush();
    }
  }

  // Mutasi 2: Seleksi baris bergantian
  for (let i = 0; i < ROWS; i++) {
    rows[i].setSelected(true);
    if (i > 0) rows[i - 1].setSelected(false);
    solidFlush();
  }

  dispose();
});
const timeSolidTable = performance.now() - startSolidTable;
console.log(
  `@solidjs/signals : ${timeSolidTable.toFixed(2)} ms | Total updates: ${solidTableUpdates}`
);

const tableSpeedup = (timeSolidTable / timeAlienTable).toFixed(2);
console.log(`Perbandingan Tabel: alien-signals ${tableSpeedup}x lebih cepat daripada @solidjs/signals.\n`);

// -----------------------------------------------------------------------------
// RINGKASAN DATA
// -----------------------------------------------------------------------------
console.log('================================================================');
console.log('                     RINGKASAN DATA SPIKE S2                   ');
console.log('================================================================');
console.log(`1. Bundle Gzip Inti   : alien-signals = ${alienGzip.length} B | @solidjs/signals = ${solidGzip.length} B (${sizeRatio}x lebih ramping)`);
console.log(`2. Counter 1M Updates : alien-signals = ${timeAlienCounter.toFixed(2)} ms | @solidjs/signals = ${timeSolidCounter.toFixed(2)} ms (${counterSpeedup}x lebih cepat)`);
console.log(`3. Tabel 1.000 Baris  : alien-signals = ${timeAlienTable.toFixed(2)} ms | @solidjs/signals = ${timeSolidTable.toFixed(2)} ms (${tableSpeedup}x lebih cepat)`);
console.log('================================================================\n');
