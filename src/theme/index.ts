import { alpha, createTheme, Theme } from "@mui/material/styles";

import {
  ColorRole,
  SemanticTokens,
  darkTokens,
  lightTokens,
  shape,
  touch,
} from "./tokens";

export * from "./tokens";

/**
 * The brand colour, from the chosen direction.
 *
 * It replaces `#1976d2` — Material UI's stock blue, which the app had never
 * actually chosen, it just never overrode it. The direction reserves this violet
 * for one job: action and selection. Nothing else may be violet, which is why
 * `info` is a blue kept well away from it.
 */
const BRAND = {
  main: lightTokens.hue.accent.main,
  light: "#7C6DC4",
  dark: "#43357F",
} as const;

/**
 * Secondary is the near-black of the charge bar, not a second brand colour.
 *
 * The direction's second most prominent surface is that bar; giving MUI a pink
 * `secondary` it would then scatter across the app is how the palette drifted in
 * the first place.
 */
const INK = {
  main: "#131417",
  light: "#3D3E46",
  dark: "#08090B",
} as const;

/**
 * The system stack, on purpose.
 *
 * The theme used to name Inter and never load it — no `next/font`, no font
 * files, no stylesheet link — so every screen has always rendered in Helvetica
 * anyway. Rather than finally ship the download, this makes the truth the
 * intent: the POS sells with no connection and its first paint is the screen
 * that matters most, so a blocking webfont buys nothing the direction needs. The
 * direction itself was drawn and approved in this stack.
 *
 * Typography carries no colour of its own. Every variant used to hardcode one
 * (`#1a202c`, `#374151`, `#6b7280`…), which is the single reason a dark mode was
 * impossible: text could never respond to the scheme. Colour now comes from
 * `palette.text` and is inherited.
 *
 * Sizes follow the direction's scale. Large amounts are tightened
 * (`letterSpacing: -0.025em`) because they are set in the 34–40px range and the
 * default tracking makes a six-digit total look loose.
 */
const typography = {
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  h1: {
    fontSize: "2.5rem",
    fontWeight: 700,
    lineHeight: 1.1,
    letterSpacing: "-0.025em",
  },
  h2: {
    fontSize: "2.125rem",
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: "-0.025em",
  },
  h3: {
    fontSize: "1.625rem",
    fontWeight: 700,
    lineHeight: 1.25,
    letterSpacing: "-0.02em",
  },
  h4: {
    fontSize: "1.375rem",
    fontWeight: 700,
    lineHeight: 1.3,
    letterSpacing: "-0.015em",
  },
  h5: { fontSize: "1.1875rem", fontWeight: 700, lineHeight: 1.35 },
  h6: { fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.4 },
  body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
  body2: { fontSize: "0.8125rem", lineHeight: 1.5 },
  caption: { fontSize: "0.71875rem", lineHeight: 1.45 },
  button: {
    textTransform: "none" as const,
    fontWeight: 700,
    fontSize: "0.9375rem",
  },
} as const;

function buildTheme(mode: "light" | "dark", t: SemanticTokens): Theme {
  return createTheme({
    palette: {
      mode,
      primary: { ...BRAND, contrastText: t.hue.accent.contrast },
      secondary: { ...INK, contrastText: t.text.onInverse },
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
      // MUI's own interaction slots, pointed at the accent.
      //
      // The direction reserves violet for action and selection, and this is
      // where that becomes true app-wide rather than per-component. The nav
      // alone hand-painted `rgba(25, 118, 210, 0.08)` — the retired stock
      // blue — in nine places, while every ListItemButton, MenuItem and
      // TableRow that never got a local override fell back to MUI's neutral
      // grey. Both were wrong, in opposite directions.
      action: {
        hover: alpha(t.hue.accent.main, 0.08),
        hoverOpacity: 0.08,
        selected: alpha(t.hue.accent.main, 0.12),
        selectedOpacity: 0.12,
      },
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
            fontSize: "0.9375rem",
            fontWeight: 700,
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
          // The direction's touch floor, applied where it costs nothing: the
          // default size clears 44px and the large one clears 56px. `small`
          // keeps MUI's height so dense toolbars and table rows still fit.
          sizeMedium: { minHeight: touch.min },
          sizeLarge: { minHeight: touch.comfortable },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          // A bare 24px icon with MUI's 8px padding lands at 40px — under the
          // floor, and these are the controls a thumb hits most in the POS.
          sizeMedium: { width: touch.min, height: touch.min },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: shape.radius.md,
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
            // The hairline is drawn inside the bar, not as a border under
            // it: a border made the bar 57/65px while every screen that
            // fills the viewport (the POS) subtracts 56/64, and that one
            // pixel was enough to let the whole page scroll. No shadow — the
            // hairline is the boundary.
            boxShadow: `inset 0 -1px 0 ${t.surface.border}`,
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
      // 16px in every text field, one step above body1. Not a type choice:
      // iOS Safari zooms the whole page into any input set below 16px the
      // moment it is focused, and the POS's search field is tapped on a
      // phone hundreds of times a day.
      MuiInputBase: {
        styleOverrides: {
          root: { fontSize: "1rem" },
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
                borderColor: BRAND.main,
                borderWidth: "2px",
              },
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: shape.radius.pill,
            fontWeight: 600,
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
      // `surface` pairs with `main` as text (see tokens.ts) — the same rule
      // MuiChip already follows, so an inline <Alert> reads as the same
      // vocabulary as a status chip instead of MUI's stock severity colours.
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: shape.radius.md },
          standardSuccess: {
            backgroundColor: t.hue.positive.surface,
            color: t.hue.positive.main,
            "& .MuiAlert-icon": { color: t.hue.positive.main },
          },
          standardError: {
            backgroundColor: t.hue.negative.surface,
            color: t.hue.negative.main,
            "& .MuiAlert-icon": { color: t.hue.negative.main },
          },
          standardWarning: {
            backgroundColor: t.hue.caution.surface,
            color: t.hue.caution.main,
            "& .MuiAlert-icon": { color: t.hue.caution.main },
          },
          standardInfo: {
            backgroundColor: t.hue.info.surface,
            color: t.hue.info.main,
            "& .MuiAlert-icon": { color: t.hue.info.main },
          },
        },
      },
      // notistack renders its toasts outside MuiAlert, so the same four
      // roles are repeated here as the solid `main` ink instead of the
      // `surface` wash — a toast interrupts, a wash-coloured <Alert> just
      // sits on the page.
      MuiCssBaseline: {
        styleOverrides: {
          ".notistack-MuiContent": {
            borderRadius: shape.radius.md,
            fontSize: "0.84375rem",
            lineHeight: 1.43,
            minWidth: 288,
            padding: "8px 8px 8px 16px",
          },
          ".notistack-MuiContent-success": {
            backgroundColor: t.hue.positive.main,
            color: t.text.onFilled,
          },
          ".notistack-MuiContent-error": {
            backgroundColor: t.hue.negative.main,
            color: t.text.onFilled,
          },
          ".notistack-MuiContent-warning": {
            backgroundColor: t.hue.caution.main,
            color: t.text.onFilled,
          },
          ".notistack-MuiContent-info": {
            backgroundColor: t.hue.info.main,
            color: t.text.onFilled,
          },
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
