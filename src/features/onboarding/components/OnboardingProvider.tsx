"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { TipoLocal } from "@/schemas/tienda";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { getProductosVenta } from "@/services/costoPrecioServices";
import { ONBOARDING_CHAIN_PRIMEROS_PASOS, TOUR_POS_VENTA } from "../constants";
import { useEligibleToursForChain } from "../hooks/useEligibleTours";
import {
  selectIsOnboardingBlocking,
  useOnboardingHydrated,
  useOnboardingStore,
} from "../store/onboardingStore";
import { getMenuDataTourForAdvancePath } from "../utils/onboardingNavigation";
import { normalizeOnboardingSettings } from "../utils/onboardingSettings";

const OnboardingJoyride = dynamic(
  () =>
    import("./OnboardingJoyride").then((m) => ({ default: m.OnboardingJoyride })),
  { ssr: false },
);

const DISMISS_NOTICE =
  "Puedes reiniciar esta guía cuando quieras desde Ayuda → Primeros pasos.";

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const { user, loadingContext, isAuth } = useAppContext();
  const { showMessage } = useMessageContext();
  const eligibleTours = useEligibleToursForChain(ONBOARDING_CHAIN_PRIMEROS_PASOS);
  const hasHydrated = useOnboardingHydrated();

  const startChain = useOnboardingStore((s) => s.startChain);
  const clearActiveSession = useOnboardingStore((s) => s.clearActiveSession);
  const run = useOnboardingStore((s) => s.run);
  const activeUserId = useOnboardingStore((s) => s.activeUserId);
  const activeTourId = useOnboardingStore((s) => s.activeTourId);
  const posTourContext = useOnboardingStore((s) => s.posTourContext);
  const setPosTourContext = useOnboardingStore((s) => s.setPosTourContext);
  const pendingDismissNotice = useOnboardingStore((s) => s.pendingDismissNotice);
  const clearPendingDismissNotice = useOnboardingStore(
    (s) => s.clearPendingDismissNotice,
  );

  const userId =
    user?.id ?? (session?.user as { id?: string } | undefined)?.id ?? null;

  const rawSettings = useOnboardingStore((s) =>
    userId ? s.userProgress[userId]?.settings : undefined,
  );
  const masterEnabled = normalizeOnboardingSettings(rawSettings).enabled;

  useEffect(() => {
    if (sessionStatus === "unauthenticated") clearActiveSession();
  }, [sessionStatus, clearActiveSession]);

  useEffect(() => {
    if (!userId || !activeUserId) return;
    if (activeUserId !== userId) clearActiveSession();
  }, [userId, activeUserId, clearActiveSession]);

  useEffect(() => {
    if (!pendingDismissNotice) return;
    showMessage(DISMISS_NOTICE, "info");
    clearPendingDismissNotice();
  }, [pendingDismissNotice, showMessage, clearPendingDismissNotice]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (sessionStatus !== "authenticated") return;
    if (loadingContext || !isAuth || !userId) return;
    if (!user?.localActual) return;
    if (user.localActual.tipo !== TipoLocal.TIENDA) return;
    if (pathname !== "/home") return;
    if (!masterEnabled) return;
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
    pathname,
    masterEnabled,
    rawSettings,
    eligibleTours,
    startChain,
    run,
  ]);

  useEffect(() => {
    if (!run || activeTourId !== TOUR_POS_VENTA) return;
    if (posTourContext?.loaded) return;

    const tiendaId = user?.localActual?.id;
    if (!tiendaId) return;

    let cancelled = false;

    (async () => {
      try {
        const raw = await getProductosVenta(tiendaId);
        if (cancelled) return;

        const withStock = (raw ?? []).filter(
          (p: { existencia?: number; producto?: { nombre?: string } }) =>
            (p.existencia ?? 0) > 0 && Boolean(p.producto?.nombre?.trim()),
        );

        if (withStock.length === 0) {
          setPosTourContext({
            hasProducts: false,
            sampleProductName: null,
            loaded: true,
          });
          return;
        }

        const pick = withStock[
          Math.floor(Math.random() * withStock.length)
        ] as { producto: { nombre: string } };

        setPosTourContext({
          hasProducts: true,
          sampleProductName: pick.producto.nombre,
          loaded: true,
        });
      } catch {
        if (!cancelled) {
          setPosTourContext({
            hasProducts: false,
            sampleProductName: null,
            loaded: true,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    run,
    activeTourId,
    posTourContext?.loaded,
    user?.localActual?.id,
    setPosTourContext,
  ]);

  return (
    <>
      {children}
      <OnboardingJoyride />
    </>
  );
}

export function useOnboardingNavigation() {
  const canNavigateTo = useOnboardingStore((s) => s.canNavigateTo);
  const isBlockingActive = useOnboardingStore(selectIsOnboardingBlocking);
  const activeStepDefinitions = useOnboardingStore((s) => s.activeStepDefinitions);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);

  const getCurrentStepTarget = (): string | null => {
    const step = activeStepDefinitions[stepIndex];
    return step?.target ?? null;
  };

  const isTargetAllowed = (dataTourAttr: string | undefined): boolean => {
    if (!isBlockingActive) return true;

    const step = activeStepDefinitions[stepIndex];
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

  return {
    isBlockingActive,
    canNavigateTo,
    isMenuItemAllowed: isTargetAllowed,
    isToolbarTargetAllowed: isTargetAllowed,
    isDrawerCloseAllowed: (): boolean => {
      if (!isBlockingActive) return true;
      const currentTarget = getCurrentStepTarget();
      if (!currentTarget) return true;
      return !(
        currentTarget.includes("nav-gestion-inventario") ||
        currentTarget.includes("nav-pos")
      );
    },
  };
}
