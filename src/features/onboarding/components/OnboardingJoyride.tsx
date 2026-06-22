"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Joyride, ACTIONS, EVENTS, STATUS } from "react-joyride";
import { usePathname } from "next/navigation";
import { useMediaQuery, useTheme } from "@mui/material";
import { usePermisos } from "@/utils/permisos_front";
import { useAppContext } from "@/context/AppContext";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { ONBOARDING_PROMPT_POS_PERIOD_EVENT, TOUR_POS_VENTA } from "../constants";
import { buildJoyrideSteps } from "../utils/buildJoyrideSteps";
import { usesFixedMobileTooltip } from "../utils/onboardingMobileTooltip";
import { isPosTopToolbarTourTarget } from "../utils/onboardingNavigation";
import {
  getOnboardingJoyrideOptions,
  getOnboardingJoyrideStyles,
} from "../utils/onboardingJoyrideTheme";
import { getTourById } from "../tours/primerosPasos";
import { exitOnboardingTour, useOnboardingStore } from "../store/onboardingStore";
import { OnboardingTooltip } from "./OnboardingTooltip";

const joyrideLocale = {
  back: "Atrás",
  close: "Cerrar",
  last: "Finalizar",
  next: "Siguiente",
  open: "Abrir",
  skip: "Omitir",
};

export function OnboardingJoyride() {
  const theme = useTheme();
  const { user } = useAppContext();
  const { verificarPermiso } = usePermisos();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const tienePos = verificarPermiso("operaciones.pos-venta.acceder");
  const pathname = usePathname();
  const [targetReady, setTargetReady] = useState(false);
  const periodPromptStepRef = useRef<number | null>(null);

  const run = useOnboardingStore((s) => s.run);
  const activeTourId = useOnboardingStore((s) => s.activeTourId);
  const stepIndex = useOnboardingStore((s) => s.stepIndex);
  const layoutNonce = useOnboardingStore((s) => s.layoutNonce);
  const activeStepDefinitions = useOnboardingStore((s) => s.activeStepDefinitions);
  const posTourContext = useOnboardingStore((s) => s.posTourContext);
  const advanceStep = useOnboardingStore((s) => s.advanceStep);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);
  const bumpLayoutNonce = useOnboardingStore((s) => s.bumpLayoutNonce);
  const completeActiveTour = useOnboardingStore((s) => s.completeActiveTour);

  const tour = activeTourId ? getTourById(activeTourId) : undefined;
  const stepDef = activeStepDefinitions[stepIndex];
  const posTourWaiting =
    activeTourId === TOUR_POS_VENTA && !posTourContext?.loaded;

  const showBackButton = Boolean(
    stepIndex > 0 &&
      (stepDef?.showNextButton ||
        stepDef?.showStartButton ||
        stepDef?.primaryButtonLabel)
  );

  const productTablePrimaryLabel = tienePos
    ? "Continuar al punto de venta"
    : "Entendido";

  const steps = useMemo(
    () =>
      activeStepDefinitions.length > 0
        ? buildJoyrideSteps(activeStepDefinitions, isMobile, {
            productTablePrimaryLabel,
          })
        : [],
    [activeStepDefinitions, isMobile, productTablePrimaryLabel],
  );

  const stepLocale = useMemo(() => {
    if (stepDef?.showStartButton) {
      return { ...joyrideLocale, next: "Comenzar", last: "Comenzar" };
    }
    if (stepDef?.primaryButtonLabel) {
      return {
        ...joyrideLocale,
        next: stepDef.primaryButtonLabel,
        last: stepDef.primaryButtonLabel,
      };
    }
    if (stepDef?.showNextButton) {
      return { ...joyrideLocale, next: "Siguiente", last: "Siguiente" };
    }
    return joyrideLocale;
  }, [stepDef?.showStartButton, stepDef?.primaryButtonLabel, stepDef?.showNextButton]);

  const joyrideOptions = useMemo(
    () =>
      getOnboardingJoyrideOptions(
        theme,
        Boolean(
          stepDef?.showStartButton ||
            stepDef?.showNextButton ||
            stepDef?.primaryButtonLabel
        ),
        isMobile,
        showBackButton
      ),
    [
      theme,
      stepDef?.showStartButton,
      stepDef?.showNextButton,
      stepDef?.primaryButtonLabel,
      isMobile,
      showBackButton,
    ]
  );

  const joyrideStyles = useMemo(
    () => getOnboardingJoyrideStyles(theme),
    [theme]
  );

  useEffect(() => {
    if (!run) return;
    const id = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(id);
  }, [layoutNonce, stepIndex, run, isMobile]);

  useEffect(() => {
    if (!run || !stepDef) {
      setTargetReady(false);
      return;
    }

    if (stepDef.target === "body") {
      setTargetReady(true);
      return;
    }

    setTargetReady(false);

    // El spotlight de react-joyride solo recalcula su recorte ante scroll/resize/
    // ResizeObserver del propio target, no ante movimientos provocados por
    // transiciones de ancestros (Drawer, Dialog, Accordion) ni navegación.
    // Por eso esperamos a que el rect del objetivo deje de cambiar durante varios
    // frames antes de mostrar el paso: así Joyride mide la posición ya estable.
    const selector = stepDef.target;
    const allowZeroSize = Boolean(stepDef.hideOverlay);
    const maxWaitMs = stepDef.hideOverlay ? 8000 : 6000;
    const requiredStableFrames = 3;
    const initialDelayMs = stepDef.hideOverlay ? 150 : 60;

    let cancelled = false;
    let rafId = 0;
    let timerId = 0;
    const startedAt =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    let lastRect: DOMRect | null = null;
    let stableFrames = 0;

    const now = () =>
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const sameRect = (a: DOMRect | null, b: DOMRect | null) =>
      Boolean(
        a &&
          b &&
          Math.abs(a.top - b.top) < 0.5 &&
          Math.abs(a.left - b.left) < 0.5 &&
          Math.abs(a.width - b.width) < 0.5 &&
          Math.abs(a.height - b.height) < 0.5,
      );

    const reveal = () => {
      if (cancelled) return;
      setTargetReady(true);
      // Un último nudge para que el overlay recompute con la posición final.
      window.requestAnimationFrame(() => {
        if (!cancelled) window.dispatchEvent(new Event("resize"));
      });
    };

    const tick = () => {
      if (cancelled) return;
      const elapsed = now() - startedAt;
      const el = document.querySelector(selector) as HTMLElement | null;

      if (!el) {
        if (elapsed > maxWaitMs) return; // objetivo inexistente: no mostramos
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      const rect = el.getBoundingClientRect();
      const measurable = allowZeroSize || (rect.width > 0 && rect.height > 0);

      if (!measurable) {
        if (elapsed > maxWaitMs) return;
        rafId = window.requestAnimationFrame(tick);
        return;
      }

      if (sameRect(rect, lastRect)) {
        stableFrames += 1;
      } else {
        stableFrames = 0;
        lastRect = rect;
      }

      if (stableFrames >= requiredStableFrames || elapsed > maxWaitMs) {
        reveal();
        return;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    timerId = window.setTimeout(() => {
      rafId = window.requestAnimationFrame(tick);
    }, initialDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timerId);
      window.cancelAnimationFrame(rafId);
    };
  }, [run, stepDef, pathname, stepIndex, layoutNonce]);

  useEffect(() => {
    if (!run || !stepDef?.advanceOnPathname) return;
    if (pathname.startsWith(stepDef.advanceOnPathname)) {
      const t = window.setTimeout(() => advanceStep(), 400);
      return () => window.clearTimeout(t);
    }
  }, [pathname, run, stepDef, advanceStep]);

  useEffect(() => {
    if (!run || !stepDef?.onlyWhenNoOpenPeriod) return;
    if (!pathname.startsWith("/pos")) return;
    const tiendaId = user?.localActual?.id;
    if (!tiendaId) return;

    if (periodPromptStepRef.current !== stepIndex) {
      periodPromptStepRef.current = null;
    }

    let cancelled = false;

    const runPeriodStep = async () => {
      try {
        const lastPeriod = await fetchLastPeriod(tiendaId);
        if (cancelled) return;

        if (lastPeriod && !lastPeriod.fechaFin) {
          advanceStep();
          return;
        }

        if (periodPromptStepRef.current === stepIndex) return;
        periodPromptStepRef.current = stepIndex;
        window.dispatchEvent(new Event(ONBOARDING_PROMPT_POS_PERIOD_EVENT));
      } catch {
        if (!cancelled) {
          periodPromptStepRef.current = stepIndex;
          window.dispatchEvent(new Event(ONBOARDING_PROMPT_POS_PERIOD_EVENT));
        }
      }
    };

    const t = window.setTimeout(() => {
      void runPeriodStep();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [
    run,
    stepDef,
    pathname,
    stepIndex,
    user?.localActual?.id,
    advanceStep,
  ]);

  if (!run || !tour || steps.length === 0 || posTourWaiting) {
    return null;
  }

  const isBodyStep = stepDef?.target === "body";
  const stepTarget =
    typeof stepDef?.target === "string" ? stepDef.target : "";
  const isFixedMobileStep = Boolean(
    stepTarget && usesFixedMobileTooltip(stepTarget),
  );
  const useJoyrideAutoScroll =
    !isMobile ||
    (isFixedMobileStep && !isPosTopToolbarTourTarget(stepTarget));
  const shouldRunJoyride = isBodyStep || targetReady;

  return (
    <Joyride
      key={`${activeTourId}-${stepIndex}-${isMobile}`}
      steps={steps}
      run={shouldRunJoyride}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep={useJoyrideAutoScroll}
      locale={stepLocale}
      options={joyrideOptions}
      styles={joyrideStyles}
      tooltipComponent={OnboardingTooltip}
      onEvent={(data) => {
        if (data.type === EVENTS.STEP_AFTER && data.action === ACTIONS.PREV) {
          setStepIndex(Math.max(0, stepIndex - 1));
          bumpLayoutNonce();
          return;
        }

        if (
          data.type === EVENTS.STEP_AFTER &&
          data.action === ACTIONS.NEXT
        ) {
          advanceStep();
          return;
        }

        if (data.type === EVENTS.TOUR_END) {
          const closedByUser =
            data.status === STATUS.SKIPPED || data.action === ACTIONS.CLOSE;

          if (closedByUser) {
            exitOnboardingTour();
            return;
          }

          if (data.status === STATUS.FINISHED) {
            completeActiveTour();
          }
        }
      }}
    />
  );
}
