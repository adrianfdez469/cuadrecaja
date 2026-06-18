export const HARDWARE_SCAN_IDLE_MS = 100;

export function isEditableTarget(target: EventTarget | null): boolean {
  const el =
    target instanceof HTMLElement
      ? target.closest('input, textarea, select, [contenteditable="true"]')
      : null;

  if (!el) return false;

  // Input con foco residual detrás de un modal/drawer (aria-hidden) no debe bloquear la pistola
  if (el.closest('[aria-hidden="true"]')) return false;

  if (el instanceof HTMLInputElement && (el.readOnly || el.disabled)) return false;
  if (el instanceof HTMLTextAreaElement && (el.readOnly || el.disabled)) return false;
  if (el instanceof HTMLSelectElement && el.disabled) return false;

  return true;
}

export function shouldAcceptScanKey(key: string): boolean {
  return key.length === 1;
}
