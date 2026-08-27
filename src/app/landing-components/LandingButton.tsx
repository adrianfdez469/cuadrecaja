"use client";

import { Button } from "@mui/material";
import type { ButtonProps } from "@mui/material";

import { shape, touch } from "@/theme/tokens";

interface LandingButtonProps extends Omit<ButtonProps, "variant" | "color"> {
  /**
   * `solid` is the violet action — one per screen region, never two side by
   * side. `ghost` is the quiet alternative next to it: a hairline and
   * secondary ink, so it reads as available rather than as a second offer.
   */
  tone?: "solid" | "ghost";
}

/**
 * The landing's two buttons.
 *
 * The public page cannot lean on the app's `MuiButton` defaults: it sets its
 * actions at 56px and 17px, well above the in-app scale, because on a landing
 * the button *is* the page's job. Everything else — the corner, the touch
 * floor, the violet — still comes from the tokens.
 */
export function LandingButton({
  tone = "solid",
  sx,
  ...props
}: LandingButtonProps) {
  const solid = tone === "solid";

  return (
    <Button
      disableElevation
      {...props}
      sx={{
        minHeight: touch.comfortable,
        px: 3,
        borderRadius: `${shape.radius.md}px`,
        fontSize: solid ? "1.0625rem" : "1rem",
        fontWeight: solid ? 700 : 600,
        ...(solid
          ? {
              bgcolor: "semantic.hue.accent.main",
              color: "semantic.hue.accent.contrast",
              "&:hover": { bgcolor: "primary.dark" },
            }
          : {
              bgcolor: "semantic.surface.raised",
              color: "text.secondary",
              border: "1px solid",
              borderColor: "semantic.surface.border",
              "&:hover": {
                bgcolor: "semantic.surface.sunken",
                borderColor: "semantic.surface.borderStrong",
              },
            }),
        ...sx,
      }}
    />
  );
}
