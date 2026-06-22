import { TOUR_POS_VENTA } from "../constants";
import { getTourById } from "../tours/primerosPasos";
import { useOnboardingStore } from "../store/onboardingStore";

interface IPeriodoLike {
  fechaFin?: string | Date | null;
}

function getPosPeriodStepIndex(): number {
  const tour = getTourById(TOUR_POS_VENTA);
  if (!tour) return -1;
  return tour.steps.findIndex((s) => s.onlyWhenNoOpenPeriod);
}

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

function hasOpenPeriod(periodo?: IPeriodoLike | null): boolean {
  return Boolean(periodo && !periodo.fechaFin);
}

/**
 * Durante el tour POS, aplaza sync automática y toasts operativos hasta que
 * el período esté abierto y se haya superado el paso de apertura.
 */
export function shouldDeferPosBackgroundOperations(
  periodo?: IPeriodoLike | null,
): boolean {
  const state = useOnboardingStore.getState();
  if (!state.run || state.activeTourId !== TOUR_POS_VENTA) return false;

  const periodStepIndex = getPosPeriodStepIndex();
  if (periodStepIndex < 0) return false;

  if (state.stepIndex < periodStepIndex) return true;
  if (state.stepIndex === periodStepIndex && !hasOpenPeriod(periodo)) {
    return true;
  }

  return false;
}

/** Durante el tour POS, el aviso de período lo muestra el paso intermedio (no al cargar) */
export function shouldDeferPosPeriodPrompt(): boolean {
  return shouldDeferPosBackgroundOperations(null);
}
