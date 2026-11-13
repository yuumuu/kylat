/**
 * @kylat/vite-plugin
 * Plugin Vite untuk mengompilasi komponen single-file `*.kylat.php` saat dev
 * dan build. Pada perubahan file, modul di-invalidate dan Vite melakukan
 * full reload (belum ada component-level HMR accept).
 */

import type { Plugin, HmrContext } from 'vite';
import { compile } from '@kylat/compiler';

export interface KylatPluginOptions {
  /** Pola berkas yang dikompilasi. Default: /\.kylat\.php$/. */
  include?: RegExp;
}

const DEFAULT_INCLUDE = /\.kylat\.php$/;

function cleanId(id: string | null): string {
  if (id === null || id === '') return '';
  return id.split('?')[0] ?? id;
}

export function kylat(options: KylatPluginOptions = {}): Plugin {
  const include = options.include ?? DEFAULT_INCLUDE;
  let isServe = false;

  return {
    name: 'kylat',
    enforce: 'pre',

    configResolved(config) {
      isServe = config.command === 'serve';
    },

    async transform(code: string, id: string) {
      const file = cleanId(id);
      if (!include.test(file)) {
        return null;
      }

      const result = await compile(code, file);
      if (!result.success) {
        const diagnostic = result.diagnostics
          .map((item) => `[${item.code}] ${item.message} (${item.line}:${item.column})`)
          .join('\n');
        this.error(`Kylat compile gagal untuk ${file}:\n${diagnostic}`);
        return null;
      }

      const componentName = result.ir?.name ?? '';
      const hmrFooter =
        isServe && componentName
          ? `\nimport { updateIslandFactory } from '@kylat/runtime';\n` +
            `if (import.meta.hot) {\n` +
            `  import.meta.hot.accept((next) => {\n` +
            `    if (next && typeof next.create${componentName} === 'function') {\n` +
            `      updateIslandFactory(${JSON.stringify(componentName)}, next.create${componentName});\n` +
            `    }\n` +
            `  });\n` +
            `}\n`
          : '';

      return {
        code: result.code + hmrFooter,
        map: result.map ? JSON.parse(result.map) : null,
      };
    },

    handleHotUpdate(context: HmrContext) {
      const file = cleanId(context.file);
      if (!include.test(file)) {
        return;
      }

      const modules = context.modules.filter((module) => include.test(cleanId(module.id)));
      if (modules.length > 0) {
        // Biarkan Vite mempropagasi update ke importir.
        return modules;
      }

      // Tidak ada modul termonitor (mis. file baru): reload penuh agar aman.
      context.server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}

export default kylat;
