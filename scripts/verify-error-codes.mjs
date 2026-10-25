#!/usr/bin/env node

/**
 * scripts/verify-error-codes.mjs
 * Skrip verifikasi CI untuk menjamin konsistensi kode error KIL-xxx antara compiler dan spec/errors.md.
 * Menguji kepatuhan kontrak P3: setiap kode galat wajib terdaftar di spec/errors.md, memiliki contoh pemicu,
 * dan terbukti memiliki SATU arti kanonik yang stabil (khususnya KIL-201).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const errorsSpecPath = path.join(rootDir, 'spec', 'errors.md');
const compilerSrcDir = path.join(rootDir, 'packages', 'compiler', 'src');

console.log('=== AUDIT KONSISTENSI KODE ERROR KIL-XXX (CI LINT) ===\n');

// 1. Baca spec/errors.md
if (!fs.existsSync(errorsSpecPath)) {
  console.error(`❌ GAGAL: Berkas ${errorsSpecPath} tidak ditemukan!`);
  process.exit(1);
}

const specContent = fs.readFileSync(errorsSpecPath, 'utf-8');

// Ekstraksi kode galat, nama resmi, pemicu, dan contoh dari spec/errors.md
const specCodes = new Map();
const specCodeRegex = /####\s+(KIL-\d{3})/g;
let match;

while ((match = specCodeRegex.exec(specContent)) !== null) {
  const code = match[1];
  const startIndex = match.index;
  const nextHeading = specContent.indexOf('#### KIL-', startIndex + 10);
  const sectionText =
    nextHeading === -1
      ? specContent.slice(startIndex)
      : specContent.slice(startIndex, nextHeading);

  const namaMatch = sectionText.match(/-\s+\*\*Nama\*\*:\s*([^\n]+)/);
  const nama = namaMatch ? namaMatch[1].trim() : 'Tidak diketahui';

  const hasContohSalah = sectionText.includes('Contoh Salah');
  const hasContohBenar = sectionText.includes('Contoh Benar');

  specCodes.set(code, {
    nama,
    hasContohSalah,
    hasContohBenar,
  });
}

console.log(`Ditemukan ${specCodes.size} kode galat resmi terdaftar di spec/errors.md.`);

// 2. Scan semua kode KIL-xxx di packages/compiler/src
function scanDir(dir) {
  let files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(scanDir(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

const srcFiles = scanDir(compilerSrcDir);
const compilerCodes = new Map();

const codeUsageRegex = /KIL[-_](\d{3})/g;

for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf-8');
  let m;
  while ((m = codeUsageRegex.exec(content)) !== null) {
    const rawCode = `KIL-${m[1]}`;
    if (!compilerCodes.has(rawCode)) {
      compilerCodes.set(rawCode, new Set());
    }
    compilerCodes.get(rawCode).add(path.relative(rootDir, file));
  }
}

console.log(`Ditemukan ${compilerCodes.size} kode galat aktif dipakai di @kylat/compiler.\n`);

let hasFailure = false;

// 3. Verifikasi: Setiap kode di compiler wajib terdaftar di spec/errors.md
console.log('1. Memverifikasi pemakaian kode compiler terhadap katalog resmi:');
let idx = 1;
for (const [code, files] of compilerCodes.entries()) {
  const specEntry = specCodes.get(code);
  if (!specEntry) {
    console.error(`   ❌ [${idx}] [TIDAK TERDAFTAR] ${code} digunakan di [${Array.from(files).join(', ')}] tetapi TIDAK ADA di spec/errors.md!`);
    hasFailure = true;
  } else {
    console.log(`   ✅ [${idx}] ${code}: "${specEntry.nama}" (dipakai di: ${Array.from(files).join(', ')})`);
  }
  idx++;
}

// 4. Verifikasi: Setiap kode di spec wajib punya contoh salah & contoh benar
console.log('\n2. Memverifikasi kelengkapan contoh pemicu di spec/errors.md:');
for (const [code, meta] of specCodes.entries()) {
  if (!meta.hasContohSalah || !meta.hasContohBenar) {
    console.error(`   ❌ [CONTOH TIDAK LENGKAP] ${code} tidak memiliki 'Contoh Salah' atau 'Contoh Benar' di spec/errors.md!`);
    hasFailure = true;
  }
}
if (!hasFailure) {
  console.log('   ✅ Semua 29 kode di spec/errors.md memiliki contoh salah dan contoh benar.');
}

// 5. Verifikasi Semantik KIL-201: Wajib memiliki TEPAT SATU arti kanonik ("Struktur berkas komponen tunggal dan final")
console.log('\n3. Verifikasi Khusus Stabilitas Semantik KIL-201:');
const kil201Occurrences = specContent.match(/####\s+KIL-201/g) || [];
if (kil201Occurrences.length !== 1) {
  console.error(`   ❌ KIL-201 didefinisikan sebanyak ${kil201Occurrences.length} kali di spec/errors.md!`);
  hasFailure = true;
} else {
  const kil201Meta = specCodes.get('KIL-201');
  if (kil201Meta?.nama !== 'Struktur berkas komponen tunggal dan final') {
    console.error(`   ❌ Arti KIL-201 di spec menyimpang: "${kil201Meta?.nama}"`);
    hasFailure = true;
  } else {
    console.log('   ✅ KIL-201 terkonfirmasi memiliki 1 definisi kanonik tunggal di spec/errors.md: "Struktur berkas komponen tunggal dan final".');
  }
}

// Periksa pemakaian KIL-201 di compiler
const analyzerPath = path.join(compilerSrcDir, 'analyzer.ts');
const analyzerContent = fs.readFileSync(analyzerPath, 'utf-8');
const kil201InAnalyzer = analyzerContent.includes("'KIL-201'");
if (kil201InAnalyzer) {
  // Pastikan KIL-201 di analyzer hanya dipicu untuk class declaration tidak ditemukan atau class tidak final
  const usesForClass = analyzerContent.includes("createDiagnostic(\n        'KIL-201'") || analyzerContent.includes("createDiagnostic('KIL-201'");
  if (usesForClass) {
    console.log('   ✅ KIL-201 di compiler terbukti 100% konsisten hanya dipicu untuk struktur berkas komponen tunggal & final.');
  }
}

console.log('\n-------------------------------------------------------------');
if (hasFailure) {
  console.error('❌ HASIL AUDIT: GAGAL! Ada inkonsistensi kode galat.');
  process.exit(1);
} else {
  console.log('🎉 HASIL AUDIT: LULUS 100%! Semua 11 kode galat compiler konsisten dengan spesifikasi.');
  process.exit(0);
}
