import { touch } from "@/theme/tokens";

/**
 * Coordinate bounds. THE single definition. Before F-025 the same four literals
 * lived privately in `src/schemas/tiendaOnline.ts`, `src/schemas/qabStore.ts` and
 * `src/components/tiendaOnline/PublicDataCard.tsx`; the three now import them
 * from here. Preventing a fourth copy is why this file exists (E-039).
 */
export const LATITUDE_MIN = -90;
export const LATITUDE_MAX = 90;
export const LONGITUDE_MIN = -180;
export const LONGITUDE_MAX = 180;

/**
 * Decimals kept when the map writes a coordinate. Six is roughly 11 cm, finer
 * than any shop front needs, and it is what makes the string the map writes
 * identical to the one `draftFromLocal` rebuilds after a save (ADR 0098).
 *
 * NOT a contract requirement: the QAB contract at v12.1 declares no type, no
 * range and no precision at all for `latitude`/`longitude`. This is our choice.
 */
export const MAP_COORDINATE_DECIMALS = 6;

/**
 * Where the map opens for a local with no point. `centerLat`/`centerLon`, NOT
 * `lat`/`lon`: this object must stay structurally incompatible with `IMapPoint`
 * so no call can turn the default view into a stored coordinate (ADR 0098,
 * acceptance criterion 5).
 *
 * Zoom 5 and not 6, decided on the width that squeezes: at zoom 6 a 240 px tall
 * map on a 320 px screen shows half the island and Havana falls off the edge.
 */
export const MAP_DEFAULT_VIEW = {
  centerLat: 21.55,
  centerLon: -79.55,
  zoom: 5,
} as const;

/** Zoom used when the local already has a point. Fixed by the design contract. */
export const MAP_POINT_ZOOM = 16;

/** Neither is a provider requirement: its policy states no zoom limit at all. */
export const MAP_MIN_ZOOM = 3;
export const MAP_MAX_ZOOM = 19;

/** The only third-party host this screen is allowed to talk to. */
export const MAP_TILE_HOST = "tile.openstreetmap.org";

/**
 * A tile source and the credit that must be shown with it.
 *
 * A plain interface and not a Zod schema, on purpose and by exception to the
 * repository convention: it is build-time configuration, never external input, and
 * declaring it in `src/schemas/map.ts` would make that module import this one
 * while this one imports it back — a value cycle between two modules that
 * evaluate at load time gives exit 0 on `tsc` and throws when loaded (E-028).
 *
 * The two fields travel TOGETHER and are never passed separately. Serving one
 * provider's tiles under another's credit is a licence breach, and an object is
 * what makes that impossible rather than merely discouraged (ADR 0097).
 */
export interface IMapTileProvider {
  urlTemplate: string;
  attributionHtml: string;
}

/**
 * The built-in provider: the OSMF standard layer, no key, no query string.
 *
 * Attribution is required by the ODbL and by the provider's policy, which says
 * verbatim "Do not hide attribution beneath UI, behind toggles, or off-screen".
 *
 * `target="_blank"` is not cosmetic: a same-tab navigation from here throws away
 * an unsaved draft, and this screen's dirty guard only covers changing local and
 * changing tab.
 */
export const OSMF_TILE_PROVIDER: IMapTileProvider = {
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attributionHtml:
    '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
};

/** `true` when an environment override carries an actual value. */
function isFilled(value: string | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * PURE. The provider in force: the override when BOTH environment values are
 * present and non-blank, `OSMF_TILE_PROVIDER` otherwise.
 *
 * A half override — one value set, the other missing or blank — is IGNORED, and
 * the built-in pair is returned whole. That is the point: a deployment slip must
 * not be able to serve a third party's tiles under OpenStreetMap's credit, or the
 * other way round. Falling back to the licensed pair is deliberate, and its
 * symptom is visible to whoever set the variable: the OSM tiles keep showing.
 *
 * The escape hatch exists because the provider's own policy recommends it — "Avoid
 * hard-coding the tile URL; allow switching without needing a software update" —
 * and because its section 7 warns that access to commercial services may be
 * withdrawn without notice (ADR 0097).
 */
export function resolveTileProvider(
  urlTemplate: string | undefined,
  attributionHtml: string | undefined,
): IMapTileProvider {
  if (!isFilled(urlTemplate) || !isFilled(attributionHtml)) {
    return OSMF_TILE_PROVIDER;
  }
  return { urlTemplate, attributionHtml };
}

export const MAP_TILE_PROVIDER: IMapTileProvider = resolveTileProvider(
  process.env.NEXT_PUBLIC_MAP_TILE_URL_TEMPLATE,
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION_HTML,
);

/**
 * Origin only: no path, no query. NOT "no-referrer" — the provider's policy 3.1
 * forbids a policy that prevents the referer being sent, and on the web path the
 * referer is the application identification it requires, because a page cannot set
 * its own User-Agent (ADR 0097).
 */
export const MAP_TILE_REFERRER_POLICY = "strict-origin";

/**
 * The height of the map slot, per breakpoint. THREE steps, which is why
 * `StoreLocationField` does not take an `isMobile` prop: a boolean can only
 * express two.
 */
export const MAP_HEIGHT = { xs: 240, sm: 320, md: 360 } as const;

/** The anchor every `GlobalStyles` rule and every browser locator hangs off. */
export const MAP_ROOT_CLASS = "cc-store-map";
export const MAP_MARKER_CLASS = "cc-store-map-marker";

/**
 * The marker's hit area. Derived FROM the token, not written as 44: if the tap
 * floor moves, the marker moves with it.
 */
export const MAP_MARKER_ICON_SIZE = touch.min;

/** The visible dot inside that hit area. WCAG 2.2 target-size minimum. */
export const MAP_MARKER_DOT_SIZE = 24;

/** The band the mandatory attribution needs. It has to fit inside the shortest map. */
export const MAP_ATTRIBUTION_BAR_HEIGHT = 24;
