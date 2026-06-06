"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { TipoLocal } from "@/schemas/tienda";
import { useAppContext } from "@/context/AppContext";
import { usePermisos } from "@/utils/permisos_front";
import { ONBOARDING_CHAIN_PRIMEROS_PASOS } from "../constants";
import { useEligibleToursForChain } from "../hooks/useEligibleTours";
import {
  selectIsOnboardingBlocking,
  useOnboardingHydrated,
  useOnboardingStore,
} from "../store/onboardingStore";
import { getTourById } from "../tours/primerosPasos";
import { getMenuDataTourForAdvancePath } from "../utils/onboardingNavigation";

const OnboardingJoyride = dynamic(
  () =>
    import("./OnboardingJoyride").then((m) => ({ default: m.OnboardingJoyride })),
  { ssr: false }
);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();
  const { user, loadingContext, isAuth } = useAppContext();
  const { permisos } = usePermisos();
  const eligibleTours = useEligibleToursForChain(ONBOARDING_CHAIN_PRIMEROS_PASOS);
  const hasHydrated = useOnboardingHydrated();

  const startChain = useOnboardingStore((s) => s.startChain);
  const isChainCompleted = useOnboardingStore((s) => s.isChainCompleted);
  const isChainDismissed = useOnboardingStore((s) => s.isChainDismissed);
  const clearActiveSession = useOnboardingStore((s) => s.clearActiveSession);
  const run = useOnboardingStore((s) => s.run);
  const activeUserId = useOnboardingStore((s) => s.activeUserId);

  const userId =
    user?.id ?? (session?.user as { id?: string } | undefined)?.id ?? null;

  // Al cerrar sesión, limpiar tour activo
  useEffect(() => {
    if (sessionStatus === "unauthenticated") {
      clearActiveSession();
    }
  }, [sessionStatus, clearActiveSession]);

  // Si cambia el usuario sin recargar la página, reiniciar sesión activa del tour
  useEffect(() => {
    if (!userId || !activeUserId) return;
    if (activeUserId !== userId) {
      clearActiveSession();
    }
  }, [userId, activeUserId, clearActiveSession]);

  // Auto-inicio tras login
  useEffect(() => {
    if (!hasHydrated) return;
    if (sessionStatus !== "authenticated") return;
    if (loadingContext || !isAuth || !userId) return;
    if (!user?.localActual) return;
    if (user.localActual.tipo !== TipoLocal.TIENDA) return;
    if (isChainCompleted(userId, ONBOARDING_CHAIN_PRIMEROS_PASOS)) return;
    if (isChainDismissed(userId, ONBOARDING_CHAIN_PRIMEROS_PASOS)) return;
    if (eligibleTours.length === 0) return;
    if (run) return;

    startChain(userId, ONBOARDING_CHAIN_PRIMEROS_PASOS, eligibleTours);
  }, [
    hasHydrated,
    sessionStatus,
    loadingContext,
    isAuth,
    userId,
    user?.localActual,
    user?.localActual?.tipo,
    eligibleTours,
    permisos,
    isChainCompleted,
    isChainDismissed,
    startChain,
    run,
  ]);

  return (
    <>
      {children}
      <OnboardingJoyride />
    </>
  );
}

/** Hook para Layout: navegación permitida durante onboarding bloqueante */
export function useOnboardingNavigation() {
  const canNavigateTo = useOnboardingStore((s) => s.canNavigateTo);
  const isBlockingActive = useOnboardingStore(selectIsOnboardingBlocking);
  const activeTourId = useOnboardingStore((s) => s.activeTourId);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);

  const getCurrentStepTarget = (): string | null => {
    if (!activeTourId) return null;
    const tour = getTourById(activeTourId);
    const step = tour?.steps[stepIndex];
    return step?.target ?? null;
  };

  const isTargetAllowed = (dataTourAttr: string | undefined): boolean => {
    if (!isBlockingActive) return true;

    const tour = activeTourId ? getTourById(activeTourId) : undefined;
    const step = tour?.steps[stepIndex];

    if (!dataTourAttr) return false;

    if (step?.advanceOnPathname) {
      const menuAttr = getMenuDataTourForAdvancePath(step.advanceOnPathname);
      if (menuAttr && dataTourAttr === menuAttr) return true;
    }

    const currentTarget = getCurrentStepTarget();
    if (!currentTarget) return false;
    if (currentTarget === "body") {
      return dataTourAttr === "nav-menu-button";
    }
    if (currentTarget.includes("pos-period-confirm")) {
      return dataTourAttr === "pos-period-confirm";
    }
    return currentTarget.includes(dataTourAttr);
  };

  const isMenuItemAllowed = (dataTourAttr: string | undefined) =>
    isTargetAllowed(dataTourAttr);

  const isToolbarTargetAllowed = (dataTourAttr: string | undefined) =>
    isTargetAllowed(dataTourAttr);

  const isDrawerCloseAllowed = (): boolean => {
    if (!isBlockingActive) return true;
    const currentTarget = getCurrentStepTarget();
    if (!currentTarget) return true;
    return !(
      currentTarget.includes("nav-gestion-inventario") ||
      currentTarget.includes("nav-pos")
    );
  };

  return {
    isBlockingActive,
    canNavigateTo,
    isMenuItemAllowed,
    isToolbarTargetAllowed,
    isDrawerCloseAllowed,
  };
}
