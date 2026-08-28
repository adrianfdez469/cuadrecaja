"use client";

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";

import { AuthBrandPanel, VERSION_LINE } from "./AuthBrandPanel";

interface AuthSplitLayoutProps {
  children: ReactNode;
}

/**
 * The shape every way-in screen takes.
 *
 * Brand on the left, the form centred on the right; stacked on a phone, where
 * the violet becomes a band. The form column is a plain page, not a card
 * floating over a gradient — signing in is the screen, so it should not look
 * like a dialog someone opened on top of one.
 */
export function AuthSplitLayout({ children }: AuthSplitLayoutProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        minHeight: "100dvh",
        bgcolor: "semantic.surface.raised",
      }}
    >
      <AuthBrandPanel />

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          px: { xs: 2.5, md: 7 },
          pt: { xs: 3.5, md: 7 },
          pb: { xs: 2.5, md: 7 },
          justifyContent: { xs: "flex-start", md: "center" },
          alignItems: { xs: "stretch", md: "center" },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: { xs: "none", md: 400 } }}>
          {children}
        </Box>

        {/* On a phone the violet band has no room for it, so the version line
            settles at the foot of the form instead. */}
        <Typography
          sx={{
            display: { xs: "block", md: "none" },
            mt: "auto",
            pt: 3,
            textAlign: "center",
            fontSize: "0.75rem",
            color: "text.disabled",
          }}
        >
          {VERSION_LINE}
        </Typography>
      </Box>
    </Box>
  );
}
