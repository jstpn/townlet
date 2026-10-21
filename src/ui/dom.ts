type Attrs = Record<string, string | boolean | (() => void)>;
type Child = Node | string | undefined | false;

/** Tiny element builder: `el('button.primary', { onclick }, 'Label')`. */
export function el(spec: string, attrs: Attrs = {}, ...children: Child[]): HTMLElement {
  const [tag = 'div', ...classes] = spec.split('.');
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') node.addEventListener(key.replace(/^on/, ''), value);
    else if (typeof value === 'boolean') node.toggleAttribute(key, value);
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

export function input(className: string, attrs: Attrs): HTMLInputElement {
  const node = document.createElement('input');
  node.className = className;
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'string') node.setAttribute(key, value);
  }
  return node;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

export const money = (n: number): string =>
  `${n < 0 ? '-' : ''}${Math.abs(Math.round(n)).toLocaleString('en-GB')}`;
