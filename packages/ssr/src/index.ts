/**
 * @kylat/ssr
 * Prerender/SSR opsional: render factory komponen Kylat menjadi string HTML.
 *
 * Bukan bagian dari runtime browser; dependensi DOM (linkedom) hanya dipakai
 * di server/build.
 */

import { parseHTML } from 'linkedom';

export type IslandProps = Record<string, unknown>;
export type ComponentFactory = (props: IslandProps) => Node;

/**
 * Merender komponen menjadi string HTML memakai DOM linkedom.
 * `document` global dipulihkan setelah render.
 */
export function renderToString(factory: ComponentFactory, props: IslandProps = {}): string {
  const { document } = parseHTML('<!doctype html><html><body></body></html>');
  const globalScope = globalThis as unknown as { document?: Document };
  const previous = globalScope.document;

  globalScope.document = document as unknown as Document;
  try {
    const node = factory(props);
    if (node && typeof (node as Element).outerHTML === 'string') {
      return (node as Element).outerHTML;
    }

    return node?.textContent ?? '';
  } finally {
    if (previous === undefined) {
      delete globalScope.document;
    } else {
      globalScope.document = previous;
    }
  }
}
