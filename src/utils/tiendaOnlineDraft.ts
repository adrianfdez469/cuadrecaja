import {
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
  MAP_COORDINATE_DECIMALS,
} from "@/constants/map";
import { QAB_AMOUNT_DECIMALS, QAB_DELIVERY_FEE_MAX_EXCLUSIVE } from "@/constants/qab";
import type { IMapPoint } from "@/schemas/map";
import { hasQabScale } from "@/schemas/qabDecimals";
import type { IOpeningHours } from "@/schemas/qabOpeningHours";
import {
  isQabOrderExpiryHours,
  isQabPurchaseConfigInconsistent,
} from "@/schemas/qabStorePurchaseConfig";
import type {
  IQabCheckoutMode,
  IQabDeliveryFeeMode,
  IQabPurchaseConfigIssue,
} from "@/schemas/qabStorePurchaseConfig";
import type {
  ITiendaOnlineLocal,
  ITiendaOnlineLocalUpdate,
} from "@/schemas/tiendaOnline";

/**
 * The form's own shape.
 *
 * Every text field is a `string`, empty included, because that is what a
 * controlled input holds. The two coordinates are strings too: while somebody
 * types `-23.1` the value goes through `-` and `-23.`, and neither is a number
 * yet. The translation to the wire's `null`s happens in one place, on the way
 * out — `draftToUpdate`.
 */
export interface ITiendaOnlineDraft {
  publicarEnTienda: boolean;
  slug: string;
  descripcion: string;
  direccion: string;
  ciudad: string;
  provincia: string;
  latitud: string;
  longitud: string;
  telefono: string;
  whatsapp: string;
  email: string;
  /** `null` means «no calendar», which is NOT the same as seven closed days. */
  horarios: IOpeningHours | null;
  motivoDespublicacion: string;
  /* -- Purchase configuration (F-016). --------------------------------- */
  checkoutMode: IQabCheckoutMode;
  deliveryEnabled: boolean;
  /** A STRING, like every other numeric field here: `12.` is not a number yet. */
  deliveryFee: string;
  deliveryFeeMode: IQabDeliveryFeeMode;
  /** A STRING for the same reason. Blank is NOT zero: see `toNumberOrNaN`. */
  orderExpiryHours: string;
}

/** The nine fields the buyer sees, in the order the card lays them out. */
export const CONTACT_FIELD_LABELS = {
  descripcion: "Descripción",
  direccion: "Dirección",
  ciudad: "Ciudad",
  provincia: "Provincia",
  latitud: "Latitud",
  longitud: "Longitud",
  telefono: "Teléfono",
  whatsapp: "WhatsApp",
  email: "Correo",
} as const;

export type IContactField = keyof typeof CONTACT_FIELD_LABELS;

export const CONTACT_FIELDS: IContactField[] = [
  "descripcion",
  "direccion",
  "ciudad",
  "provincia",
  "latitud",
  "longitud",
  "telefono",
  "whatsapp",
  "email",
];

function text(value: string | null): string {
  return value ?? "";
}

function numberText(value: number | null): string {
  return value === null ? "" : String(value);
}

export function draftFromLocal(local: ITiendaOnlineLocal): ITiendaOnlineDraft {
  return {
    publicarEnTienda: local.publicarEnTienda,
    slug: text(local.slug),
    descripcion: text(local.descripcion),
    direccion: text(local.direccion),
    ciudad: text(local.ciudad),
    provincia: text(local.provincia),
    latitud: numberText(local.latitud),
    longitud: numberText(local.longitud),
    telefono: text(local.telefono),
    whatsapp: text(local.whatsapp),
    email: text(local.email),
    horarios: local.horarios,
    motivoDespublicacion: text(local.motivoDespublicacion),
    checkoutMode: local.checkoutMode,
    deliveryEnabled: local.deliveryEnabled,
    deliveryFee: numberText(local.deliveryFee),
    deliveryFeeMode: local.deliveryFeeMode,
    orderExpiryHours: String(local.orderExpiryHours),
  };
}

/** A trimmed value, or `null` when the merchant left it empty. */
function toNullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/** A finite number, or `null`. Half a coordinate is not a coordinate. */
function toNullableNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A number, or `NaN` when the merchant left the field empty.
 *
 * NOT `toNullableNumber`, and NOT `Number(value)` either: `Number("")` is `0`,
 * and `0` is a value `orderExpiryHours` rejects for a reason of its own. Blank
 * has to reach the schema as something that cannot be mistaken for an hour
 * count, so the request is refused instead of silently saving zero.
 */
function toNumberOrNaN(value: string): number {
  const trimmed = value.trim();
  if (trimmed.length === 0) return Number.NaN;
  return Number(trimmed);
}

/**
 * The PATCH body. A FULL REPLACEMENT, never a partial: what is not sent gets
 * cleared, both here and one step later on the other side (ADR 0032).
 */
export function draftToUpdate(
  draft: ITiendaOnlineDraft,
): ITiendaOnlineLocalUpdate {
  return {
    publicarEnTienda: draft.publicarEnTienda,
    slug: toNullable(draft.slug),
    descripcion: toNullable(draft.descripcion),
    direccion: toNullable(draft.direccion),
    ciudad: toNullable(draft.ciudad),
    provincia: toNullable(draft.provincia),
    latitud: toNullableNumber(draft.latitud),
    longitud: toNullableNumber(draft.longitud),
    telefono: toNullable(draft.telefono),
    whatsapp: toNullable(draft.whatsapp),
    email: toNullable(draft.email),
    horarios: draft.horarios,
    motivoDespublicacion: toNullable(draft.motivoDespublicacion),
    checkoutMode: draft.checkoutMode,
    deliveryEnabled: draft.deliveryEnabled,
    // ALWAYS sent, whether the screen painted the two controls or not: that is
    // what makes hiding them harmless — the delta compares two persisted states
    // of the row, so an untouched value is simply not a change (ADR ADRIAN-0152).
    deliveryFee: toNullableNumber(draft.deliveryFee),
    deliveryFeeMode: draft.deliveryFeeMode,
    orderExpiryHours: toNumberOrNaN(draft.orderExpiryHours),
  };
}

/** Which of the nine the merchant left empty. Drives the «it will be deleted» copy. */
export function emptyContactFields(draft: ITiendaOnlineDraft): IContactField[] {
  return CONTACT_FIELDS.filter((field) => draft[field].trim().length === 0);
}

/**
 * The count banner's second sentence. Fixed copy, dictated by the F-005 design
 * and repeated verbatim in the F-020 interface contract (E-016).
 */
const EMPTY_FIELDS_CLOSING_SENTENCE =
  "La tienda online no distingue «no lo toques» de «bórralo»: lo que quede vacío aquí desaparece de allá en el próximo envío.";

/**
 * PURE. The count banner's sentence, or `null` when nothing is empty. Lives here
 * so the suite can pin the exact copy, which a `.tsx` would put out of reach
 * (E-015).
 *
 * The singular branch is the human's own correction inside F-020: the dictated
 * plural read "1 datos están vacíos" for a single field, which is the state of
 * whoever filled eight of nine and the most dangerous case of all. Only what
 * agreement forces changes; the plural is untouched.
 */
export function emptyContactFieldsNotice(
  draft: ITiendaOnlineDraft,
): string | null {
  const empty = emptyContactFields(draft);
  if (empty.length === 0) return null;

  const names = empty.map((field) => CONTACT_FIELD_LABELS[field]).join(", ");
  const lead =
    empty.length === 1
      ? "1 dato está vacío y se va a borrar de tu tienda online"
      : `${empty.length} datos están vacíos y se van a borrar de tu tienda online`;

  return `${lead}: ${names}. ${EMPTY_FIELDS_CLOSING_SENTENCE}`;
}

/* -------------------------------------------------------------------------- */
/* F-016 — the form's half of the purchase-configuration invariant             */
/* -------------------------------------------------------------------------- */

/** The amount the draft currently describes: `null` when the field is blank. */
function draftDeliveryFee(draft: ITiendaOnlineDraft): number | null {
  const trimmed = draft.deliveryFee.trim();
  return trimmed.length === 0 ? null : Number(trimmed);
}

/** At most ONE broken rule of `deliveryFee`, in the fixed order, or `null`. */
function deliveryFeeIssueCode(
  value: number | null,
): IQabPurchaseConfigIssue["code"] | null {
  // Blank is NOT an infraction: it means «no amount», which is legitimate while
  // delivery is off or the mode is quoted.
  if (value === null) return null;
  if (!Number.isFinite(value)) return "DELIVERY_FEE_NOT_A_NUMBER";
  if (value < 0) return "DELIVERY_FEE_NEGATIVE";
  if (!hasQabScale(value, QAB_AMOUNT_DECIMALS)) {
    return "DELIVERY_FEE_TOO_MANY_DECIMALS";
  }
  if (value >= QAB_DELIVERY_FEE_MAX_EXCLUSIVE) return "DELIVERY_FEE_TOO_LARGE";
  return null;
}

/** At most ONE broken rule of `orderExpiryHours`, or `null`. */
function orderExpiryHoursIssueCode(
  value: number,
): IQabPurchaseConfigIssue["code"] | null {
  // Blank arrives here as NaN (`toNumberOrNaN`), so it falls in with «not an
  // integer» instead of passing as the zero `Number("")` would produce.
  if (!Number.isInteger(value)) return "ORDER_EXPIRY_HOURS_NOT_AN_INTEGER";
  if (!isQabOrderExpiryHours(value)) return "ORDER_EXPIRY_HOURS_OUT_OF_RANGE";
  return null;
}

/**
 * PURE. Every rule the purchase configuration breaks, in a fixed order, empty
 * when there is none. The form's half of acceptance criteria 6, 7 and 8: the
 * screen calls it BEFORE the save, so a rejected draft never becomes a request.
 */
export function collectPurchaseConfigIssues(
  draft: ITiendaOnlineDraft,
): IQabPurchaseConfigIssue[] {
  const issues: IQabPurchaseConfigIssue[] = [];

  const fee = draftDeliveryFee(draft);
  const feeCode = deliveryFeeIssueCode(fee);
  if (feeCode !== null) issues.push({ code: feeCode, field: "deliveryFee" });

  const hoursCode = orderExpiryHoursIssueCode(
    toNumberOrNaN(draft.orderExpiryHours),
  );
  if (hoursCode !== null) {
    issues.push({ code: hoursCode, field: "orderExpiryHours" });
  }

  // ONLY when the amount itself is fine: an unreadable amount is already being
  // reported under that same field, and two sentences in one place say less than
  // one. Anchored to `deliveryFee` because that is where the merchant acts.
  if (
    feeCode === null &&
    isQabPurchaseConfigInconsistent({
      deliveryEnabled: draft.deliveryEnabled,
      deliveryFeeMode: draft.deliveryFeeMode,
      deliveryFee: fee,
    })
  ) {
    issues.push({ code: "DELIVERY_CONFIG_INCONSISTENT", field: "deliveryFee" });
  }

  return issues;
}

/** One coordinate without the other draws no point on any map. */
export function hasLonelyCoordinate(draft: ITiendaOnlineDraft): boolean {
  const lat = draft.latitud.trim().length > 0;
  const lon = draft.longitud.trim().length > 0;
  return lat !== lon;
}

/** `true` when there is nothing for the buyer to reach the store by. */
export function hasNoContactAtAll(draft: ITiendaOnlineDraft): boolean {
  return (
    draft.direccion.trim().length === 0 &&
    draft.telefono.trim().length === 0 &&
    draft.whatsapp.trim().length === 0
  );
}

/* -------------------------------------------------------------------------- */
/* F-025 — the draft is the only owner of the coordinate (ADR 0098)            */
/* -------------------------------------------------------------------------- */

/**
 * The coordinate rounded to `MAP_COORDINATE_DECIMALS`.
 *
 * Exported so the suite can pin it alone. `Number(v.toFixed(6))` cannot produce a
 * non-zero magnitude below 1e-6, and JavaScript only switches `String` to
 * exponential notation below 1e-6, so for every value in [-180, 180] the text
 * this feeds into the draft stays plain decimal.
 *
 * The `+ 0` collapses a negative zero into a positive one: a click just west of
 * Greenwich rounds to `-0`, and two drafts that differ only by that sign are the
 * same place.
 */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(MAP_COORDINATE_DECIMALS)) + 0;
}

/**
 * The point the draft currently describes, or `null` when it describes none.
 *
 * THE ONLY reader of `latitud`/`longitud` for map purposes. Returns `null` when
 * either string is blank, when either does not parse to a finite number, or when
 * either falls outside its range — so an out-of-range value typed by hand draws
 * no marker, which is the honest answer, since `tiendaOnlineLocalUpdateSchema`
 * would reject it with a 400 on save anyway.
 *
 * Its relation to `hasLonelyCoordinate`, stated here so implementation and tests
 * cannot disagree about it: whenever `hasLonelyCoordinate(draft)` is `true` this
 * returns `null` — but NOT only then. It also returns `null` for both-blank, for
 * unparseable and for out-of-range. Neither is the inverse of the other.
 */
export function draftToMapPoint(draft: ITiendaOnlineDraft): IMapPoint | null {
  const lat = toNullableNumber(draft.latitud);
  const lon = toNullableNumber(draft.longitud);
  if (lat === null || lon === null) return null;
  if (lat < LATITUDE_MIN || lat > LATITUDE_MAX) return null;
  if (lon < LONGITUDE_MIN || lon > LONGITUDE_MAX) return null;
  return { lat, lon };
}

/**
 * A new draft carrying `point` as its two coordinates, rounded.
 *
 * THE ONLY writer of `latitud`/`longitud` from the map. It takes an `IMapPoint`,
 * and neither `MAP_DEFAULT_VIEW` nor `IMapView` is assignable to that: this
 * signature is the compile-time half of acceptance criterion 5 (ADR 0098).
 *
 * The two strings it produces are in the same textual form `draftFromLocal`
 * rebuilds from the saved row — `String(number)` on both sides — so the save bar
 * goes away after a save instead of staying up over a draft that only LOOKS
 * different from the stored one.
 *
 * Every other field of `draft` is carried through untouched.
 */
export function applyMapPointToDraft(
  draft: ITiendaOnlineDraft,
  point: IMapPoint,
): ITiendaOnlineDraft {
  return {
    ...draft,
    latitud: String(roundCoordinate(point.lat)),
    longitud: String(roundCoordinate(point.lon)),
  };
}

/**
 * A new draft with both coordinates blank, i.e. back to "no point at all".
 *
 * The state acceptance criterion 5 describes is not only an initial state: it has
 * to stay reachable, or one mis-click becomes permanent. Every other field is
 * carried through untouched.
 */
export function clearMapPointFromDraft(
  draft: ITiendaOnlineDraft,
): ITiendaOnlineDraft {
  return { ...draft, latitud: "", longitud: "" };
}
