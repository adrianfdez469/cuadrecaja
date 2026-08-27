"use client";

import { Box } from "@mui/material";

import { LoginBrandPanel } from "./components/LoginBrandPanel";
import { LoginForm } from "./components/LoginForm";

/**
 * The way in.
 *
 * A split on a wide screen — the brand holding the left, the form centred on
 * the right — and the same two blocks stacked on a phone, where the violet is
 * a band rather than a column. No card floating over a gradient: the form is
 * the screen.
 */
export default function LoginPage() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        minHeight: "100dvh",
        bgcolor: "semantic.surface.raised",
      }}
    >
      <LoginBrandPanel />
      <LoginForm />
    </Box>
  );
}
