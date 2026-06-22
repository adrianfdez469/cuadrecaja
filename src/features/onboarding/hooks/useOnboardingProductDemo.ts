"use client";

import { TOUR_GESTION_INVENTARIO } from "../constants";
import {
  selectIsOnboardingBlocking,
  useOnboardingStore,
} from "../store/onboardingStore";

/** Tour bloqueante de alta de producto en gestión unificada */
export function useOnboardingProductDemo(): boolean {
  const run = useOnboardingStore((s) => s.run);
  const isBlocking = useOnboardingStore(selectIsOnboardingBlocking);
  const activeTourId = useOnboardingStore((s) => s.activeTourId);

  return Boolean(
    run && isBlocking && activeTourId === TOUR_GESTION_INVENTARIO
  );
}
