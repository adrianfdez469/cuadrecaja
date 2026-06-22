import type { Step } from "react-joyride";
import type { OnboardingStepDefinition } from "../types";
import {
  getMobileFixedTooltipPlacement,
  getMobileFixedTooltipStepConfig,
  usesFixedMobileTooltip,
} from "./onboardingMobileTooltip";
import { isPosTopToolbarTourTarget } from "./onboardingNavigation";

export interface BuildJoyrideStepsOptions {
  /** Etiqueta del botón en el paso final de creación de producto */
  productTablePrimaryLabel?: string;
}

function isPosFloatingTourTarget(target: string): boolean {
  return target.includes("pos-category-first");
}

/**
 * En móvil, el desplazamiento de estos pasos lo gestiona el contenedor del POS
 * o del drawer. Dejamos que react-joyride NO haga scroll de la ventana, porque
 * coloca el objetivo bajo la barra superior fija y reposiciona el layout al
 * avanzar de paso.
 */
function shouldSkipJoyrideScroll(target: string, isMobile: boolean): boolean {
  if (!isMobile) return false;
  if (isPosTopToolbarTourTarget(target)) return true;
  if (target.includes("pos-category-first")) return true;
  // Pasos con tooltip fijo (drawer, buscador, escáner) gestionan su propia vista
  return usesFixedMobileTooltip(target);
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
    const mobileFixedPlacement = isMobile
      ? getMobileFixedTooltipPlacement(def.target)
      : null;
    const showBack =
      index > 0 &&
      Boolean(def.showNextButton || def.showStartButton || def.primaryButtonLabel);

    let placement =
      def.placement === "right" && isMobile ? "bottom" : (def.placement ?? "bottom");

    if (isMobile && isPosFloating) {
      placement = "center";
    }

    const mobilePosFloaterProps =
      isMobile && isPosFloating
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
        : {};

    const mobileFixedConfig = mobileFixedPlacement
      ? getMobileFixedTooltipStepConfig(mobileFixedPlacement)
      : null;

    return {
      target: def.target,
      title: def.title,
      content: def.content,
      placement: mobileFixedConfig?.placement ?? placement,
      ...(mobileFixedConfig ?? mobilePosFloaterProps),
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
      skipScroll: shouldSkipJoyrideScroll(def.target, isMobile),
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
