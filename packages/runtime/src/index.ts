/**
 * @kylat/runtime
 * Runtime reaktivitas signals dan DOM reconciliation untuk browser.
 */

export interface IslandProps {
  [key: string]: unknown;
}

export function hydrateIsland(el: HTMLElement): void {
  const islandName = el.getAttribute('data-island');
  const propsRaw = el.getAttribute('data-props');

  if (!islandName) {
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

  // Inisialisasi island signals & DOM binding
}
