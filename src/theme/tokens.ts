/**
 * Design tokens — the single source of truth for every colour in the app.
 *
 * PROVISIONAL VALUES. The structure here is final; the values are placeholders
 * until the visual direction is chosen in Claude Design (phase 3b). When that
 * lands, only the constants in this file change — no component should need
 * touching, because nothing outside this file is allowed to name a colour.
 *
 * The whole point of this layer is arithmetic: the app previously carried 108
 * distinct hardcoded hex values for what turns out to be six meanings. Every
 * semantic role below resolves to one of those six hues, so a new state gets a
 * meaning, not a new colour.
 */

/** A semantic colour role: the ink, the wash behind it, and text that sits on the ink. */
export type ColorRole = {
  /** Ink: icons, text, borders, filled backgrounds. */
  main: string;
  /** Wash: tinted background for chips, banners and rows. Pairs with `main` as text. */
  surface: string;
  /** Text that sits legibly on top of `main`. */
  contrast: string;
};

type Hues = {
  positive: ColorRole;
  negative: ColorRole;
  caution: ColorRole;
  info: ColorRole;
  neutral: ColorRole;
  accent: ColorRole;
};

type Surfaces = {
  /** The page ground. */
  page: string;
  /** Cards, sheets, menus — anything lifted off the page. */
  raised: string;
  /** Wells, table headers, inset areas. */
  sunken: string;
  /** Hairlines and dividers. */
  border: string;
  /** A stronger border for focus and active outlines. */
  borderStrong: string;
};

type TextColors = {
  primary: string;
  secondary: string;
  disabled: string;
  /** Text placed on a coloured `main` ink. */
  onFilled: string;
};

/**
 * The six hues everything resolves to. Adding a seventh needs a reason that
 * cannot be expressed with shape, weight, icon or position.
 */
const lightHues: Hues = {
  positive: { main: "#1F7A45", surface: "#E6F3EB", contrast: "#FFFFFF" },
  negative: { main: "#B3261E", surface: "#FBE9E8", contrast: "#FFFFFF" },
  caution: { main: "#8A5A00", surface: "#FBF0DC", contrast: "#FFFFFF" },
  info: { main: "#14639E", surface: "#E3EFF8", contrast: "#FFFFFF" },
  neutral: { main: "#5A6069", surface: "#EEF0F2", contrast: "#FFFFFF" },
  accent: { main: "#5B44A8", surface: "#EDE9F8", contrast: "#FFFFFF" },
};

const darkHues: Hues = {
  positive: { main: "#6FBF8E", surface: "#143024", contrast: "#0B1A12" },
  negative: { main: "#F2938C", surface: "#3A1B19", contrast: "#2A0F0D" },
  caution: { main: "#DCA940", surface: "#38290E", contrast: "#241A07" },
  info: { main: "#6FB3E0", surface: "#10293C", contrast: "#081926" },
  neutral: { main: "#A0A7B0", surface: "#24282D", contrast: "#15181B" },
  accent: { main: "#A794E8", surface: "#241D3D", contrast: "#150F26" },
};

const lightSurfaces: Surfaces = {
  page: "#F7F8F9",
  raised: "#FFFFFF",
  sunken: "#EFF1F3",
  border: "#E2E5E9",
  borderStrong: "#C7CCD3",
};

const darkSurfaces: Surfaces = {
  page: "#121417",
  raised: "#1A1D21",
  sunken: "#0E1013",
  border: "#2A2F35",
  borderStrong: "#3D444C",
};

const lightText: TextColors = {
  primary: "#16191D",
  secondary: "#5A6069",
  disabled: "#9AA1AA",
  onFilled: "#FFFFFF",
};

const darkText: TextColors = {
  primary: "#E8EAED",
  secondary: "#A2A9B3",
  disabled: "#6B727B",
  onFilled: "#0F1114",
};

/**
 * What a stock movement does to the count. This is the axis that matters to the
 * user, and it is why the twelve movement types collapse to seven roles.
 *
 * `split` deserves the note: DESAGREGACION_ALTA and DESAGREGACION_BAJA are the
 * two halves of one operation — opening a box to sell its units. Painting one
 * green and the other red (as the app does today) reads as a success and a
 * failure when nothing succeeded or failed. They share a role on purpose.
 */
export type FlowRole =
  "in" | "out" | "transfer" | "correction" | "loss" | "split" | "external";

const flowRoles: Record<FlowRole, keyof Hues> = {
  in: "positive",
  out: "negative",
  transfer: "info",
  correction: "caution",
  loss: "negative",
  split: "neutral",
  external: "accent",
};

export type StockRole = "ok" | "low" | "out" | "expiring" | "expired";

const stockRoles: Record<StockRole, keyof Hues> = {
  ok: "positive",
  low: "caution",
  out: "negative",
  expiring: "caution",
  expired: "negative",
};

export type SyncRole = "online" | "offline" | "syncing" | "failed";

const syncRoles: Record<SyncRole, keyof Hues> = {
  online: "positive",
  offline: "caution",
  syncing: "info",
  failed: "negative",
};

export type SubscriptionRole = "active" | "grace" | "expired" | "suspended";

const subscriptionRoles: Record<SubscriptionRole, keyof Hues> = {
  active: "positive",
  grace: "caution",
  expired: "negative",
  suspended: "negative",
};

/** How an amount reads. `reference` is the approximate conversion shown beside a real price. */
export type MoneyRole = "positive" | "negative" | "neutral" | "reference";

function resolve<K extends string>(
  map: Record<K, keyof Hues>,
  hues: Hues,
): Record<K, ColorRole> {
  const out = {} as Record<K, ColorRole>;
  (Object.keys(map) as K[]).forEach((key) => {
    out[key] = hues[map[key]];
  });
  return out;
}

function buildScheme(hues: Hues, surfaces: Surfaces, text: TextColors) {
  return {
    hue: hues,
    surface: surfaces,
    text,
    flow: resolve(flowRoles, hues),
    stock: resolve(stockRoles, hues),
    sync: resolve(syncRoles, hues),
    subscription: resolve(subscriptionRoles, hues),
    money: {
      positive: hues.positive,
      negative: hues.negative,
      neutral: {
        main: text.primary,
        surface: surfaces.sunken,
        contrast: text.onFilled,
      },
      reference: {
        main: text.secondary,
        surface: surfaces.sunken,
        contrast: text.onFilled,
      },
    } satisfies Record<MoneyRole, ColorRole>,
  };
}

export const lightTokens = buildScheme(lightHues, lightSurfaces, lightText);
export const darkTokens = buildScheme(darkHues, darkSurfaces, darkText);

export type SemanticTokens = typeof lightTokens;

/**
 * Spacing, radii and elevation. Kept here so the values stop being retyped:
 * the app currently mixes spacing multiples (`borderRadius: 2`) with raw pixels
 * (`borderRadius: 8`) for the same corner.
 */
export const shape = {
  /** MUI's spacing unit, in px. `theme.spacing(2)` === 16px. */
  spacingUnit: 8,
  radius: {
    /** Chips, tags, small controls. */
    sm: 6,
    /** Buttons, inputs, menus. */
    md: 8,
    /** Cards, dialogs, sheets. */
    lg: 12,
    /** Pills and avatars. */
    pill: 999,
  },
} as const;

/**
 * Touch targets. The POS is operated one-handed, standing, so these are floors
 * rather than suggestions — the current build ships 15px icons inside the
 * account chips.
 */
export const touch = {
  /** Absolute minimum for anything tappable. */
  min: 44,
  /** Primary POS actions: add to cart, charge. */
  comfortable: 56,
} as const;
