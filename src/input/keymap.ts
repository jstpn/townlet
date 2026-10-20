/** Binds single-press actions to keys. Held-key movement lives in CameraControls. */
export function bindKeys(bindings: Record<string, () => void>): () => void {
  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.repeat || e.metaKey || e.ctrlKey) return;
    const action = bindings[e.key.toLowerCase()] ?? bindings[e.key];
    if (action) {
      action();
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
