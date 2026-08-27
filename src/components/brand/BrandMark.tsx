"use client";

import { Box, keyframes } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material";

/**
 * The brand mark: a square broken into two identical halves.
 *
 * The name says what the product does — cuadrar — and the mark draws it: a
 * rounded square split into two strokes with rotational symmetry, so the two
 * halves weigh the same, the way a till has to balance. The square is never
 * closed; it is closing.
 *
 * It replaces a six-shape drawing (awning, base, drawer, check and two loose
 * dots) that used the two colours the palette retired, `#1976d2` and
 * `#10b981`, and that turned to dirt below 24px.
 */

/**
 * The stroke thickens as the mark shrinks.
 *
 * Without this the two gaps on the diagonal close up and the mark stops
 * reading — which is also why it is never set below 16px.
 */
function strokeWidthFor(size: number): number {
  if (size >= 40) return 2.5;
  if (size >= 24) return 2.8;
  return 3;
}

/** Inside its container the glyph occupies this share of the side. */
const GLYPH_RATIO = 0.61;

/** The container's corner, as a share of its side. */
const CONTAINER_RADIUS_RATIO = 0.28;

/**
 * The brand's one animation: the two halves drawing the square closed.
 *
 * `26` is the length of each half in the 24-unit grid, so the stroke starts
 * fully retracted and lands exactly on its own end. It is the only motion the
 * mark is allowed, and it is what the splash and the transition screen show
 * instead of a spinner.
 */
const closing = keyframes`
  0% { stroke-dashoffset: 26; }
  55%, 100% { stroke-dashoffset: 0; }
`;

interface BrandMarkProps {
  /** Rendered side, in px: the glyph when bare, the container when boxed. */
  size?: number;
  /**
   * Sit the mark in a filled container. This is the app icon, the avatar and
   * the form the mark takes on the landing and the login; bare is what the
   * app's own top bar uses, where the store name is the actual data.
   */
  boxed?: boolean;
  /**
   * `accent` — violet on the page, and a violet container when boxed.
   * `inverse` — white ink; boxed, the container becomes a translucent white
   * well, which is how the mark sits on the login's violet panel.
   */
  tone?: "accent" | "inverse";
  /** Run the closing animation. For the splash and the transition screen. */
  animated?: boolean;
  sx?: SxProps<Theme>;
}

export function BrandMark({
  size = 24,
  boxed = false,
  tone = "accent",
  animated = false,
  sx,
}: BrandMarkProps) {
  const glyphSize = boxed ? Math.round(size * GLYPH_RATIO) : size;
  const strokeWidth = strokeWidthFor(size);

  const glyph = (
    <Box
      component="svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      sx={{
        width: glyphSize,
        height: glyphSize,
        display: "block",
        flex: `0 0 ${glyphSize}px`,
        color:
          tone === "inverse"
            ? "semantic.text.onInverse"
            : boxed
              ? "semantic.hue.accent.contrast"
              : "semantic.hue.accent.main",
        ...(animated && {
          "& path": {
            strokeDasharray: 26,
            animation: `${closing} 1.6s ease-in-out infinite`,
          },
          "& path:last-of-type": { animationDelay: "0.2s" },
          "@media (prefers-reduced-motion: reduce)": {
            "& path": { animation: "none" },
          },
        }),
        ...(boxed ? undefined : sx),
      }}
    >
      <path
        d="M15.5 4.5H7A2.5 2.5 0 0 0 4.5 7v8.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        d="M8.5 19.5H17A2.5 2.5 0 0 0 19.5 17V8.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Box>
  );

  if (!boxed) return glyph;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: `0 0 ${size}px`,
        width: size,
        height: size,
        borderRadius: `${Math.round(size * CONTAINER_RADIUS_RATIO)}px`,
        bgcolor:
          tone === "inverse"
            ? (theme) => alpha(theme.palette.semantic.text.onInverse, 0.16)
            : "semantic.hue.accent.main",
        ...sx,
      }}
    >
      {glyph}
    </Box>
  );
}
