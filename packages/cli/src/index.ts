/**
 * @kylat/cli
 * Logika CLI Kylat.
 */

import { runCheckCommand } from './commands/check.js';
import { runBuildCommand } from './commands/build.js';
import { runDoctorCommand } from './commands/doctor.js';

export async function runCli(args: string[]): Promise<void> {
  const command = args[0] || 'help';

  switch (command) {
    case 'check': {
      const target = args[1] || '.';
      const code = await runCheckCommand(target);
      process.exitCode = code;
      break;
    }

    case 'build': {
      const input = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      const outDirIndex = args.indexOf('--out-dir');
      const outDir = outDirIndex !== -1 && args[outDirIndex + 1] ? args[outDirIndex + 1] : undefined;
      const code = await runBuildCommand(input, { outDir });
      process.exitCode = code;
      break;
    }

    case 'doctor': {
      const code = runDoctorCommand();
      process.exitCode = code;
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default:
      console.log(`⚡ Kylat CLI v0.0.1
Frontend subset PHP yang dikompilasi ke JavaScript reaktivitas sinyal.

Penggunaan: kylat <perintah> [opsi]

Perintah:
  check [path]                  Periksa aturan bahasa dan template (KIL-101..KIL-311)
  build [input] [--out-dir dir] Kompilasi komponen PHP ke modul JavaScript
  doctor                        Audit kesehatan konfigurasi lingkungan (Node, PHP, Composer)
  dev                           Jalankan dev server dengan HMR (segera)
  make:component [nama]         Buat boilerplate komponen baru (segera)
  make:action [nama]            Buat boilerplate kelas aksi server (segera)
`);
      break;
  }
}
