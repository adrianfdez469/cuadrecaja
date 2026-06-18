import type {
  IPosTourContext,
  OnboardingStepDefinition,
  OnboardingTourDefinition,
} from "../types";
import { TOUR_POS_VENTA } from "../constants";

function resolvePosStepContent(
  step: OnboardingStepDefinition,
  ctx: IPosTourContext,
): OnboardingStepDefinition {
  const name = ctx.sampleProductName ?? "un producto de tu tienda";

  switch (step.posContentKey) {
    case "search-guide":
      return {
        ...step,
        content: `En la barra inferior puedes buscar productos por nombre. Escribe en el campo de búsqueda (por ejemplo «${name}») y selecciona un resultado para añadirlo al carrito. También puedes escanear códigos QR o de barras con el botón de la cámara. No necesitas probarlo ahora: al completar la guía podrás usar el POS con total libertad.`,
      };
    case "no-products-block":
      return {
        ...step,
        content:
          "No hay productos con stock disponible para vender en esta tienda. Añade productos desde Gestión de inventario (o pide a un administrador) y vuelve a activar esta guía en Ayuda.",
      };
    default:
      return step;
  }
}

export function resolveTourSteps(
  tour: OnboardingTourDefinition,
  posContext: IPosTourContext | null,
): OnboardingStepDefinition[] {
  if (tour.id !== TOUR_POS_VENTA) {
    return tour.steps;
  }

  const ctx: IPosTourContext = posContext ?? {
    hasProducts: true,
    sampleProductName: null,
    loaded: false,
  };

  const baseSteps = tour.steps.filter((s) => !s.posBranch);

  if (!ctx.loaded) {
    return baseSteps;
  }

  if (!ctx.hasProducts) {
    return [
      ...baseSteps,
      ...tour.steps
        .filter((s) => s.posBranch === "no-products")
        .map((s) => resolvePosStepContent(s, ctx)),
    ];
  }

  return [
    ...baseSteps,
    ...tour.steps
      .filter((s) => s.posBranch === "with-products")
      .map((s) => resolvePosStepContent(s, ctx)),
  ];
}
