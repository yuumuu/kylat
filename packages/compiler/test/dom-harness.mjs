/**
 * Harness DOM minimal untuk menguji kode hasil compiler tanpa jsdom.
 * Bukan implementasi DOM lengkap; hanya API yang dipakai runtime Kylat.
 */

export class FakeNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.childNodes = [];
    this.parentNode = null;
    this._text = '';
  }

  appendChild(node) {
    if (node.nodeType === 11) {
      for (const child of [...node.childNodes]) this.appendChild(child);
      return node;
    }
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this.childNodes.push(node);
    return node;
  }

  insertBefore(node, reference) {
    if (node.nodeType === 11) {
      for (const child of [...node.childNodes]) this.insertBefore(child, reference);
      return node;
    }
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = this.childNodes.indexOf(reference);
    if (index < 0) this.childNodes.push(node);
    else this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  removeChild(node) {
    const index = this.childNodes.indexOf(node);
    if (index >= 0) this.childNodes.splice(index, 1);
    node.parentNode = null;
    return node;
  }

  get textContent() {
    if (this.nodeType === 3 || this.nodeType === 8) return this._text;
    if (this.childNodes.length === 0) return this._text;
    return this.childNodes.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._text = String(value);
    if (this.nodeType === 1) {
      for (const child of this.childNodes) child.parentNode = null;
      this.childNodes = [];
    }
  }
}

export class FakeElement extends FakeNode {
  constructor(tagName) {
    super(1);
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = { add() {}, remove() {} };
    this.style = { setProperty() {}, removeProperty() {} };
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    const handlers = this.listeners.get(event) ?? [];
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  }

  dispatch(event, payload = {}) {
    for (const handler of this.listeners.get(event) ?? []) handler(payload);
  }

  click() {
    this.dispatch('click');
  }
}

export function createDocument() {
  return {
    createElement: (tag) => new FakeElement(tag),
    createTextNode: (value) => {
      const node = new FakeNode(3);
      node._text = String(value);
      return node;
    },
    createComment: (value) => {
      const node = new FakeNode(8);
      node._text = String(value);
      return node;
    },
    createDocumentFragment: () => new FakeNode(11),
    querySelector: () => null,
    cookie: '',
  };
}

export function findAll(root, tagName) {
  const wanted = tagName.toUpperCase();
  const result = [];
  const walk = (node) => {
    if (node.tagName === wanted) result.push(node);
    for (const child of node.childNodes ?? []) walk(child);
  };
  walk(root);
  return result;
}

export function findOne(root, tagName) {
  return findAll(root, tagName)[0];
}
