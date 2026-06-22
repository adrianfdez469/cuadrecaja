/** Pasos del tour en móvil cuyo tooltip se desacopla del target (portal fijo) */
export type MobileFixedTooltipPlacement = "top" | "bottom";

const NAV_DRAWER_TARGETS = ["nav-gestion-inventario", "nav-pos"] as const;
const POS_TOOLBAR_PREFIX = "pos-toolbar-";
/** Elementos anclados al borde inferior del POS (buscador, QR) */
const POS_BOTTOM_ANCHORED_TARGETS = ["pos-toolbar-scanner", "pos-search"] as const;

export function getMobileFixedTooltipPlacement(
  target: string,
): MobileFixedTooltipPlacement | null {
  if (NAV_DRAWER_TARGETS.some((key) => target.includes(key))) {
    return "bottom";
  }
  if (POS_BOTTOM_ANCHORED_TARGETS.some((key) => target.includes(key))) {
    return "top";
  }
  if (target.includes(POS_TOOLBAR_PREFIX)) {
    return "bottom";
  }
  return null;
}

export function usesFixedMobileTooltip(target: string): boolean {
  return getMobileFixedTooltipPlacement(target) !== null;
}

export const MOBILE_FIXED_TOOLTIP_TOP =
  "calc(56px + env(safe-area-inset-top, 0px) + 8px)";

export const MOBILE_FIXED_TOOLTIP_BOTTOM =
  "calc(16px + env(safe-area-inset-bottom, 0px))";

/** Oculta el floater de Joyride: el tooltip real se renderiza por portal */
export function getMobileFixedTooltipStepConfig(
  placement: MobileFixedTooltipPlacement,
) {
  return {
    placement: placement === "top" ? ("bottom" as const) : ("top" as const),
    floaterProps: {
      hideArrow: true,
      options: {
        preventOverflow: { enabled: false },
        flip: { enabled: false },
      },
    },
    styles: {
      floater: {
        pointerEvents: "none" as const,
        opacity: 0,
        width: 1,
        height: 1,
        overflow: "hidden" as const,
      },
    },
  };
}
