type Attrs = Record<string, string | boolean | (() => void)>;
type Child = Node | string | undefined | false;

/** Tiny element builder: `el('button.primary', { onclick }, 'Label')`. Buttons default to type button. */
export function el<T extends HTMLElement = HTMLElement>(
  spec: string,
  attrs: Attrs = {},
  ...children: Child[]
): T {
  const [tag = 'div', ...classes] = spec.split('.');
  const node = document.createElement(tag);
  if (classes.length) node.className = classes.join(' ');
  if (tag === 'button') node.setAttribute('type', 'button');
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === 'function') node.addEventListener(key.replace(/^on/, ''), value);
    else if (typeof value === 'boolean') node.toggleAttribute(key, value);
    else node.setAttribute(key, value);
  }
  for (const child of children) {
    if (child === undefined || child === false) continue;
    node.append(child);
  }
  return node as T;
}

export function clear(node: HTMLElement): void {
  node.replaceChildren();
}

/** Whole numbers with thousands grouping, for money and counts alike. */
export const num = (n: number): string => (Math.round(n) || 0).toLocaleString('en-GB');
