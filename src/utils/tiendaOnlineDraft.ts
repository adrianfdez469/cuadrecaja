import type { IOpeningHours } from "@/schemas/qabOpeningHours";
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
  };
}

/** Which of the nine the merchant left empty. Drives the «it will be deleted» copy. */
export function emptyContactFields(draft: ITiendaOnlineDraft): IContactField[] {
  return CONTACT_FIELDS.filter((field) => draft[field].trim().length === 0);
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
