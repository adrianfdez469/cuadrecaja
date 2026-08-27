"use client";

import { useState } from "react";
import {
  AppBar,
  Box,
  Button,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  Toolbar,
} from "@mui/material";
import { Close, Menu as MenuIcon } from "@mui/icons-material";

import { BrandLockup } from "@/components/brand";
import {
  LANDING_CTA_SECTION_ID,
  scrollToLandingSection,
} from "@/constants/landingContact";
import { touch } from "@/theme/tokens";
import { useLandingNavigation } from "@/hooks/useLandingNavigation";

import { LandingButton } from "./LandingButton";

const PROMOTER_PATH = "/promotor/registro";
const LOGIN_PATH = "/login";

/**
 * The public header: the brand, two quiet links and the one action.
 *
 * On a phone the three collapse behind a single control. The page used to
 * stack the buttons inside the bar instead, which on a 390px screen left the
 * brand fighting two full-width gradients for the same 60px.
 */
export function LandingHeader() {
  const { navigateTo, isNavigatingTo, isNavigating } = useLandingNavigation();
  const [menuOpen, setMenuOpen] = useState(false);

  const goToTrial = () => {
    setMenuOpen(false);
    scrollToLandingSection(LANDING_CTA_SECTION_ID);
  };

  const goTo = (path: string) => () => {
    setMenuOpen(false);
    navigateTo(path);
  };

  const label = (path: string, text: string) =>
    isNavigatingTo(path) ? "Cargando..." : text;

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar
        disableGutters
        sx={{
          minHeight: { xs: 60, md: 72 },
          px: { xs: 1.5, md: 5 },
          gap: 1,
        }}
      >
        <BrandLockup
          markSize={36}
          wordSize={17}
          sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}
        />
        <BrandLockup
          markSize={32}
          wordSize={16}
          sx={{ flexGrow: 1, gap: 1.25, display: { xs: "flex", md: "none" } }}
        />

        <Box
          sx={{
            display: { xs: "none", md: "flex" },
            alignItems: "center",
            gap: 1.25,
          }}
        >
          <Button
            disabled={isNavigating}
            onClick={goTo(PROMOTER_PATH)}
            sx={{ minHeight: touch.min, px: 1.5, color: "text.secondary" }}
          >
            {label(PROMOTER_PATH, "Ser promotor")}
          </Button>
          <Button
            disabled={isNavigating}
            onClick={goTo(LOGIN_PATH)}
            sx={{ minHeight: touch.min, px: 1.5, color: "text.secondary" }}
          >
            {label(LOGIN_PATH, "Iniciar Sesión")}
          </Button>
          <LandingButton
            onClick={goToTrial}
            sx={{ minHeight: 48, px: 2.5, fontSize: "0.9375rem" }}
          >
            Probar gratis
          </LandingButton>
        </Box>

        <IconButton
          aria-label="Abrir menú"
          onClick={() => setMenuOpen(true)}
          sx={{
            display: { xs: "inline-flex", md: "none" },
            color: "text.primary",
          }}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>

      <Drawer
        anchor="right"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        slotProps={{ paper: { sx: { width: "min(320px, 85vw)" } } }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 60,
            px: 1.5,
          }}
        >
          <BrandLockup markSize={32} wordSize={16} sx={{ gap: 1.25 }} />
          <IconButton
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          >
            <Close />
          </IconButton>
        </Box>
        <Divider />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, p: 2 }}>
          <LandingButton onClick={goToTrial} fullWidth>
            Probar gratis
          </LandingButton>
          <LandingButton
            tone="ghost"
            fullWidth
            disabled={isNavigating}
            onClick={goTo(LOGIN_PATH)}
            startIcon={
              isNavigatingTo(LOGIN_PATH) ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
          >
            {label(LOGIN_PATH, "Iniciar Sesión")}
          </LandingButton>
          <LandingButton
            tone="ghost"
            fullWidth
            disabled={isNavigating}
            onClick={goTo(PROMOTER_PATH)}
            startIcon={
              isNavigatingTo(PROMOTER_PATH) ? (
                <CircularProgress size={18} color="inherit" />
              ) : undefined
            }
          >
            {label(PROMOTER_PATH, "Ser promotor")}
          </LandingButton>
        </Box>
      </Drawer>
    </AppBar>
  );
}
