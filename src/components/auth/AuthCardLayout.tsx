"use client";

import type { ReactNode } from "react";
import { Box } from "@mui/material";

import { AuthWordmark } from "./AuthWordmark";

interface AuthCardLayoutProps {
  children: ReactNode;
}

/**
 * Layout for account activation and password reset screens.
 *
 * Centered wordmark above a white card on a light background. Used by:
 * - Recover password request, password reset, and account activations.
 *
 * Desktop: 600px card centered, light background.
 * Mobile: Full-width card, same background.
 */
export function AuthCardLayout({ children }: AuthCardLayoutProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100dvh",
        bgcolor: "#F7F7FA",
        px: { xs: 2.5, md: 0 },
        py: { xs: 3.5, md: 7 },
      }}
    >
      <AuthWordmark sx={{ mb: { xs: 3.5, md: 4 } }} />

      <Box
        sx={{
          width: "100%",
          maxWidth: 600,
          bgcolor: "white",
          borderRadius: "12px",
          border: "1px solid #ECEBEF",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
          px: { xs: 2.5, md: 4 },
          py: { xs: 3.5, md: 4.5 },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
