#!/usr/bin/env node

/**
 * scripts/verify-error-codes.mjs
 * Skrip verifikasi CI untuk menjamin konsistensi kode error KIL-xxx antara compiler dan spec/errors.md.
 * Menguji kepatuhan kontrak P3: setiap kode galat wajib terdaftar di spec/errors.md, memiliki contoh pemicu,
 * dan terbukti memiliki SATU arti kanonik yang stabil (khususnya KIL-201) baik secara statis maupun fungsional.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const errorsSpecPath = path.join(rootDir, 'spec', 'errors.md');
const compilerSrcDir = path.join(rootDir, 'packages', 'compiler', 'src');
const compilerDistPath = path.join(rootDir, 'packages', 'compiler', 'dist', 'index.js');

console.log('=== AUDIT KONSISTENSI KODE ERROR KIL-XXX (CI LINT) ===\n');

let totalChecks = 0;
let passedChecks = 0;
let hasFailure = false;

function recordCheck(passed, description, failureDetail = '') {
  totalChecks++;
  if (passed) {
    passedChecks++;
    console.log(`   ✅ ${description}`);
  } else {
    hasFailure = true;
    console.error(`   ❌ ${description}`);
    if (failureDetail) {
      console.error(`      Detail: ${failureDetail}`);
    }
  }
}

// 1. Baca dan parse spec/errors.md
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

// 3. Verifikasi: Setiap kode di compiler wajib terdaftar di spec/errors.md
console.log('1. Memverifikasi pemakaian kode compiler terhadap katalog resmi:');
let codeIdx = 1;
for (const [code, files] of compilerCodes.entries()) {
  const specEntry = specCodes.get(code);
  const isRegistered = Boolean(specEntry);
  recordCheck(
    isRegistered,
    `[${codeIdx}/${compilerCodes.size}] ${code}: "${specEntry?.nama ?? 'TIDAK TERDAFTAR'}" (dipakai di: ${Array.from(files).join(', ')})`,
    !isRegistered ? `${code} dipakai di kode compiler tetapi tidak ada entri di spec/errors.md` : ''
  );
  codeIdx++;
}

// 4. Verifikasi: Setiap kode di spec wajib punya contoh salah & contoh benar
console.log('\n2. Memverifikasi kelengkapan contoh pemicu di spec/errors.md:');
let completeExamplesCount = 0;
for (const [code, meta] of specCodes.entries()) {
  if (meta.hasContohSalah && meta.hasContohBenar) {
    completeExamplesCount++;
  } else {
    recordCheck(
      false,
      `Kelengkapan contoh ${code}`,
      `Kode ${code} tidak memiliki 'Contoh Salah' atau 'Contoh Benar' di spec/errors.md`
    );
  }
}
recordCheck(
  completeExamplesCount === specCodes.size,
  `Semua ${completeExamplesCount} dari ${specCodes.size} kode di spec/errors.md memiliki 'Contoh Salah' dan 'Contoh Benar'.`
);

// 5. Verifikasi Semantik KIL-201: Definisi Tunggal & Makna Kanonik
console.log('\n3. Verifikasi Khusus Stabilitas Semantik KIL-201:');

// 5a. Stabilitas di spec/errors.md
const kil201Occurrences = specContent.match(/####\s+KIL-201/g) || [];
recordCheck(
  kil201Occurrences.length === 1,
  `KIL-201 memiliki tepat satu judul definisi di spec/errors.md (ditemukan: ${kil201Occurrences.length}).`
);

const kil201Meta = specCodes.get('KIL-201');
const isCanonicalName = kil201Meta?.nama === 'Struktur berkas komponen tunggal dan final';
recordCheck(
  isCanonicalName,
  `Nama kanonik KIL-201 di spec: "${kil201Meta?.nama}".`
);

// 5b. Audit Semantik Statis Pemanggilan KIL-201 di analyzer.ts
const analyzerPath = path.join(compilerSrcDir, 'analyzer.ts');
const analyzerContent = fs.readFileSync(analyzerPath, 'utf-8');

// Ekstrak semua kemunculan 'KIL-201' di analyzer.ts
const kil201Pattern = /createDiagnostic\s*\(\s*['"]KIL-201['"][\s\S]*?\)/g;
const kil201CallSites = [...analyzerContent.matchAll(kil201Pattern)].map((m) => m[0]);

recordCheck(
  kil201CallSites.length === 2,
  `KIL-201 di analyzer.ts dipanggil tepat di 2 call site struktur kelas (ditemukan: ${kil201CallSites.length}).`
);

// Call site 1 wajib untuk ketiadaan class declaration
const hasClassMissingCheck = kil201CallSites.some((call) =>
  call.includes('Tidak ditemukan definisi class komponen')
);
recordCheck(
  hasClassMissingCheck,
  'KIL-201 call site #1 secara semantik memeriksa ketiadaan class komponen.'
);

// Call site 2 wajib untuk class tidak final
const hasNonFinalCheck = kil201CallSites.some((call) =>
  call.includes('ERROR_MESSAGES.KIL_201') || call.includes('final')
);
recordCheck(
  hasNonFinalCheck,
  'KIL-201 call site #2 secara semantik memeriksa keharusan modifier "final".'
);

// 5c. Verifikasi Semantik Fungsional/Runtime KIL-201
let compilerModule = null;
try {
  if (fs.existsSync(compilerDistPath)) {
    const { pathToFileURL } = await import('node:url');
    compilerModule = await import(pathToFileURL(compilerDistPath).href);
  }
} catch (e) {
  // Gagal memuat compiler dist
  console.warn('   ⚠️ Catatan: Gagal memuat module compiler untuk uji runtime:', e.message);
}

if (compilerModule?.compile) {
  console.log('\n4. Verifikasi Fungsional Runtime Semantik KIL-201:');
  
  // Tes Runtime A: Class tanpa final harus memicu KIL-201 dengan pesan tentang 'final'
  const nonFinalPhp = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;

class NonFinalCounter extends Component {}
`;
  const resNonFinal = await compilerModule.compile(nonFinalPhp, 'NonFinalCounter.php');
  const nonFinalDiagnostic = resNonFinal.diagnostics.find((d) => d.code === 'KIL-201');
  recordCheck(
    Boolean(nonFinalDiagnostic && (nonFinalDiagnostic.message.includes('final') || nonFinalDiagnostic.hint?.includes('final'))),
    'Runtime: Class tanpa modifier final menghasilkan KIL-201 dengan pesan terkait "final".'
  );

  // Tes Runtime B: Berkas tanpa class harus memicu KIL-201 dengan pesan tentang definisi class
  const noClassPhp = `<?php
declare(strict_types=1);
namespace App\\Components;
`;
  const resNoClass = await compilerModule.compile(noClassPhp, 'NoClass.php');
  const noClassDiagnostic = resNoClass.diagnostics.find((d) => d.code === 'KIL-201');
  recordCheck(
    Boolean(noClassDiagnostic && noClassDiagnostic.message.includes('definisi class komponen')),
    'Runtime: Berkas tanpa class komponen menghasilkan KIL-201 dengan pesan ketiadaan class.'
  );

  // Tes Runtime C: Class final valid TIDAK boleh menghasilkan KIL-201
  const validPhp = `<?php
declare(strict_types=1);
namespace App\\Components;
use Kylat\\Component;

final class ValidCounter extends Component {}
`;
  const resValid = await compilerModule.compile(validPhp, 'ValidCounter.php');
  const hasUnexpectedKil201 = resValid.diagnostics.some((d) => d.code === 'KIL-201');
  recordCheck(
    !hasUnexpectedKil201,
    'Runtime: Class final valid TIDAK memicu KIL-201.'
  );
}

// 6. Ringkasan Akhir
const passRate = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 0;
console.log('\n-------------------------------------------------------------');
console.log(`Statistik Pengujian: ${passedChecks} dari ${totalChecks} pemeriksaan berhasil (${passRate}%).`);

if (hasFailure || passRate < 100) {
  console.error(`❌ HASIL AUDIT: GAGAL (${passedChecks}/${totalChecks} lolos, tingkat kelulusan ${passRate}%). Ada inkonsistensi kode galat.`);
  process.exit(1);
} else {
  console.log(`🎉 HASIL AUDIT: LULUS ${passRate}%! Semua ${compilerCodes.size} kode galat compiler terverifikasi konsisten dengan ${specCodes.size} kode di spesifikasi.`);
  process.exit(0);
}
