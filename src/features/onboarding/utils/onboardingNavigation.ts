/** Atributo data-tour del ítem de menú asociado a una ruta de avance del tour */
export function getMenuDataTourForAdvancePath(path: string): string | undefined {
  if (path.startsWith("/pos")) return "nav-pos";
  if (path.startsWith("/configuracion/gestion-inventario")) {
    return "nav-gestion-inventario";
  }
  return undefined;
}

const NAV_DRAWER_TARGET_SELECTORS = {
  gestionInventario: '[data-tour="nav-gestion-inventario"]',
  pos: '[data-tour="nav-pos"]',
} as const;

/** Tiempo para que el acordeón del drawer termine de expandirse (ms) */
const NAV_DRAWER_SCROLL_DELAY_MS = 520;

/** Desplaza un ítem del menú lateral al centro del área visible (encima del stepper inferior) */
export function scrollNavDrawerTargetIntoView(
  selector: string,
  onDone?: () => void,
): void {
  window.setTimeout(() => {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      el.scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      });
    }
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      onDone?.();
    });
  }, NAV_DRAWER_SCROLL_DELAY_MS);
}

export function isNavDrawerTourSelector(target: string): boolean {
  return (
    target.includes("nav-gestion-inventario") ||
    target.includes("nav-pos")
  );
}

export { NAV_DRAWER_TARGET_SELECTORS };
