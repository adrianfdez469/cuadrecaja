/**
 * Design tokens — the single source of truth for every colour in the app.
 *
 * These are the values of the visual direction chosen in Claude Design
 * ("Pulgar": search on top, charging under the thumb). Everything here was read
 * off that direction rather than invented: the violet accent, the near-black
 * charge bar, the green for change owed and the red for what is still missing
 * all come from the POS sale and checkout screens.
 *
 * Two hues are derived rather than drawn, because the POS never needed them:
 * `caution` and `info`. They are placed in the gaps of the hue circle left by
 * the four the direction does define, so no two roles read as each other — in
 * particular `info` is a blue kept far from the accent violet, since the
 * direction reserves violet for action and selection alone.
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
  /**
   * The flipped ground. The direction leans on this hard: the total and its
   * action live together on a near-black bar pinned to the bottom of the POS,
   * so the one number that matters is never the same colour as the page.
   */
  inverse: string;
};

type TextColors = {
  primary: string;
  secondary: string;
  disabled: string;
  /** Text placed on a coloured `main` ink. */
  onFilled: string;
  /** Text placed on `surface.inverse`. */
  onInverse: string;
  /** Secondary text on `surface.inverse` — labels, conversions, counters. */
  onInverseMuted: string;
};

/**
 * The six hues everything resolves to. Adding a seventh needs a reason that
 * cannot be expressed with shape, weight, icon or position.
 */
const lightHues: Hues = {
  positive: { main: "#1F6B3F", surface: "#F1F7F3", contrast: "#FFFFFF" },
  negative: { main: "#A5382A", surface: "#FBF3F1", contrast: "#FFFFFF" },
  caution: { main: "#8A5A12", surface: "#FAF3E9", contrast: "#FFFFFF" },
  info: { main: "#1C5E80", surface: "#EDF4F8", contrast: "#FFFFFF" },
  neutral: { main: "#5B5A63", surface: "#F3F2F6", contrast: "#FFFFFF" },
  accent: { main: "#5B4CA8", surface: "#F4F2FB", contrast: "#FFFFFF" },
};

const darkHues: Hues = {
  positive: { main: "#5FB37E", surface: "#14291D", contrast: "#0B1A12" },
  negative: { main: "#E08376", surface: "#2E1815", contrast: "#2A0F0D" },
  caution: { main: "#CFA24A", surface: "#2B2113", contrast: "#241A07" },
  info: { main: "#5FA6CC", surface: "#12242E", contrast: "#081926" },
  neutral: { main: "#A2A1AB", surface: "#25252A", contrast: "#15181B" },
  accent: { main: "#A493E8", surface: "#221C3A", contrast: "#150F26" },
};

const lightSurfaces: Surfaces = {
  page: "#F7F7FA",
  raised: "#FFFFFF",
  sunken: "#F3F2F6",
  border: "#ECEBEF",
  borderStrong: "#D8D7DE",
  inverse: "#131417",
};

const darkSurfaces: Surfaces = {
  page: "#141517",
  raised: "#1C1E20",
  sunken: "#111214",
  border: "#2A2C2F",
  borderStrong: "#3C3F43",
  inverse: "#F3F2F6",
};

/**
 * `secondary` is darker than the direction's own #7C7B85. That grey clears 4:1
 * on white and the direction only ever set 11px meta text in it; promoting it to
 * the app's secondary text would have failed AA on body copy.
 */
const lightText: TextColors = {
  primary: "#131417",
  secondary: "#5F5E68",
  disabled: "#9B9AA3",
  onFilled: "#FFFFFF",
  onInverse: "#FFFFFF",
  onInverseMuted: "#9A99A3",
};

const darkText: TextColors = {
  primary: "#E9E8E5",
  secondary: "#A6A5AE",
  disabled: "#71707A",
  onFilled: "#0F1114",
  onInverse: "#131417",
  onInverseMuted: "#5F5E68",
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
 * Spacing and radii. Kept here so the values stop being retyped: the app
 * currently mixes spacing multiples (`borderRadius: 2`) with raw pixels
 * (`borderRadius: 8`) for the same corner.
 */
export const shape = {
  /** MUI's spacing unit, in px. `theme.spacing(2)` === 16px. */
  spacingUnit: 8,
  radius: {
    /** Keypad keys, quick-amount buttons, small controls. */
    sm: 10,
    /** Buttons, inputs, cards, payment tiles — the default corner. */
    md: 12,
    /** Dialogs, bottom sheets, the sheets that cover the POS. */
    lg: 16,
    /** Pills and avatars: account tabs, category chips. */
    pill: 999,
  },
} as const;

/**
 * Touch targets and row heights, in px. The POS is operated one-handed while
 * standing, so these are floors rather than suggestions — the current build
 * ships 15px icons inside the account chips.
 */
export const touch = {
  /** Absolute minimum for anything tappable: icon buttons, «+», «✕». */
  min: 44,
  /** Primary POS actions: search field, scanner, charge button. */
  comfortable: 56,
  /** A settings or payment-method row. */
  row: 56,
  /** A catalogue row, which carries a name, stock, price and two conversions. */
  rowLarge: 72,
} as const;
