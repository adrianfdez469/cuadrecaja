"use client";

import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

import type { PillHue } from "@/components/StatusPill";

interface StatusScreenProps {
  /**
   * A short tracked line above the title — «ERROR 403», «SUSCRIPCIÓN
   * VENCIDA». It carries the code so the title does not have to, which is why
   * the code stops being a giant number behind the icon.
   */
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  icon: ReactNode;
  /**
   * The wash behind the icon. `accent` for a rule the app is enforcing —
   * a locked door is not a failure — and a real hue only when something has
   * actually gone wrong.
   */
  hue?: PillHue;
  /** Rendered under the copy. The primary action goes last. */
  actions?: ReactNode;
  /** Extra content below the actions, e.g. how to reach support. */
  children?: ReactNode;
}

/**
 * A screen that exists to explain why there is no screen.
 *
 * 403, an expired subscription, a page that is not there: the app drew each of
 * these differently, and the 403 set its own code at 144px in amber behind the
 * icon, at 12% opacity — decoration that said «warning» about a permission
 * working exactly as configured. One shape, one icon, the code as a label.
 */
export function StatusScreen({
  eyebrow,
  title,
  description,
  icon,
  hue = "accent",
  actions,
  children,
}: StatusScreenProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        px: 3,
        py: 5,
      }}
    >
      <Stack alignItems="center" sx={{ maxWidth: 560, textAlign: "center" }}>
        <Box
          aria-hidden
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            mb: 3,
            borderRadius: "50%",
            bgcolor: `semantic.hue.${hue}.surface`,
            color: `semantic.hue.${hue}.main`,
            "& .MuiSvgIcon-root": { fontSize: 30 },
          }}
        >
          {icon}
        </Box>

        {eyebrow && (
          <Typography
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: "text.disabled",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {eyebrow}
          </Typography>
        )}

        <Typography
          component="h1"
          sx={{
            mt: eyebrow ? 1.25 : 0,
            fontSize: { xs: "1.5rem", sm: "1.875rem" },
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          {title}
        </Typography>

        {description && (
          <Typography
            component="div"
            sx={{
              mt: 1.25,
              fontSize: "1rem",
              lineHeight: 1.55,
              color: "text.secondary",
              textWrap: "pretty",
            }}
          >
            {description}
          </Typography>
        )}

        {actions && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1.5}
            sx={{ mt: 3.5, width: { xs: "100%", sm: "auto" } }}
          >
            {actions}
          </Stack>
        )}

        {children}
      </Stack>
    </Box>
  );
}
