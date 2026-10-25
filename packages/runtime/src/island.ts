/**
 * @kylat/runtime - island.ts
 * Registri komponen island dan logika hidrasi fine-grained di DOM.
 */

export interface IslandProps {
  [key: string]: unknown;
}

export type ComponentFactory = (props: IslandProps) => HTMLElement;

const islandRegistry = new Map<string, ComponentFactory>();

/**
 * Mendaftarkan factory komponen island ke registry client.
 */
export function registerIsland(name: string, factory: ComponentFactory): void {
  islandRegistry.set(name, factory);
}

/**
 * Mengembalikan factory komponen terdaftar berdasarkan nama.
 */
export function getIsland(name: string): ComponentFactory | undefined {
  return islandRegistry.get(name);
}

/**
 * Menghapus pendaftaran island (berguna untuk testing).
 */
export function clearIslands(): void {
  islandRegistry.clear();
}

/**
 * Hidrasi elemen DOM penampung island (elemen beratribut data-island="...").
 */
export function hydrateIsland(el: HTMLElement): void {
  const islandName = el.getAttribute('data-island');
  const propsRaw = el.getAttribute('data-props');

  if (!islandName) return;

  const factory = islandRegistry.get(islandName);
  if (!factory) {
    console.warn(`[Kylat] Komponen island '${islandName}' belum terdaftar di registry client.`);
    return;
  }

  let props: IslandProps = {};
  if (propsRaw) {
    try {
      props = JSON.parse(propsRaw) as IslandProps;
    } catch (e) {
      console.error(`[Kylat] Gagal mengurai data-props untuk island '${islandName}':`, e);
      return;
    }
  }

  const renderedEl = factory(props);
  el.replaceChildren(renderedEl);
}

/**
 * Memindai seluruh subtree DOM dan menghidrasi semua elemen data-island yang belum terhidrasi.
 */
export function hydrateAll(root: Document | HTMLElement = document): void {
  const elements = root.querySelectorAll<HTMLElement>('[data-island]');
  elements.forEach((el) => hydrateIsland(el));
}
