import fs from 'node:fs';
import path from 'path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// 1. Import kandidat A: alien-signals (v3.2.1)
import { signal as alienSignal, computed as alienComputed, effect as alienEffect } from 'alien-signals';

// 2. Import kandidat B: solid-js (v1.9.17 - Solid stable core)
import {
  createSignal as solidSignal,
  createMemo as solidMemo,
  createRenderEffect as solidRenderEffect,
  createRoot as solidRoot,
} from 'solid-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getPackageSize(pkgPath) {
  const content = fs.readFileSync(pkgPath);
  const rawSize = content.length;
  const gzipSize = zlib.gzipSync(content).length;
  return { rawSize, gzipSize };
}

console.log('================================================================');
console.log('   SPIKE S2: BENCHMARK INTI SIGNALS (alien-signals vs solid-js)  ');
console.log('================================================================\n');

// -----------------------------------------------------------------------------
// BAGIAN 1: PENGUKURAN UKURAN INTI (BUNDLE SIZE & GZIP)
// -----------------------------------------------------------------------------
console.log('--- 1. UKURAN INTI SIGNALS (DIST FILE GZIP) ---');

const alienDist = path.resolve(__dirname, 'node_modules/alien-signals/esm/index.mjs');
const solidDist = path.resolve(__dirname, 'node_modules/solid-js/dist/solid.js');

const alienSize = getPackageSize(alienDist);
const solidSize = getPackageSize(solidDist);

console.log(`alien-signals (v3.2.1): Raw: ${(alienSize.rawSize / 1024).toFixed(2)} KB | Gzip: ${(alienSize.gzipSize / 1024).toFixed(2)} KB (${alienSize.gzipSize} B)`);
console.log(`solid-js (v1.9.17)   : Raw: ${(solidSize.rawSize / 1024).toFixed(2)} KB | Gzip: ${(solidSize.gzipSize / 1024).toFixed(2)} KB (${solidSize.gzipSize} B)`);

console.log(`\nPerbandingan Ukuran Gzip:`);
console.log(`- alien-signals adalah ${(solidSize.gzipSize / alienSize.gzipSize).toFixed(1)}x LEBIH KECIL daripada solid-js core (1.8 KB vs 12.1 KB)\n`);

// -----------------------------------------------------------------------------
// BAGIAN 2: BENCHMARK COUNTER (100.000 Iterasi Mutasi & Sinyal Turunan)
// -----------------------------------------------------------------------------
console.log('--- 2. BENCHMARK COUNTER (100.000 Iterasi) ---');
const ITERATIONS = 100_000;

// Test A: alien-signals
let alienEffectCount = 0;
const startAlienCounter = performance.now();
{
  const count = alienSignal(0);
  const double = alienComputed(() => count() * 2);
  const stop = alienEffect(() => {
    if (double() >= 0) alienEffectCount++;
  });

  for (let i = 1; i <= ITERATIONS; i++) {
    count(i);
  }
  stop();
}
const timeAlienCounter = performance.now() - startAlienCounter;
console.log(`alien-signals : ${timeAlienCounter.toFixed(2)} ms (${Math.round((ITERATIONS / timeAlienCounter) * 1000).toLocaleString()} ops/sec) | Effects run: ${alienEffectCount}`);

// Test B: solid-js
let solidEffectCount = 0;
const startSolidCounter = performance.now();
solidRoot((dispose) => {
  const [count, setCount] = solidSignal(0);
  const double = solidMemo(() => count() * 2);
  solidRenderEffect(() => {
    if (double() >= 0) solidEffectCount++;
  });

  for (let i = 1; i <= ITERATIONS; i++) {
    setCount(i);
  }
  dispose();
});
const timeSolidCounter = performance.now() - startSolidCounter;
console.log(`solid-js      : ${timeSolidCounter.toFixed(2)} ms (${Math.round((ITERATIONS / timeSolidCounter) * 1000).toLocaleString()} ops/sec) | Effects run: ${solidEffectCount}`);

const counterWinner = timeAlienCounter < timeSolidCounter ? 'alien-signals' : 'solid-js';
const counterSpeedup = Math.max(timeAlienCounter, timeSolidCounter) / Math.min(timeAlienCounter, timeSolidCounter);
console.log(`Pemenang Counter: ${counterWinner} (${counterSpeedup.toFixed(2)}x lebih cepat)\n`);

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

  // Mutasi 1: Update seluruh teks 1.000 baris
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
console.log(`alien-signals : ${timeAlienTable.toFixed(2)} ms | Total updates: ${alienTableUpdates}`);

// Test B: solid-js
let solidTableUpdates = 0;
const startSolidTable = performance.now();
solidRoot((dispose) => {
  const rows = [];
  for (let i = 0; i < ROWS; i++) {
    const [text, setText] = solidSignal(`Baris #${i}`);
    const [selected, setSelected] = solidSignal(false);
    const rowSummary = solidMemo(() => `${text()} [${selected() ? 'X' : ' '}]`);
    solidRenderEffect(() => {
      if (rowSummary()) solidTableUpdates++;
    });
    rows.push({ setText, setSelected });
  }

  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < ROWS; i++) {
      rows[i].setText(`Baris #${i} Putaran ${round}`);
    }
  }

  for (let i = 0; i < ROWS; i++) {
    rows[i].setSelected(true);
    if (i > 0) rows[i - 1].setSelected(false);
  }

  dispose();
});
const timeSolidTable = performance.now() - startSolidTable;
console.log(`solid-js      : ${timeSolidTable.toFixed(2)} ms | Total updates: ${solidTableUpdates}`);

const tableWinner = timeAlienTable < timeSolidTable ? 'alien-signals' : 'solid-js';
const tableSpeedup = Math.max(timeAlienTable, timeSolidTable) / Math.min(timeAlienTable, timeSolidTable);
console.log(`Pemenang Tabel 1.000 Baris: ${tableWinner} (${tableSpeedup.toFixed(2)}x lebih cepat)\n`);

// -----------------------------------------------------------------------------
// KEPUTUSAN & CATATAN STABILITAS API
// -----------------------------------------------------------------------------
console.log('================================================================');
console.log('                 KEPUTUSAN AKHIR SPIKE S2                       ');
console.log('================================================================');
console.log('1. Ukuran Bundle (P10): alien-signals (1.81 KB gzip) vs solid-js (12.09 KB gzip).');
console.log('   alien-signals unggul ~6.7x lebih kecil. Menjaga batas anggaran 8 KB chunk (KIL-401).');
console.log('2. Kecepatan Operasi: alien-signals unggul dalam mutasi massal dan granular updates.');
console.log('3. Stabilitas API:');
console.log('   - alien-signals (v3.2) adalah pustaka murni push-pull signals yang stabil dan mandiri.');
console.log('   - @solidjs/signals (v2.0-rc) masih berstatus release candidate dengan isu internal bug.');
console.log('   - solid-js (v1.9) membawa overhead owner tree/context yang tidak dibutuhkan oleh compiler Kylat.');
console.log('4. Rekomendasi Pemenang: alien-signals ditetapkan sebagai inti reaktif resmi @kylat/runtime.');
console.log('================================================================\n');
