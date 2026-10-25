/**
 * @kylat/compiler - template-parser.ts
 * Parser template HTML/Blade subset v0 sesuai spec/template.md.
 * Menguraikan dialek on:<event>="handler()", bind:value="prop", dan {{ $expr }}.
 */

export interface ParsedEvent {
  event: string;
  handlerCall: string;
}

export interface ParsedElement {
  tag: string;
  attributes: Record<string, string>;
  events: ParsedEvent[];
  textContent?: string;
  expressionBinding?: string;
  children: ParsedElement[];
}

/**
 * Mem-parse template HTML subset Kylat menjadi pohon elemen terstruktur.
 */
export function parseTemplate(templateSource: string): ParsedElement[] {
  const elements: ParsedElement[] = [];

  // Regex sederhana untuk membedah tag HTML dan teks di subset v0
  const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>(.*?)<\/\1>|<([a-zA-Z0-9-]+)([^>]*)\/>/gs;
  let match: RegExpExecArray | null;

  while ((match = tagRegex.exec(templateSource)) !== null) {
    const isSelfClosing = Boolean(match[4]);
    const tag = isSelfClosing ? match[4]! : match[1]!;
    const rawAttrs = isSelfClosing ? match[5]! : match[2]!;
    const rawInner = isSelfClosing ? '' : match[3]!;

    const attributes: Record<string, string> = {};
    const events: ParsedEvent[] = [];

    // Ekstraksi atribut dan on:<event>="handler()"
    const attrRegex = /([a-zA-Z0-9:_-]+)(?:="([^"]*)")?/g;
    let attrMatch: RegExpExecArray | null;

    while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
      const attrName = attrMatch[1];
      const attrVal = attrMatch[2] ?? '';

      if (!attrName) continue;

      if (attrName.startsWith('on:')) {
        const eventName = attrName.slice(3);
        events.push({
          event: eventName,
          handlerCall: attrVal,
        });
      } else {
        attributes[attrName] = attrVal;
      }
    }

    // Periksa interpolasi teks {{ $var }}
    let expressionBinding: string | undefined;
    let textContent: string | undefined;

    const exprMatch = rawInner.match(/{{\s*\$([a-zA-Z0-9_]+)\s*}}/);
    if (exprMatch && exprMatch[1]) {
      expressionBinding = exprMatch[1];
    } else if (rawInner.trim() && !rawInner.includes('<')) {
      textContent = rawInner.trim();
    }

    // Rekursi untuk children jika ada tag di dalam
    let children: ParsedElement[] = [];
    if (rawInner.includes('<')) {
      children = parseTemplate(rawInner);
    }

    elements.push({
      tag,
      attributes,
      events,
      textContent,
      expressionBinding,
      children,
    });
  }

  return elements;
}
