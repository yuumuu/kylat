/**
 * @kylat/cli - commands/doctor.ts
 * Perintah `kylat doctor` untuk memeriksa kesehatan lingkungan dan konfigurasi toolchain.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

export function runDoctorCommand(): number {
  console.log('🩺 Memeriksa kesehatan lingkungan Kylat Toolchain...\n');

  let issues = 0;

  // 1. Periksa Node.js
  const nodeVersion = process.version;
  const majorNode = parseInt(nodeVersion.slice(1).split('.')[0] || '0', 10);
  if (majorNode >= 20) {
    console.log(`  \x1b[32m✓\x1b[0m Node.js: ${nodeVersion} (Memenuhi syarat >= v20)`);
  } else {
    console.log(`  \x1b[31m❌\x1b[0m Node.js: ${nodeVersion} (Dibutuhkan versi >= v20)`);
    issues++;
  }

  // 2. Periksa PHP
  try {
    const phpOutput = execSync('php -v', { encoding: 'utf-8' });
    const match = phpOutput.match(/PHP\s+([0-9]+\.[0-9]+\.[0-9]+)/);
    const phpVersion = match ? match[1] : 'Unknown';
    console.log(`  \x1b[32m✓\x1b[0m PHP: ${phpVersion} (Terpasang dan terdeteksi di PATH)`);
  } catch {
    console.log('  \x1b[33m⚠️\x1b[0m PHP: Binary php tidak ditemukan di PATH sistem');
  }

  // 3. Periksa Composer
  try {
    execSync('composer --version', { encoding: 'utf-8' });
    console.log('  \x1b[32m✓\x1b[0m Composer: Terpasang dan siap digunakan');
  } catch {
    console.log('  \x1b[33m⚠️\x1b[0m Composer: Tidak ditemukan di PATH');
  }

  // 4. Periksa file konfigurasi
  if (fs.existsSync('composer.json')) {
    console.log('  \x1b[32m✓\x1b[0m composer.json terdeteksi di root proyek');
  }
  if (fs.existsSync('package.json')) {
    console.log('  \x1b[32m✓\x1b[0m package.json terdeteksi di root proyek');
  }

  console.log('');
  if (issues === 0) {
    console.log('✨ Semua pemeriksaan lingkungan selesai. Siap untuk mengembangkan aplikasi dengan Kylat!');
    return 0;
  } else {
    console.log(`⚠️  Ditemukan ${issues} masalah konfigurasi lingkungan.`);
    return 1;
  }
}
