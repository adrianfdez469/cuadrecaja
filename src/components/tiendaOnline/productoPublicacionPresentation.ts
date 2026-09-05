import type { PillHue } from "@/components/StatusPill";
import { QAB_CATALOG_EMISSION_ERRORS } from "@/constants/qab";
import type {
  ITiendaOnlineProducto,
  ITiendaOnlineProductoTienda,
} from "@/schemas/tiendaOnline";
import { formatMontoEnMoneda } from "@/utils/formatters";

/**
 * PURE. Everything the publishing tab decides about what the merchant reads.
 *
 * It lives in its own `.ts` module, and not inside a `.tsx`, so the suite can
 * load it: the test environment is `node` and the project's tsconfig sets
 * `jsx: "preserve"`, so a `.tsx` cannot be imported from a test at all (E-015).
 * Same reason `publicationPresentation.ts` exists.
 */

/**
 * Which icon a pill carries, as a NAME and not as an element: a JSX element
 * would drag this module into a `.tsx` and out of the suite's reach.
 *
 * Only the two `neutral` pills that are NOT `Sin publicar` carry one:
 * `StatusPill` reserves its icon for the rare state whose distinction cannot
 * rest on colour alone, and three neutral pills is exactly that case.
 */
export type IProductoPublicacionIcon = "none" | "storefront" | "linkOff";

export interface IProductoPublicacionPresentation {
  label: string;
  hue: PillHue;
  icon: IProductoPublicacionIcon;
  /** The tinted reason block, or `""` when the state needs none. */
  reason: string;
}

/**
 * PURE. The state ladder, evaluated top down: the first condition that holds
 * wins. The order of the three sync states is `mergeQabProductSyncState`'s own
 * (BLOCKED > FAILED > PENDING) — the screen never invents a precedence.
 *
 * `Esperando al local` and `Sin local` are `neutral` and NOT `caution` on
 * purpose: neither is a failure. `caution` already means «the send failed» here,
 * and tinting an expected outcome with it is exactly what acceptance criterion 7
 * came to prevent.
 *
 * `Despublicado` does not exist for a product: `ITiendaOnlineProducto` carries no
 * equivalent of `firstPublishPending`, so claiming it would assert a fact nobody
 * computed.
 */
export function productoPublicacionPresentation(
  producto: ITiendaOnlineProducto,
): IProductoPublicacionPresentation {
  const { syncState, publicarEnTienda, tiendas } = producto;

  if (syncState.state === "BLOCKED") {
    return {
      label: "No se pudo enviar",
      hue: "negative",
      icon: "none",
      reason: "Se agotaron los intentos de envío a la tienda online.",
    };
  }

  if (syncState.state === "FAILED") {
    return {
      label: "Falló el envío",
      hue: "caution",
      icon: "none",
      reason: "El último envío no se pudo completar; se sigue reintentando.",
    };
  }

  if (syncState.state === "PENDING") {
    return { label: "Enviando", hue: "info", icon: "none", reason: "" };
  }

  if (!publicarEnTienda) {
    return { label: "Sin publicar", hue: "neutral", icon: "none", reason: "" };
  }

  if (tiendas.length === 0) {
    return {
      label: "Sin local",
      hue: "neutral",
      icon: "linkOff",
      reason:
        "Está marcado, pero no existe en ningún local, así que no hay nada que enviar.",
    };
  }

  if (!tiendas.some((tienda) => tienda.tiendaPublicada)) {
    return {
      label: "Esperando al local",
      hue: "neutral",
      icon: "storefront",
      reason:
        "Ya está marcado. Se va a ver cuando publiques el local en la tienda online.",
    };
  }

  return { label: "Publicado", hue: "positive", icon: "none", reason: "" };
}

/**
 * PURE. `Se ve en {K} de {M} locales.` when the product is marked and SOME but
 * not all of its locals are published; `null` otherwise.
 *
 * One form, no singular branch: this case requires `M >= 2` by construction, so
 * `locales` is never singular.
 */
export function visibilidadParcialLine(
  producto: ITiendaOnlineProducto,
): string | null {
  if (!producto.publicarEnTienda) return null;

  const total = producto.tiendas.length;
  const publicadas = producto.tiendas.filter(
    (tienda) => tienda.tiendaPublicada,
  ).length;

  if (publicadas === 0 || publicadas === total) return null;
  return `Se ve en ${publicadas} de ${total} locales.`;
}

/** The em dash shown when a product is in no local at all. */
export const PRECIO_SIN_LOCAL = "—";

/** What is written when the locals disagree on the currency, not just the price. */
export const PRECIO_MONEDAS_DISTINTAS = "Precios distintos por local";

/**
 * PURE. The price line of one product.
 *
 * A product can live in several locals at several prices. `formatMontoEnMoneda`
 * is the formatter the rest of the application already uses, and NOTHING is
 * rounded here: rounding to two decimals belongs to the payload, and doing it
 * again on screen would create a second definition of the same number.
 */
export function precioLine(tiendas: ITiendaOnlineProductoTienda[]): string {
  if (tiendas.length === 0) return PRECIO_SIN_LOCAL;

  const monedas = new Set(tiendas.map((tienda) => tienda.monedaCode));
  if (monedas.size > 1) return PRECIO_MONEDAS_DISTINTAS;

  const moneda = tiendas[0].monedaCode;
  const precios = tiendas.map((tienda) => tienda.precio);
  const min = Math.min(...precios);
  const max = Math.max(...precios);

  if (min === max) return formatMontoEnMoneda(min, moneda);
  return `${formatMontoEnMoneda(min, moneda)} – ${formatMontoEnMoneda(max, moneda)}`;
}

/** The sentence a `code` of the 409 gets. A value with no row falls into the last. */
const PAYLOAD_REJECTED_SENTENCES: Record<string, string> = {
  [QAB_CATALOG_EMISSION_ERRORS.priceInvalid]:
    "Hay un precio que la tienda online no acepta.",
  [QAB_CATALOG_EMISSION_ERRORS.currencyCodeInvalid]:
    "Hay una moneda que la tienda online no reconoce.",
  [QAB_CATALOG_EMISSION_ERRORS.exchangeRateTooSmall]:
    "La tasa de cambio registrada es demasiado pequeña para la tienda online.",
};

const PAYLOAD_REJECTED_FALLBACK = "La tienda online no aceptó estos datos.";

/** Which action was refused, which decides the tail of the sentence. */
export type IPublicacionScope = "producto" | "categoria";

const PAYLOAD_REJECTED_TAILS: Record<IPublicacionScope, string> = {
  producto: "El producto se quedó como estaba.",
  categoria: "Ninguno de los productos cambió.",
};

/**
 * PURE. The 409 turned into a sentence the merchant can act on. The raw `code`
 * NEVER reaches the screen and neither does `productoTiendaId`: a uuid tells
 * nobody anything (ADR 0034).
 */
export function payloadRejectedMessage(
  code: string,
  scope: IPublicacionScope,
): string {
  const sentence = PAYLOAD_REJECTED_SENTENCES[code] ?? PAYLOAD_REJECTED_FALLBACK;
  return `${sentence} ${PAYLOAD_REJECTED_TAILS[scope]}`;
}

/**
 * PURE. What the merchant is told after ONE switch was applied.
 *
 * Three branches for «se marcó», because they are the three realities of the
 * ladder above: a single vague message would be vague exactly where the merchant
 * needs to know what happened. No branch promises immediacy — the cron runs
 * every two minutes.
 */
export function productoPublicacionMessage(
  producto: ITiendaOnlineProducto,
): string {
  if (!producto.publicarEnTienda) {
    return `Se quitó «${producto.nombre}» de la tienda online. El cambio llega en unos minutos.`;
  }
  if (producto.tiendas.length === 0) {
    return `Se marcó «${producto.nombre}». Todavía no está en ningún local, así que no se envió nada a la tienda online.`;
  }
  if (!producto.tiendas.some((tienda) => tienda.tiendaPublicada)) {
    return `Se marcó «${producto.nombre}». Se va a ver cuando publiques el local en la tienda online.`;
  }
  return `Se marcó «${producto.nombre}». Llega a tu tienda online en unos minutos.`;
}

/**
 * PURE. What the merchant is told after a bulk action.
 *
 * Head, middle and tail, joined by a single space. The middle branch exists
 * because the dialog announced `total` and the response returns another figure:
 * without it, someone who confirmed twelve and read seven would think five
 * failed. `eventos` is NEVER shown — it counts outbox rows, bootstrap events
 * included, and with several locals it does not match the number of products.
 */
export function bulkPublicacionMessage(args: {
  productos: number;
  total: number;
  categoriaNombre: string;
  publicar: boolean;
}): string {
  const { productos, total, categoriaNombre, publicar } = args;

  if (productos === 0) {
    return `No hubo nada que cambiar: los productos de «${categoriaNombre}» ya estaban así.`;
  }

  const head =
    productos === 1
      ? publicar
        ? "Se marcó 1 producto."
        : "Se quitó 1 producto."
      : publicar
        ? `Se marcaron ${productos} productos.`
        : `Se quitaron ${productos} productos.`;

  const middle = productos < total ? " Los demás ya estaban así." : "";

  return `${head}${middle} Los cambios llegan a tu tienda online en unos minutos.`;
}

/**
 * PURE. The count line of the category strip. Two branches, and both are
 * written: a single form ends up saying «1 productos» (E-016).
 */
export function categoriaStripCount(
  categoriaNombre: string,
  total: number,
): string {
  return total === 1
    ? `«${categoriaNombre}» · 1 producto`
    : `«${categoriaNombre}» · ${total} productos`;
}

/**
 * PURE. The title of the bulk-action confirmation. Same two branches, same
 * reason.
 */
export function bulkDialogTitle(total: number, publicar: boolean): string {
  const verb = publicar ? "Publicar" : "Quitar";
  const preposition = publicar ? "en" : "de";
  return total === 1
    ? `${verb} 1 producto ${preposition} la tienda online`
    : `${verb} ${total} productos ${preposition} la tienda online`;
}
