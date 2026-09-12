import { collectOpeningHoursIssues } from "@/schemas/qabOpeningHours";
import type {
  IOpeningHours,
  IOpeningHoursIssue,
} from "@/schemas/qabOpeningHours";
import { toQabCurrencyCodeOrNull } from "@/schemas/qabCurrency";
import { isQabPurchaseConfigInconsistent } from "@/schemas/qabStorePurchaseConfig";
import { qabStorePayloadSchema } from "@/schemas/qabStore";
import type {
  IQabStorePayload,
  IQabStorePayloadInput,
} from "@/schemas/qabStore";

/** Raised when `horarios` holds a value that would fail the whole STORE event. */
export class QabStorePayloadError extends Error {
  readonly issues: IOpeningHoursIssue[];

  constructor(issues: IOpeningHoursIssue[]) {
    super("Stored opening hours would be rejected by the online store");
    this.name = "QabStorePayloadError";
    this.issues = issues;
  }
}

/**
 * Raised when the payload about to be emitted would be contradictory on its own:
 * delivery offered, flat rate, and `deliveryFee: null`, all three in the SAME
 * event.
 *
 * Thrown INSIDE the mutation's transaction, so it rolls the write back — the
 * same net `QabStorePayloadError` is for an invalid calendar. Unreachable from
 * the screen, because the PATCH body schema rejects it first; it exists so a
 * future caller cannot reach it either.
 */
export class QabStorePurchaseConfigError extends Error {
  constructor() {
    super("Purchase configuration would be rejected by the online store");
    this.name = "QabStorePurchaseConfigError";
  }
}

/** `null` and `undefined` both mean "no calendar configured". */
function hasCalendar(horarios: unknown): boolean {
  return horarios !== null && horarios !== undefined;
}

/**
 * PURE. Builds the whole payload from the row that is already persisted, and
 * returns it already parsed by `qabStorePayloadSchema`.
 *
 * Throws `QabStorePayloadError` when `horarios` is neither empty nor a valid
 * calendar. Called inside the mutation's transaction, so that throw rolls the
 * write back: an invalid calendar can never reach OutboxEvento, not even through
 * a caller that forgot to validate.
 */
export function buildQabStorePayload(
  input: IQabStorePayloadInput,
): IQabStorePayload {
  let openingHours: IOpeningHours | undefined;

  if (hasCalendar(input.horarios)) {
    const issues = collectOpeningHoursIssues(input.horarios);
    if (issues.length > 0) throw new QabStorePayloadError(issues);
    openingHours = input.horarios as IOpeningHours;
  }

  // The contradiction is only visible when the three keys travel TOGETHER, which
  // is exactly what this delta may or may not carry. A key that is absent is
  // `undefined`, and `undefined === null` is false, so a partial delta never
  // trips this net — that case is QAB's to detect against its own stored row,
  // and it comes back as STORE_DELIVERY_CONFIG_INCONSISTENT inside a 207.
  if (isQabPurchaseConfigInconsistent(input.purchaseConfigChanges)) {
    throw new QabStorePurchaseConfigError();
  }

  // The nine contact fields are spelled out one by one, always, even when null:
  // on the other side they are written with `payload.x ?? null`, so a key that
  // is not here CLEARS the column. `openingHours` is the opposite and is the
  // only key that may be absent — hence the conditional spread, which drops the
  // key entirely rather than sending `undefined`.
  return qabStorePayloadSchema.parse({
    storeId: input.tiendaId,
    businessId: input.negocioId,
    businessName: input.negocioNombre,
    name: input.nombre,
    slug: input.slug,
    description: input.descripcion,
    address: input.direccion,
    city: input.ciudad,
    province: input.provincia,
    latitude: input.latitud,
    longitude: input.longitud,
    phone: input.telefono,
    whatsapp: input.whatsapp,
    email: input.email,
    // `Negocio.monedaBase`, dropped entirely when it is not a wire-shaped code:
    // the contract defaults an absent `baseCurrency` to CUP, and a malformed base
    // currency must not stop a local from publishing. The conditional spread drops
    // the key rather than sending `undefined`, exactly like `openingHours`.
    ...(toQabCurrencyCodeOrNull(input.monedaBase) === null
      ? {}
      : { baseCurrency: input.monedaBase }),
    ...(openingHours === undefined ? {} : { openingHours }),
    // «Omitir no es apagar»: the five purchase-configuration keys travel ONLY
    // when they changed in this operation, and a spread of an empty delta adds
    // nothing — so a routine save emits the very same payload F-005 emitted
    // (ADR ADRIAN-0152).
    ...input.purchaseConfigChanges,
    publishToStore: input.publicarEnTienda,
    // The contract ignores `unpublishReason` while the store is published, and
    // sending a stale one back would be noise on the other side's audit trail.
    unpublishReason: input.publicarEnTienda ? null : input.motivoDespublicacion,
    updatedAt: input.occurredAt.toISOString(),
    // No `timezone`: it is a column the online store's own panel owns, and the
    // POS has no way to write it. Inside `openingHours` it would reject the
    // whole event; at the root it is discarded. `.strict()` makes it impossible.
  });
}
