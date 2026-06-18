"use client";

import CloseIcon from "@mui/icons-material/Close";
import { Box, Button, Chip, IconButton, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { TooltipRenderProps } from "react-joyride";
import { ONBOARDING_JOYRIDE_Z_INDEX } from "../constants";
import { exitOnboardingTour } from "../store/onboardingStore";
import {
  getMobileFixedTooltipPlacement,
  MOBILE_FIXED_TOOLTIP_BOTTOM,
  MOBILE_FIXED_TOOLTIP_TOP,
} from "../utils/onboardingMobileTooltip";

/**
 * Tooltip del tour alineado al diseño MUI de Cuadre de Caja.
 */
export function OnboardingTooltip({
  step,
  index,
  size,
  isLastStep,
  backProps,
  primaryProps,
  closeProps,
  tooltipProps,
}: TooltipRenderProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const fixedMobilePlacement =
    isMobile && typeof step.target === "string"
      ? getMobileFixedTooltipPlacement(step.target)
      : null;
  const useFixedMobileTooltip = fixedMobilePlacement !== null;

  const showPrimary = step.buttons?.includes("primary");
  const showBack = step.buttons?.includes("back") && index > 0;
  const showClose = step.buttons?.includes("close");
  const progressLabel = size > 1 ? `Paso ${index + 1} de ${size}` : null;
  const primaryLabel =
    (typeof step.locale?.next === "string" ? step.locale.next : null) ||
    (isLastStep && typeof step.locale?.last === "string"
      ? step.locale.last
      : null) ||
    "Continuar";

  const handleCloseClick = (event: MouseEvent<HTMLButtonElement>) => {
    closeProps?.onClick?.(event);
    exitOnboardingTour();
  };

  const tooltipBody = (
    <Box
      {...(useFixedMobileTooltip ? {} : tooltipProps)}
      sx={{
        position: "relative",
        maxWidth: { xs: "min(380px, calc(100vw - 24px))", sm: 380 },
        width: { xs: "calc(100vw - 24px)", sm: "100%" },
        mx: { xs: "auto", sm: 0 },
        bgcolor: "background.paper",
        borderRadius: 3,
        boxShadow:
          "0 20px 50px -12px rgba(15, 23, 42, 0.28), 0 0 0 1px rgba(226, 232, 240, 0.95)",
        overflow: "hidden",
        textAlign: "left",
        ...(fixedMobilePlacement === "top"
          ? {
              position: "fixed",
              top: MOBILE_FIXED_TOOLTIP_TOP,
              left: 12,
              right: 12,
              width: "auto",
              maxWidth: "none",
              mx: 0,
              zIndex: ONBOARDING_JOYRIDE_Z_INDEX + 3,
              pointerEvents: "auto",
            }
          : {}),
        ...(fixedMobilePlacement === "bottom"
          ? {
              position: "fixed",
              bottom: MOBILE_FIXED_TOOLTIP_BOTTOM,
              left: 12,
              right: 12,
              width: "auto",
              maxWidth: "none",
              mx: 0,
              zIndex: ONBOARDING_JOYRIDE_Z_INDEX + 3,
              pointerEvents: "auto",
            }
          : {}),
      }}
    >
      <Box
        sx={{
          height: 4,
          background: (t) =>
            `linear-gradient(90deg, ${t.palette.primary.main}, ${t.palette.primary.light})`,
        }}
      />

      {showClose ? (
        <IconButton
          {...closeProps}
          onClick={handleCloseClick}
          size="small"
          aria-label="Cerrar guía"
          sx={{
            position: "absolute",
            top: 10,
            right: 8,
            zIndex: 2,
            color: "text.secondary",
            bgcolor: "action.hover",
            "&:hover": { bgcolor: "action.selected" },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      ) : null}

      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          pt: 2,
          pr: showClose ? { xs: 5, sm: 5.5 } : undefined,
          pb: showPrimary ? 1.25 : 2.5,
        }}
      >
        {progressLabel ? (
          <Chip
            label={progressLabel}
            size="small"
            sx={{
              mb: 1.5,
              height: 24,
              fontSize: "0.7rem",
              fontWeight: 600,
              letterSpacing: "0.02em",
              bgcolor: "primary.main",
              color: "primary.contrastText",
              "& .MuiChip-label": { px: 1.25 },
            }}
          />
        ) : null}

        {step.title ? (
          <Typography
            component="h2"
            variant="subtitle1"
            sx={{
              fontWeight: 700,
              fontSize: { xs: "1.05rem", sm: "1.125rem" },
              lineHeight: 1.35,
              color: "text.primary",
              mb: 1,
            }}
          >
            {step.title}
          </Typography>
        ) : null}

        <Typography
          variant="body2"
          sx={{
            color: "text.secondary",
            fontSize: { xs: "0.875rem", sm: "0.9375rem" },
            lineHeight: 1.55,
          }}
        >
          {step.content}
        </Typography>
      </Box>

      {showPrimary ? (
        <Box
          sx={{
            px: { xs: 2, sm: 2.5 },
            pb: 2.5,
            display: "flex",
            gap: 1,
            flexDirection: showBack ? "row" : "column",
          }}
        >
          {showBack ? (
            <Button
              variant="outlined"
              color="inherit"
              size="large"
              {...backProps}
              sx={{
                flex: "0 0 auto",
                borderRadius: 2,
                py: 1.35,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                borderColor: "divider",
                color: "text.secondary",
              }}
            >
              {typeof step.locale?.back === "string" ? step.locale.back : "Atrás"}
            </Button>
          ) : null}
          <Button
            variant="contained"
            color="primary"
            fullWidth={!showBack}
            size="large"
            disableElevation
            {...primaryProps}
            sx={[
              {
                flex: showBack ? 1 : undefined,
                borderRadius: 2,
                py: 1.35,
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                boxShadow: (t) => `0 4px 14px ${t.palette.primary.main}40`,
              },
            ]}
          >
            {primaryLabel}
          </Button>
        </Box>
      ) : null}
    </Box>
  );

  if (useFixedMobileTooltip && typeof document !== "undefined") {
    return createPortal(tooltipBody, document.body);
  }

  return tooltipBody;
}
