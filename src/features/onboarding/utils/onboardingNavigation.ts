/** Atributo data-tour del ítem de menú asociado a una ruta de avance del tour */
export function getMenuDataTourForAdvancePath(
  path: string,
): string | undefined {
  if (path.startsWith("/pos")) return "nav-pos";
  if (path.startsWith("/inventario")) {
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
        // Instantáneo: el detector de estabilidad de OnboardingJoyride muestra el
        // paso cuando el target deja de moverse. Un scroll suave alargaría ese
        // movimiento y haría que el spotlight se midiera a mitad de animación.
        behavior: "auto",
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
    target.includes("nav-gestion-inventario") || target.includes("nav-pos")
  );
}

/** Barra superior del POS (período → conexión), excluye escáner en barra inferior */
export function isPosTopToolbarTourTarget(target: string): boolean {
  return (
    target.includes("pos-toolbar-") && !target.includes("pos-toolbar-scanner")
  );
}

const POS_TOUR_SCROLL_SETTLE_MS = 360;

/**
 * Desplaza el contenedor scroll del POS para que el objetivo del tour quede visible
 * bajo la barra global de la app (evita scrollIntoView del documento).
 */
export function scrollPosTourTargetIntoView(
  scrollContainer: HTMLElement | null,
  targetSelector: string,
  onDone?: () => void,
): void {
  if (!scrollContainer) {
    onDone?.();
    return;
  }

  window.setTimeout(() => {
    if (isPosTopToolbarTourTarget(targetSelector)) {
      scrollContainer.scrollTo({ top: 0, behavior: "auto" });
    } else {
      const el = document.querySelector(targetSelector);
      if (el instanceof HTMLElement) {
        const containerTop = scrollContainer.getBoundingClientRect().top;
        const elTop = el.getBoundingClientRect().top;
        const nextTop = elTop - containerTop + scrollContainer.scrollTop - 12;
        scrollContainer.scrollTo({
          top: Math.max(0, nextTop),
          behavior: "auto",
        });
      }
    }

    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        onDone?.();
      });
    }, POS_TOUR_SCROLL_SETTLE_MS);
  }, 120);
}

export { NAV_DRAWER_TARGET_SELECTORS };
