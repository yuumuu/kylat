/**
 * @kylat/compiler - template-parser.ts
 * Parser template HTML/Blade subset v0 berbasis token stack sesuai spec/template.md.
 * Menangani tag void, komentar HTML, atribut berisi >, escape quote, tag self-closing,
 * tag bersarang nama sama, serta deteksi mismatched dan unclosed tag (fail-fast KIL-151).
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

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

/**
 * Mem-parse template HTML string menjadi hirarki ParsedElement.
 * Melempar Error jika terdapat sintaks rusak, penutup tidak cocok, atau tag tak tertutup.
 */
export function parseTemplate(templateSource: string): ParsedElement[] {
  const rootElements: ParsedElement[] = [];
  const stack: { element: ParsedElement; textBuffer: string }[] = [];

  let i = 0;
  const len = templateSource.length;

  while (i < len) {
    // 1. Lewati Komentar HTML <!-- ... -->
    if (templateSource.startsWith('<!--', i)) {
      const endComment = templateSource.indexOf('-->', i + 4);
      if (endComment === -1) {
        throw new Error('KIL-151: Komentar HTML tidak ditutup dengan -->');
      }
      i = endComment + 3;
      continue;
    }

    // 2. Tag Penutup: </tagName>
    if (templateSource.startsWith('</', i)) {
      const endTag = templateSource.indexOf('>', i + 2);
      if (endTag === -1) {
        throw new Error('KIL-151: Tag penutup tidak memiliki karakter penutup >');
      }

      const closingTag = templateSource.slice(i + 2, endTag).trim().toLowerCase();
      i = endTag + 1;

      if (stack.length === 0) {
        throw new Error(`KIL-151: Tag penutup </${closingTag}> tidak memiliki pasangan tag pembuka`);
      }

      const top = stack[stack.length - 1]!;
      if (top.element.tag.toLowerCase() !== closingTag) {
        throw new Error(
          `KIL-151: Tag penutup </${closingTag}> tidak cocok dengan tag pembuka <${top.element.tag}>`
        );
      }

      const popped = stack.pop()!;
      const elem = popped.element;
      const rawContent = popped.textBuffer;

      // Elemen kontainer yang memiliki anak DILARANG KERAS mengikat bindText/textContent
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
      continue;
    }

    // 3. Tag Pembuka atau Self-Closing: <tagName ... > atau <tagName ... />
    if (templateSource[i] === '<' && i + 1 < len && /[a-zA-Z0-9_-]/.test(templateSource[i + 1]!)) {
      i++; // Lewati '<'

      // Baca nama tag
      let tagName = '';
      while (i < len && /[a-zA-Z0-9_-]/.test(templateSource[i]!)) {
        tagName += templateSource[i];
        i++;
      }

      const attributes: Record<string, string> = {};
      const events: ParsedEvent[] = [];

      // Baca atribut sampai '>' atau '/>'
      let isSelfClosing = false;

      while (i < len) {
        // Lewati whitespace
        while (i < len && /\s/.test(templateSource[i]!)) {
          i++;
        }

        if (i >= len) {
          throw new Error(`KIL-151: Tag <${tagName}> tidak selesai (kehilangan >)`);
        }

        // Akhir tag pembuka
        if (templateSource[i] === '>') {
          i++;
          break;
        }

        if (templateSource[i] === '/' && i + 1 < len && templateSource[i + 1] === '>') {
          isSelfClosing = true;
          i += 2;
          break;
        }

        // Baca nama atribut
        let attrName = '';
        while (i < len && /[a-zA-Z0-9:_-]/.test(templateSource[i]!)) {
          attrName += templateSource[i];
          i++;
        }

        if (!attrName) {
          // Karakter tidak terduga di atribut
          if (templateSource[i] !== '>' && !(templateSource[i] === '/' && templateSource[i + 1] === '>')) {
            i++;
          }
          continue;
        }

        // Lewati whitespace sebelum '=' jika ada
        while (i < len && /\s/.test(templateSource[i]!)) {
          i++;
        }

        let attrVal = '';
        if (i < len && templateSource[i] === '=') {
          i++; // Lewati '='
          while (i < len && /\s/.test(templateSource[i]!)) {
            i++;
          }

          if (i < len && (templateSource[i] === '"' || templateSource[i] === "'")) {
            const quoteChar = templateSource[i]!;
            i++; // Lewati quote pembuka
            let valBuf = '';
            while (i < len) {
              if (templateSource[i] === '\\' && i + 1 < len) {
                // Karakter escape di dalam atribut
                valBuf += templateSource[i + 1];
                i += 2;
              } else if (templateSource[i] === quoteChar) {
                i++; // Lewati quote penutup
                break;
              } else {
                valBuf += templateSource[i];
                i++;
              }
            }
            attrVal = valBuf;
          } else {
            // Atribut tanpa quotes
            let valBuf = '';
            while (i < len && !/\s|>/.test(templateSource[i]!)) {
              valBuf += templateSource[i];
              i++;
            }
            attrVal = valBuf;
          }
        }

        if (attrName.startsWith('on:')) {
          events.push({
            event: attrName.slice(3),
            handlerCall: attrVal,
          });
        } else {
          attributes[attrName] = attrVal;
        }
      }

      if (VOID_TAGS.has(tagName.toLowerCase())) {
        isSelfClosing = true;
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
        stack.push({ element: newElem, textBuffer: '' });
      }
      continue;
    }

    // 4. Karakter Teks
    const nextTagIndex = templateSource.indexOf('<', i);
    const textChunk =
      nextTagIndex === -1 ? templateSource.slice(i) : templateSource.slice(i, nextTagIndex);
    i = nextTagIndex === -1 ? len : nextTagIndex;

    if (stack.length > 0) {
      stack[stack.length - 1]!.textBuffer += textChunk;
    }
  }

  // Jika setelah selesai masih ada tag yang belum ditutup
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1]!.element;
    throw new Error(`KIL-151: Tag <${unclosed.tag}> tidak ditutup`);
  }

  return rootElements;
}
