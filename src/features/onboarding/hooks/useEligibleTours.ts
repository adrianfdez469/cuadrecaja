"use client";

import { useMemo } from "react";
import { usePermisos } from "@/utils/permisos_front";
import { ONBOARDING_CHAINS, ONBOARDING_TOURS } from "../tours/primerosPasos";
import type { OnboardingChainId, OnboardingTourId } from "../types";

export function useEligibleToursForChain(chainId: OnboardingChainId): OnboardingTourId[] {
  const { verificarPermiso, permisos } = usePermisos();

  return useMemo(() => {
    const chain = ONBOARDING_CHAINS.find((c) => c.id === chainId);
    if (!chain) return [];

    return chain.tourIds.filter((tourId) => {
      const tour = ONBOARDING_TOURS.find((t) => t.id === tourId);
      return tour ? verificarPermiso(tour.permission) : false;
    });
  }, [chainId, permisos, verificarPermiso]);
}
