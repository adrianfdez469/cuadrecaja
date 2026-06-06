import { TOUR_POS_VENTA } from "../constants";
import { getTourById } from "../tours/primerosPasos";
import { useOnboardingStore } from "../store/onboardingStore";

function getActivePosStep() {
  const state = useOnboardingStore.getState();
  if (!state.run || state.activeTourId !== TOUR_POS_VENTA) return null;
  const tour = getTourById(TOUR_POS_VENTA);
  return tour?.steps[state.stepIndex] ?? null;
}

/** Tour POS activo en el paso de apertura de período */
export function isPosOnboardingPeriodStep(): boolean {
  const step = getActivePosStep();
  return Boolean(step?.onlyWhenNoOpenPeriod);
}

/** Bloquea clics en el POS salvo en pasos que requieren acción en el objetivo */
export function shouldBlockPosInteraction(): boolean {
  const step = getActivePosStep();
  if (!step) return false;
  return !(step.spotlightClicks ?? false);
}

/** Durante el tour POS, el aviso de período lo muestra el paso intermedio (no al cargar) */
export function shouldDeferPosPeriodPrompt(): boolean {
  const state = useOnboardingStore.getState();
  if (!state.run || state.activeTourId !== TOUR_POS_VENTA) return false;

  const tour = getTourById(TOUR_POS_VENTA);
  if (!tour) return false;

  const periodStepIndex = tour.steps.findIndex((s) => s.onlyWhenNoOpenPeriod);
  if (periodStepIndex < 0) return false;

  return state.stepIndex < periodStepIndex;
}
