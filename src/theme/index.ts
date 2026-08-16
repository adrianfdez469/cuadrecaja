import { createTheme, Theme } from "@mui/material/styles";

import {
  ColorRole,
  SemanticTokens,
  darkTokens,
  lightTokens,
  shape,
} from "./tokens";

export * from "./tokens";

/**
 * The brand colour is deliberately unchanged in this pass.
 *
 * `#1976d2` is Material UI's stock blue — the app never picked a primary. That
 * gets decided from the visual direction, and until then changing it here would
 * only churn every screen for no reason. The structure lands now, the values land
 * with the direction.
 */
const PROVISIONAL_PRIMARY = {
  main: "#1976d2",
  light: "#42a5f5",
  dark: "#1565c0",
} as const;

const PROVISIONAL_SECONDARY = {
  main: "#dc004e",
  light: "#ff5983",
  dark: "#9a0036",
} as const;

/**
 * Typography carries no colour of its own.
 *
 * Every variant used to hardcode one (`#1a202c`, `#374151`, `#6b7280`…), which is
 * the single reason a dark mode was impossible: text could never respond to the
 * scheme. Colour now comes from `palette.text` and is inherited.
 */
const typography = {
  fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
  h1: { fontSize: "2.5rem", fontWeight: 700, lineHeight: 1.2 },
  h2: { fontSize: "2rem", fontWeight: 600, lineHeight: 1.3 },
  h3: { fontSize: "1.75rem", fontWeight: 600, lineHeight: 1.4 },
  h4: { fontSize: "1.5rem", fontWeight: 600, lineHeight: 1.4 },
  h5: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.5 },
  h6: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.5 },
  body1: { fontSize: "1rem", lineHeight: 1.6 },
  body2: { fontSize: "0.875rem", lineHeight: 1.6 },
  caption: { fontSize: "0.75rem", lineHeight: 1.5 },
  button: {
    textTransform: "none" as const,
    fontWeight: 600,
    fontSize: "0.875rem",
  },
} as const;

function buildTheme(mode: "light" | "dark", t: SemanticTokens): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { ...PROVISIONAL_PRIMARY, contrastText: t.text.onFilled },
      secondary: { ...PROVISIONAL_SECONDARY, contrastText: t.text.onFilled },
      // The status colours resolve to the semantic hues. This is the
      // consolidation: seven greens, six reds and five oranges become one each.
      success: {
        main: t.hue.positive.main,
        contrastText: t.hue.positive.contrast,
      },
      error: {
        main: t.hue.negative.main,
        contrastText: t.hue.negative.contrast,
      },
      warning: {
        main: t.hue.caution.main,
        contrastText: t.hue.caution.contrast,
      },
      info: { main: t.hue.info.main, contrastText: t.hue.info.contrast },
      background: { default: t.surface.page, paper: t.surface.raised },
      text: {
        primary: t.text.primary,
        secondary: t.text.secondary,
        disabled: t.text.disabled,
      },
      divider: t.surface.border,
      semantic: t,
    },
    typography,
    shape: { borderRadius: shape.radius.md },
    spacing: shape.spacingUnit,
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: shape.radius.md,
            padding: "8px 16px",
            fontSize: "0.875rem",
            fontWeight: 500,
            textTransform: "none",
            boxShadow: "none",
            // `transition: all` forces the browser to evaluate every animatable
            // property on each style change; only the shadow moves here. The
            // hover sits behind `@media (hover: hover)` because on touch it
            // sticks after every tap — each pressed button used to drag 200ms of
            // shadow transition behind it.
            transition: "box-shadow 0.2s ease",
            "@media (hover: hover)": {
              "&:hover": { boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)" },
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: shape.radius.lg,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
            border: `1px solid ${t.surface.border}`,
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
            // Pointer devices only: on touch the hover sticks after the tap and
            // leaves the card raised with an oversized shadow.
            "@media (hover: hover)": {
              "&:hover": {
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.12)",
                transform: "translateY(-1px)",
              },
            },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: t.surface.raised,
            color: t.text.primary,
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)",
            borderBottom: `1px solid ${t.surface.border}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: t.surface.raised,
            borderRight: `1px solid ${t.surface.border}`,
            boxShadow: "2px 0 8px rgba(0, 0, 0, 0.08)",
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: {
            "& .MuiTableCell-head": {
              backgroundColor: t.surface.sunken,
              color: t.text.primary,
              fontWeight: 600,
              fontSize: "0.875rem",
              borderBottom: `1px solid ${t.surface.border}`,
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:hover": {
              backgroundColor: t.surface.sunken,
              transition: "background-color 0.15s ease",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: shape.radius.md,
              backgroundColor: t.surface.raised,
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: t.surface.borderStrong,
              },
              "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                borderColor: PROVISIONAL_PRIMARY.main,
                borderWidth: "2px",
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: shape.radius.sm,
            fontWeight: 500,
            fontSize: "0.75rem",
          },
          colorSuccess: {
            backgroundColor: t.hue.positive.surface,
            color: t.hue.positive.main,
          },
          colorError: {
            backgroundColor: t.hue.negative.surface,
            color: t.hue.negative.main,
          },
          colorWarning: {
            backgroundColor: t.hue.caution.surface,
            color: t.hue.caution.main,
          },
          colorInfo: {
            backgroundColor: t.hue.info.surface,
            color: t.hue.info.main,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          elevation1: { boxShadow: "0 1px 3px rgba(0, 0, 0, 0.08)" },
          elevation2: { boxShadow: "0 2px 8px rgba(0, 0, 0, 0.12)" },
          elevation3: { boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)" },
        },
      },
    },
  });
}

export const lightTheme = buildTheme("light", lightTokens);

/**
 * Built and exported, but not mounted yet: 372 hardcoded colours across the app
 * still ignore the palette, so flipping the scheme today would render dark
 * surfaces under light-only text. It gets wired once the migration (phase 4)
 * has drained those.
 */
export const darkTheme = buildTheme("dark", darkTokens);

const theme = lightTheme;
export default theme;

declare module "@mui/material/styles" {
  interface Palette {
    /** Semantic design tokens. Prefer these over `primary`/`success`/etc. in new code. */
    semantic: SemanticTokens;
  }
  interface PaletteOptions {
    semantic?: SemanticTokens;
  }
}

export type { ColorRole };
