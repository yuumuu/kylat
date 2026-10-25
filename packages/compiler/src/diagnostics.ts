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
  KIL_101: 'Deklarasi strict_types=1 wajib ada di baris pertama file komponen.',
  KIL_102: 'Fitur sintaks PHP ini tidak didukung di subset Kylat v0.',
  KIL_103: 'Penggunaan static, global, atau variable-variables ($$var) dilarang dalam komponen.',
  KIL_201: 'Definisi class komponen tidak valid.',
  KIL_202: 'Class komponen harus ditandai final.',
  KIL_203: 'Tipe data properti harus dideklarasikan secara eksplisit (untyped property dilarang).',
  KIL_204: 'Properti komponen tidak boleh bertipe callable, Closure, atau resource.',
  KIL_205: 'Visibilitas properti harus dinyatakan eksplisit (public, protected, atau private).',
  KIL_206: 'Inisialisasi default properti harus berupa nilai literal konstan.',
  KIL_210: 'Komponen anak harus dideklarasikan menggunakan atribut #[Child(Komponen::class)].',
  KIL_211: 'Aksi server harus dideklarasikan menggunakan atribut #[Uses(KontrakAksi::class)].',
  KIL_212: 'Serialisasi data-props melebihi batas maksimum 16 KB.',
  KIL_301: 'Tag template Kylat tidak ditutup dengan benar.',
  KIL_302: 'Ekspresi binding {{ ... }} tidak valid atau kosong.',
  KIL_303: 'Direktif @foreach memerlukan atribut :key unik.',
  KIL_311: 'Nama method aksi server duplikat atau tidak unik dalam satu komponen.',
} as const;
