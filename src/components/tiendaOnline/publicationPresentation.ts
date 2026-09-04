import type { PillHue } from "@/components/StatusPill";
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
  // event of this local carried `publishToStore: true`), NOT `slugQab !== null`:
  // QAB owns that column and this feature never writes it, so it would be false
  // forever. And not "an event was emitted" either: every applied PATCH emits,
  // so a local saved but never published would read as `Despublicado` (ADR 0035).
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
