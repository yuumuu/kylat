/**
 * @kylat/cli
 * Logika CLI Kylat.
 */

import { runCheckCommand } from './commands/check.js';
import { runBuildCommand } from './commands/build.js';
import { runDoctorCommand } from './commands/doctor.js';
import { runMakeComponentCommand } from './commands/make.js';
import { runTypesCommand } from './commands/types.js';

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
      const production = args.includes('--production');
      const sourceMap = args.includes('--no-sourcemap') ? false : undefined;
      const code = await runBuildCommand(input, { outDir, sourceMap, production });
      process.exitCode = code;
      break;
    }

    case 'doctor': {
      const code = runDoctorCommand();
      process.exitCode = code;
      break;
    }

    case 'make:component':
    case 'make': {
      const name = args[1];
      const dirIndex = args.indexOf('--dir');
      const dir = dirIndex !== -1 && args[dirIndex + 1] ? args[dirIndex + 1] : undefined;
      const code = runMakeComponentCommand(name, { dir });
      process.exitCode = code;
      break;
    }

    case 'types': {
      const schemaPath = args[1] && !args[1].startsWith('--') ? args[1] : undefined;
      const outIndex = args.indexOf('--out');
      const out = outIndex !== -1 && args[outIndex + 1] ? args[outIndex + 1] : undefined;
      const check = args.includes('--check');
      const code = await runTypesCommand(schemaPath, { out, check });
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
  make:component <Nama> [--dir path]  Buat komponen single-file *.kylat.php
  check [path]                       Periksa aturan bahasa dan template (KIL-101..KIL-311)
  build [input] [--out-dir dir] [--production|--no-sourcemap]
                                     Kompilasi komponen ke modul JavaScript + manifest + source map
  types <schema.json|-> [--out file] [--check]
                                     Hasilkan tipe TypeScript dari schema aksi; --check untuk validasi sinkron
  doctor                             Audit ringan Node, PHP, dan Composer
`);
      break;
  }
}
