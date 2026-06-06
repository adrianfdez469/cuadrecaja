"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Joyride, ACTIONS, EVENTS, STATUS } from "react-joyride";
import { usePathname } from "next/navigation";
import { useMediaQuery, useTheme } from "@mui/material";
import { usePermisos } from "@/utils/permisos_front";
import { useAppContext } from "@/context/AppContext";
import { fetchLastPeriod } from "@/services/cierrePeriodService";
import { ONBOARDING_PROMPT_POS_PERIOD_EVENT } from "../constants";
import { buildJoyrideSteps } from "../utils/buildJoyrideSteps";
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
  const advanceStep = useOnboardingStore((s) => s.advanceStep);
  const setStepIndex = useOnboardingStore((s) => s.setStepIndex);
  const bumpLayoutNonce = useOnboardingStore((s) => s.bumpLayoutNonce);
  const completeActiveTour = useOnboardingStore((s) => s.completeActiveTour);

  const tour = activeTourId ? getTourById(activeTourId) : undefined;
  const stepDef = tour?.steps[stepIndex];

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
      tour
        ? buildJoyrideSteps(tour.steps, isMobile, { productTablePrimaryLabel })
        : [],
    [tour, isMobile, productTablePrimaryLabel]
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
    let attempts = 0;
    const maxAttempts = stepDef.hideOverlay ? 80 : 50;

    const check = () => {
      const el = document.querySelector(stepDef.target);
      const visible =
        el &&
        (stepDef.hideOverlay ||
          (el as HTMLElement).getBoundingClientRect().width > 0);
      if (visible) {
        setTargetReady(true);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        timer = window.setTimeout(check, 150);
      }
    };

    let timer = window.setTimeout(check, stepDef.hideOverlay ? 200 : 100);
    return () => window.clearTimeout(timer);
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

  if (!run || !tour || steps.length === 0) {
    return null;
  }

  const isBodyStep = stepDef?.target === "body";
  const shouldRunJoyride = isBodyStep || targetReady;

  return (
    <Joyride
      key={`${activeTourId}-${stepIndex}-${layoutNonce}-${isMobile}`}
      steps={steps}
      run={shouldRunJoyride}
      stepIndex={stepIndex}
      continuous
      scrollToFirstStep={!isMobile}
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
