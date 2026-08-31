"use client";

import { Box, Chip, CircularProgress, Typography } from "@mui/material";

import {
  LANDING_CTA_SECTION_ID,
  scrollToLandingSection,
} from "@/constants/landingContact";
import { useLandingNavigation } from "@/hooks/useLandingNavigation";

import { HeroShot } from "./HeroShot";
import { LandingButton } from "./LandingButton";

const DOWNLOAD_PATH = "/descargar";

/**
 * The promise, the two ways in, and the product itself.
 *
 * The screenshot is not decoration: it is the argument. It shows a real sale
 * being charged — catalogue, cart and the near-black bar with the total and
 * its conversions — which is the only way the multi-currency claim below reads
 * as a fact rather than a bullet. It sits in a frame cropped at the bottom, so
 * the page continues rather than the image ending.
 */
export function HeroSection() {
  const { navigateTo, isNavigatingTo, isNavigating } = useLandingNavigation();

  return (
    <Box
      component="section"
      sx={{
        px: { xs: 2, md: 3 },
        pt: { xs: 4, md: 10 },
        background: (theme) =>
          `linear-gradient(180deg, ${theme.palette.semantic.surface.page} 0%, ${theme.palette.semantic.surface.raised} 100%)`,
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto", textAlign: "center" }}>
        <Chip
          label="Sistema de ventas e inventario para tu negocio"
          sx={{
            height: { xs: 30, md: 32 },
            px: 1,
            mb: { xs: 2.25, md: 3 },
            bgcolor: "semantic.surface.raised",
            border: "1px solid",
            borderColor: "semantic.surface.border",
            color: "text.secondary",
            fontSize: { xs: "0.78rem", md: "0.8125rem" },
          }}
        />

        <Typography
          variant="h1"
          sx={{
            maxWidth: 860,
            mx: "auto",
            fontSize: { xs: "2rem", md: "3.25rem" },
            letterSpacing: "-0.03em",
            textWrap: "pretty",
          }}
        >
          Cierra la caja sabiendo exactamente cuánto vendiste y cuánto ganaste
        </Typography>

        <Typography
          sx={{
            maxWidth: 680,
            mx: "auto",
            mt: { xs: 1.75, md: 2.5 },
            fontSize: { xs: "1rem", md: "1.1875rem" },
            lineHeight: 1.55,
            color: "text.secondary",
            textWrap: "pretty",
          }}
        >
          Ventas, inventario y cierre de caja en un solo lugar. Cobra en varias
          monedas, imprime tickets y sigue vendiendo aunque se caiga el
          internet.
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: "center",
            justifyContent: "center",
            gap: 1.25,
            mt: { xs: 3, md: 4 },
          }}
        >
          <LandingButton
            onClick={() => scrollToLandingSection(LANDING_CTA_SECTION_ID)}
            sx={{ width: { xs: "100%", md: "auto" } }}
          >
            Probar gratis 7 días
          </LandingButton>
          <LandingButton
            tone="ghost"
            disabled={isNavigating}
            onClick={() => navigateTo(DOWNLOAD_PATH)}
            startIcon={
              isNavigatingTo(DOWNLOAD_PATH) ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
            sx={{
              width: { xs: "100%", md: "auto" },
              minHeight: { xs: 52, md: 56 },
            }}
          >
            {isNavigatingTo(DOWNLOAD_PATH)
              ? "Cargando..."
              : "Descargar App (Android)"}
          </LandingButton>
        </Box>

        <Typography
          sx={{
            mt: 1.75,
            fontSize: { xs: "0.8125rem", md: "0.875rem" },
            color: "text.disabled",
          }}
        >
          Sin tarjeta. Activación por correo en minutos.
        </Typography>

        <HeroShot />
      </Box>
    </Box>
  );
}
