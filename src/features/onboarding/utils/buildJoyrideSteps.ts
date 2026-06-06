import type { Step } from "react-joyride";
import type { OnboardingStepDefinition } from "../types";

export interface BuildJoyrideStepsOptions {
  /** Etiqueta del botón en el paso final de creación de producto */
  productTablePrimaryLabel?: string;
}

function isPosFloatingTourTarget(target: string): boolean {
  return (
    target.includes("pos-search") || target.includes("pos-category-first")
  );
}

function hasPrimaryButton(def: OnboardingStepDefinition): boolean {
  return Boolean(
    def.showStartButton || def.showNextButton || def.primaryButtonLabel
  );
}

export function buildJoyrideSteps(
  definitions: OnboardingStepDefinition[],
  isMobile: boolean,
  options?: BuildJoyrideStepsOptions
): Step[] {
  return definitions.map((def, index) => {
    const isPosFloating = isPosFloatingTourTarget(def.target);
    const showBack =
      index > 0 &&
      Boolean(def.showNextButton || def.showStartButton || def.primaryButtonLabel);

    let placement =
      def.placement === "right" && isMobile ? "bottom" : (def.placement ?? "bottom");

    // Popper/Dialog en móvil: tooltip centrado evita recortes y spotlight desalineado
    if (isMobile && isPosFloating) {
      placement = "center";
    }

    return {
      target: def.target,
      title: def.title,
      content: def.content,
      placement,
      ...(isMobile && isPosFloating
        ? {
            floaterProps: {
              options: {
                preventOverflow: {
                  altAxis: true,
                  padding: 12,
                },
              },
            },
          }
        : {}),
      skipBeacon: true,
      buttons: hasPrimaryButton(def)
        ? showBack
          ? (["back", "primary", "close"] as const)
          : (["primary", "close"] as const)
        : (["close"] as const),
      hideFooter: hasPrimaryButton(def) ? false : (def.hideFooter ?? true),
      blockTargetInteraction: !(def.spotlightClicks ?? false),
      overlayClickAction: false,
      dismissKeyAction: "close" as const,
      hideOverlay: def.hideOverlay ?? false,
      isFixed: def.isFixed ?? def.hideOverlay ?? false,
      locale: (() => {
        if (def.primaryButtonLabel) {
          return { next: def.primaryButtonLabel, last: def.primaryButtonLabel };
        }
        if (def.target.includes("gi-product-table")) {
          const label =
            options?.productTablePrimaryLabel ?? "Continuar";
          return { next: label, last: label };
        }
        if (def.showStartButton) {
          return { next: "Comenzar", last: "Comenzar" };
        }
        if (def.showNextButton) {
          return { next: "Siguiente", last: "Siguiente" };
        }
        return undefined;
      })(),
    };
  });
}
