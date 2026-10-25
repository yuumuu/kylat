/**
 * @kylat/compiler - diagnostics.ts
 * Representasi diagnosa error dan peringatan compiler sesuai spec/errors.md.
 */

export interface Diagnostic {
  code: string;
  file: string;
  line: number;
  column: number;
  message: string;
  hint?: string;
  docUrl: string;
}

export function createDiagnostic(
  code: string,
  file: string,
  line: number,
  column: number,
  message: string,
  hint?: string
): Diagnostic {
  return {
    code,
    file,
    line,
    column,
    message,
    hint,
    docUrl: `https://kylat.dev/docs/errors/${code.toLowerCase()}`,
  };
}

export const ERROR_MESSAGES = {
  KIL_101: "Operator perbandingan longgar '==' dan '!=' dilarang. Gunakan perbandingan strict '===' atau '!=='.",
  KIL_102: "Berkas komponen wajib mendeklarasikan 'declare(strict_types=1);' di awal berkas.",
  KIL_103: 'Komponen dilarang menggunakan static property, variabel global, atau variable-variables ($$var).',
  KIL_104: 'Fitur sintaks PHP ini tidak didukung di subset Kylat v0.',
  KIL_201: "Satu berkas hanya boleh mendefinisikan satu kelas komponen 'final' dengan nama berkas persis sama.",
  KIL_203: 'Tipe data properti harus dideklarasikan secara eksplisit (untyped property dilarang).',
  KIL_204: 'Properti komponen tidak boleh bertipe callable, Closure, atau resource.',
  KIL_205: 'Visibilitas properti harus dinyatakan eksplisit (public, protected, atau private).',
  KIL_212: "Tag komponen '<x-{nama}>' wajib dideklarasikan di kelas induk menggunakan atribut #[Child({Kelas}::class)].",
  KIL_213: 'Ukuran data-props untuk komponen melebihi batas maksimum 16 KB (KIL-213).',
  KIL_311: 'Nama aksi server duplikat atau bertabrakan di dalam kontrak yang sama.',
} as const;
