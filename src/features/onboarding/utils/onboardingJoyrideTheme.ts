import type { Theme } from "@mui/material/styles";
import type { Styles } from "react-joyride";
import { ONBOARDING_JOYRIDE_Z_INDEX } from "../constants";

/** Opciones de Joyride derivadas del tema MUI */
export function getOnboardingJoyrideOptions(
  theme: Theme,
  showPrimaryButton: boolean,
  isMobile = false,
  showBackButton = false
) {
  return {
    overlayClickAction: false as const,
    dismissKeyAction: "close" as const,
    skipBeacon: true,
    showProgress: false,
    targetWaitTimeout: 8000,
    scrollDuration: isMobile ? 0 : 300,
    zIndex: ONBOARDING_JOYRIDE_Z_INDEX,
    width: "min(380px, calc(100vw - 32px))",
    primaryColor: theme.palette.primary.main,
    backgroundColor: theme.palette.background.paper,
    textColor: theme.palette.text.primary,
    arrowColor: theme.palette.background.paper,
    arrowSize: 12,
    spotlightPadding: 10,
    spotlightRadius: 10,
    overlayColor: "rgba(15, 23, 42, 0.58)",
    buttons: showPrimaryButton
      ? showBackButton
        ? (["back", "primary", "close"] as ("back" | "close" | "primary" | "skip")[])
        : (["primary", "close"] as ("back" | "close" | "primary" | "skip")[])
      : (["close"] as ("back" | "close" | "primary" | "skip")[]),
  };
}

/** Estilos base del contenedor Joyride (el contenido lo pinta OnboardingTooltip) */
export function getOnboardingJoyrideStyles(_theme: Theme): Partial<Styles> {
  const z = ONBOARDING_JOYRIDE_Z_INDEX;
  return {
    options: {
      zIndex: z,
    },
    overlay: {
      backgroundColor: "rgba(15, 23, 42, 0.58)",
      zIndex: z,
    },
    spotlight: {
      zIndex: z - 1,
    },
    beacon: {
      zIndex: z + 1,
    },
    tooltip: {
      padding: 0,
      backgroundColor: "transparent",
      borderRadius: 12,
      boxShadow: "none",
      zIndex: z + 2,
    },
    floater: {
      filter: "none",
      zIndex: z + 2,
    },
    tooltipContainer: {
      padding: 0,
      textAlign: "left",
    },
    tooltipTitle: {
      display: "none",
    },
    tooltipContent: {
      display: "none",
    },
    tooltipFooter: {
      display: "none",
    },
    buttonPrimary: {
      display: "none",
    },
  } as Partial<Styles>;
}
