/**
 * @kylat/cli - commands/doctor.ts
 * Perintah `kylat doctor`: audit ringan lingkungan pengembangan.
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';

const MIN_PHP_PATCH: Record<string, string> = {
  '8.2': '8.2.35',
  '8.3': '8.3.36',
  '8.4': '8.4.27',
  '8.5': '8.5.12',
};

export function runDoctorCommand(): number {
  console.log('🩺 Memeriksa kesehatan lingkungan Kylat Toolchain...\n');

  let issues = 0;

  const nodeVersion = process.version;
  const majorNode = parseInt(nodeVersion.slice(1).split('.')[0] || '0', 10);
  if (majorNode >= 20) {
    console.log(`  \x1b[32m✓\x1b[0m Node.js: ${nodeVersion} (Memenuhi syarat >= v20)`);
  } else {
    console.log(`  \x1b[31m❌\x1b[0m Node.js: ${nodeVersion} (Dibutuhkan versi >= v20)`);
    issues++;
  }

  try {
    const phpOutput = execSync('php -v', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
    const match = phpOutput.match(/PHP\s+([0-9]+\.[0-9]+\.[0-9]+)/);
    const phpVersion = match?.[1] ?? 'Unknown';
    const minor = phpVersion.split('.').slice(0, 2).join('.');
    const minimum = MIN_PHP_PATCH[minor];

    if (phpVersion === 'Unknown') {
      console.log('  \x1b[33m⚠️\x1b[0m PHP: versi tidak dapat dibaca');
    } else if (!minimum) {
      console.log(
        `  \x1b[31m❌\x1b[0m PHP: ${phpVersion} (cabang ${minor} tidak ada di allowlist keamanan)`
      );
      issues++;
    } else if (compareVersions(phpVersion, minimum) < 0) {
      console.log(
        `  \x1b[31m❌\x1b[0m PHP: ${phpVersion} di bawah ambang aman ${minimum} untuk cabang ${minor}`
      );
      issues++;
    } else {
      console.log(`  \x1b[32m✓\x1b[0m PHP: ${phpVersion} (>= ${minimum})`);
    }
  } catch {
    console.log(
      '  \x1b[33m⚠️\x1b[0m PHP: binary php tidak ditemukan. Abaikan bila proyek hanya memakai frontend statis.'
    );
  }

  try {
    execSync('composer --version', {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    console.log('  \x1b[32m✓\x1b[0m Composer: Terpasang dan siap digunakan');
  } catch {
    console.log('  \x1b[33m⚠️\x1b[0m Composer: Tidak ditemukan di PATH');
  }

  if (fs.existsSync('composer.json')) {
    console.log('  \x1b[32m✓\x1b[0m composer.json terdeteksi di root proyek');
  }
  if (fs.existsSync('package.json')) {
    console.log('  \x1b[32m✓\x1b[0m package.json terdeteksi di root proyek');
  }

  console.log('');
  if (issues === 0) {
    console.log('✨ Semua pemeriksaan lingkungan selesai. Siap mengembangkan aplikasi dengan Kylat!');
    return 0;
  }

  console.log(`⚠️  Ditemukan ${issues} masalah konfigurasi lingkungan yang perlu diperbaiki.`);
  return 1;
}

function compareVersions(left: string, right: string): number {
  const a = left.split('.').map((part) => parseInt(part, 10));
  const b = right.split('.').map((part) => parseInt(part, 10));
  for (let i = 0; i < 3; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
