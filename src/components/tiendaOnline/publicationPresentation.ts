import type { PillHue } from "@/components/StatusPill";
import { QAB_PUBLIC_STORE_URL_PREFIX } from "@/constants/qab";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";

export interface IPublicationPresentation {
  label: string;
  hue: PillHue;
  switchLabel: string;
}

/**
 * PURE. How the publication pill and the switch read for one local.
 *
 * It lives in its own module, and not inside `PublicationStatusCard.tsx`, so the
 * suite can load it: the test environment is `node` and the project's tsconfig
 * sets `jsx: "preserve"`, so a `.tsx` cannot be imported from a test at all
 * (`AGENTS.md`, § Testing: components are checked with `tsc` and by hand). Pure
 * logic that decides what the merchant reads does not belong behind that wall.
 *
 * `Sin publicar` and `Despublicado` are different pills on purpose. The first is
 * an initial state and nothing has happened to anybody: `neutral`. The second
 * means there are buyers who USED TO see this local and now do not, which is
 * worth noticing at a glance: `caution`.
 */
export function publicationPresentation(
  local: ITiendaOnlineLocal,
  publicarEnTienda: boolean,
): IPublicationPresentation {
  if (publicarEnTienda) {
    return {
      label: "Publicado",
      hue: "positive",
      switchLabel: "Publicado en la tienda online",
    };
  }
  // "Has been published at least once" is `!firstPublishPending` (some STORE
  // event of this local carried `publishToStore: true`), NOT `slugQab !== null`.
  // Since F-020 the column IS written, so the reason is no longer that it would
  // be false forever: it is ADR 0038's, that these are two different questions —
  // `slugQab` proves the store EXISTS on the other side, and this pill is about
  // the merchant's own permission. And not "an event was emitted" either: every
  // applied PATCH emits, so a local saved but never published would read as
  // `Despublicado` (ADR 0035).
  if (!local.firstPublishPending) {
    return {
      label: "Despublicado",
      hue: "caution",
      switchLabel: "Volver a publicar este local",
    };
  }
  return {
    label: "Sin publicar",
    hue: "neutral",
    switchLabel: "Publicar este local en la tienda online",
  };
}

/* -------------------------------------------------------------------------- */
/* F-020 — two signals for two questions (ADR 0038, E-013, E-014)              */
/* -------------------------------------------------------------------------- */

/**
 * PURE. "Can the address still be changed?" — NO, as soon as a STORE event of
 * this local carried `publishToStore: true`. `slug` is a derivation seed only
 * WHEN CREATING, so from that moment the field does nothing here, and a field
 * you can type into that does nothing is worse than one locked with its reason.
 * It does NOT wait for the assigned value to be known (ADR 0038a).
 */
export function isStoreAddressCommitted(local: ITiendaOnlineLocal): boolean {
  return !local.firstPublishPending;
}

/**
 * PURE. "Does this local exist on the other side, with data that can be
 * deleted?" — the only PROOF cuadrecaja has: since F-020 the column is written
 * only when QAB itself answered `reason: "own"` for that `storeId` (ADR 0037).
 * It is NOT `!firstPublishPending`: that means "it was emitted", not "it was
 * applied", and asserting a data loss on a "probably" would be a false promise
 * (ADR 0038b).
 */
export function isKnownInOnlineStore(local: ITiendaOnlineLocal): boolean {
  return local.slugQab !== null;
}

/** PURE. QAB_PUBLIC_STORE_URL_PREFIX + slug. NEVER the `url` field of a QAB response. */
export function publicStoreUrl(slug: string): string {
  return `${QAB_PUBLIC_STORE_URL_PREFIX}${slug}`;
}

/** PURE. The local's public URL, or `null` when `!isKnownInOnlineStore(local)`. */
export function onlineStoreUrl(local: ITiendaOnlineLocal): string | null {
  // The guard is the IMPORTED definition, never a paraphrase of it (E-014). The
  // cast is what a plain `boolean` guard costs: the contract fixes that return
  // type, so TypeScript cannot narrow the field through it.
  if (!isKnownInOnlineStore(local)) return null;
  return publicStoreUrl(local.slugQab as string);
}

/**
 * PURE. The divergence sentence, or `null` when there is nothing to warn about
 * (not known in the store, no requested slug, or the two values are equal).
 * Copy verbatim from the F-005 design (E-016).
 */
export function assignedSlugNotice(local: ITiendaOnlineLocal): string | null {
  if (!isKnownInOnlineStore(local)) return null;
  const slugQab = local.slugQab as string;
  if (local.slug === null || local.slug === slugQab) return null;
  return `Pediste «${local.slug}» y te asignaron «${slugQab}»: alguien ya tenía la que pediste.`;
}
