/**
 * @kylat/compiler - template-parser.ts
 * Parser template HTML/Blade subset v0 berbasis token stack sesuai spec/template.md.
 * Menangani kedalaman nesting tag HTML bersarang (seperti <div> di dalam <div>).
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
 * Tokenizer & Tree Builder stack-based untuk template HTML.
 */
export function parseTemplate(templateSource: string): ParsedElement[] {
  const rootElements: ParsedElement[] = [];
  const stack: { element: ParsedElement; rawTextParts: string[] }[] = [];

  // Pola regex token HTML: tag pembuka, tag penutup, tag self-closing, atau teks
  const tokenRegex = /(<\/([a-zA-Z0-9-]+)\s*>)|(<([a-zA-Z0-9-]+)((?:\s+[a-zA-Z0-9:_-]+(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>)|([^<]+)/gs;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(templateSource)) !== null) {
    const isClosing = Boolean(match[1]);
    const isOpening = Boolean(match[3]);
    const isText = Boolean(match[7]);

    if (isText) {
      const text = match[7]!;
      if (stack.length > 0) {
        stack[stack.length - 1]!.rawTextParts.push(text);
      }
    } else if (isOpening) {
      const tagName = match[4]!;
      const rawAttrs = match[5] ?? '';
      const isSelfClosing = match[6] === '/' || ['input', 'img', 'br', 'hr'].includes(tagName.toLowerCase());

      const attributes: Record<string, string> = {};
      const events: ParsedEvent[] = [];

      // Ekstraksi atribut dan on:<event>="handler()"
      const attrRegex = /([a-zA-Z0-9:_-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let attrMatch: RegExpExecArray | null;

      while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
        const attrName = attrMatch[1];
        if (!attrName) continue;
        const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? '';

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

      const newElem: ParsedElement = {
        tag: tagName,
        attributes,
        events,
        children: [],
      };

      if (isSelfClosing) {
        if (stack.length > 0) {
          stack[stack.length - 1]!.element.children.push(newElem);
        } else {
          rootElements.push(newElem);
        }
      } else {
        stack.push({ element: newElem, rawTextParts: [] });
      }
    } else if (isClosing) {
      const closingTag = match[2]!;

      // Temukan tag pembuka yang cocok di stack dari puncak ke bawah
      let foundIndex = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.element.tag.toLowerCase() === closingTag.toLowerCase()) {
          foundIndex = i;
          break;
        }
      }

      if (foundIndex !== -1) {
        const popped = stack.splice(foundIndex, 1)[0]!;
        const elem = popped.element;
        const rawContent = popped.rawTextParts.join('');

        // Jika tidak memiliki elemen anak, periksa interpolasi ekspresi atau teks murni
        if (elem.children.length === 0) {
          const exprMatch = rawContent.match(/{{\s*\$([a-zA-Z0-9_]+)\s*}}/);
          if (exprMatch && exprMatch[1]) {
            elem.expressionBinding = exprMatch[1];
          } else if (rawContent.trim().length > 0) {
            elem.textContent = rawContent.trim();
          }
        }

        if (stack.length > 0) {
          stack[stack.length - 1]!.element.children.push(elem);
        } else {
          rootElements.push(elem);
        }
      }
    }
  }

  return rootElements;
}
