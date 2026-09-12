import {
  QAB_AMOUNT_MAX_INTEGER_DIGITS,
  QAB_ORDER_EXPIRY_HOURS_DEFAULT,
  QAB_ORDER_EXPIRY_HOURS_MAX,
  QAB_ORDER_EXPIRY_HOURS_MIN,
} from "@/constants/qab";
import type {
  IQabCheckoutMode,
  IQabDeliveryFeeMode,
  IQabPurchaseConfigIssueCode,
} from "@/schemas/qabStorePurchaseConfig";

/**
 * The Spanish the merchant reads for the purchase configuration. Presentation
 * only: no rule is decided here, and no issue code ever reaches the screen.
 *
 * Same precedent as `openingHoursCopy.ts`: a `Record` TYPED over the closed
 * vocabulary, so a code added without a sentence is a compile error instead of a
 * mute screen.
 */

/** One sentence per broken rule. Keyed over the whole vocabulary on purpose. */
export const PURCHASE_CONFIG_ISSUE_MESSAGES: Record<
  IQabPurchaseConfigIssueCode,
  string
> = {
  DELIVERY_FEE_NOT_A_NUMBER:
    "La tarifa tiene que ser un número. Déjala vacía si no cobras envío.",
  DELIVERY_FEE_NEGATIVE:
    "La tarifa no puede ser negativa. Usa 0 si el envío es gratis.",
  DELIVERY_FEE_TOO_MANY_DECIMALS: "La tarifa admite como máximo dos decimales.",
  // The bound is NOT printed as 999999999999.99: that number is not read, it is
  // counted with a finger. The digit count is the same limit said in a way the
  // merchant can check by looking at the field.
  DELIVERY_FEE_TOO_LARGE: `La tarifa es demasiado alta: como mucho ${QAB_AMOUNT_MAX_INTEGER_DIGITS} cifras antes de los decimales.`,
  ORDER_EXPIRY_HOURS_NOT_AN_INTEGER:
    "Las horas tienen que ser un número entero, sin decimales. No puede quedar vacío.",
  ORDER_EXPIRY_HOURS_OUT_OF_RANGE: `Las horas tienen que estar entre ${QAB_ORDER_EXPIRY_HOURS_MIN} y ${QAB_ORDER_EXPIRY_HOURS_MAX}.`,
  DELIVERY_CONFIG_INCONSISTENT:
    "Ofreces domicilio con tarifa fija, así que necesitas un importe. Pon la tarifa o cambia el modo de envío.",
};

/** The two checkout options, in the order the card stacks them. */
export const CHECKOUT_MODE_LABELS: Record<IQabCheckoutMode, string> = {
  WHATSAPP: "Con botón de WhatsApp",
  ONSITE: "Sin botón de WhatsApp",
};

/**
 * What each checkout option actually does. Both end by saying the order arrives
 * anyway: without it, «Sin botón de WhatsApp» reads as «me quedo sin pedidos»,
 * which is false — the button is optional for the buyer, the order is already
 * placed whether they use it or not.
 */
export const CHECKOUT_MODE_DESCRIPTIONS: Record<IQabCheckoutMode, string> = {
  WHATSAPP:
    "Al confirmar, el comprador ve un botón para escribirte por WhatsApp. Usarlo es opcional para él: el pedido te llega igual.",
  ONSITE:
    "Al confirmar, el comprador no ve ese botón. El pedido te llega igual y lo cierras en el local.",
};

/** The two delivery-fee options. There is no third one: ZONE_BASED is F-042. */
export const DELIVERY_FEE_MODE_LABELS: Record<IQabDeliveryFeeMode, string> = {
  FLAT_RATE: "Tarifa fija",
  QUOTED_PER_ORDER: "La cotizo en cada pedido",
};

/** The helper under the mode selector, which changes with the chosen value. */
export const DELIVERY_FEE_MODE_HELPERS: Record<IQabDeliveryFeeMode, string> = {
  FLAT_RATE:
    "Todos los pedidos a domicilio cobran el mismo importe: el que pongas aquí abajo.",
  QUOTED_PER_ORDER:
    "El importe lo pones tú al gestionar cada pedido. La tarifa fija que tengas guardada no se cobra.",
};

/* -- Fixed copy of the card. Dictated by the design contract (E-016). ------ */

export const PURCHASE_CONFIG_CARD_TITLE = "Cómo se compra en este local";
export const PURCHASE_CONFIG_CARD_SUBTITLE =
  "Lo que ve el comprador al terminar su pedido, y cómo se le cobra la entrega.";

export const CHECKOUT_SECTION_LABEL = "AL CONFIRMAR EL PEDIDO";
export const DELIVERY_SECTION_LABEL = "ENTREGA A DOMICILIO";
export const EXPIRY_SECTION_LABEL = "VENCIMIENTO DE LAS PROPUESTAS";

export const DELIVERY_ENABLED_LABEL = "Ofrezco entrega a domicilio";
export const DELIVERY_DISABLED_HELP =
  "Con el domicilio apagado, todos los pedidos se tratan como recogida en el local.";
export const DELIVERY_FEE_KEPT_NOTE =
  "Tu tarifa guardada no se borra: vuelve a aparecer cuando enciendas el domicilio.";

export const DELIVERY_FEE_MODE_LABEL = "Cómo se calcula el envío";
export const DELIVERY_FEE_LABEL = "Tarifa de envío";
export const DELIVERY_FEE_HELP =
  "Como máximo dos decimales. Usa 0 si el envío es gratis.";

export const ORDER_EXPIRY_HOURS_LABEL = "Horas que dura una propuesta";
export const ORDER_EXPIRY_HOURS_HELP = `Entre ${QAB_ORDER_EXPIRY_HOURS_MIN} y ${QAB_ORDER_EXPIRY_HOURS_MAX} horas. Por defecto, ${QAB_ORDER_EXPIRY_HOURS_DEFAULT}.`;
export const ORDER_EXPIRY_HOURS_NOTE =
  "Este mismo número decide cuánto vive un pedido cuyo envío nadie cotizó, contado desde que se creó. Son dos plazos distintos y se suman: si cotizas justo antes del límite, el comprador todavía tiene ese mismo plazo para responderte.";

/** Toast shown when the guard inside `persist` stops a save. */
export const PURCHASE_CONFIG_GUARD_TOAST =
  "Revisa la configuración de compra antes de guardar.";

/**
 * «1 problema» / «N problemas», and the ONE place the agreement is written.
 *
 * Exported because the sticky bar says it three times — once for this card, once
 * for the schedule of F-005 — and three copies of one ternary is how «1
 * problemas» gets shipped by whoever edits only two of them.
 */
export function problemaCount(count: number): string {
  return `${count} ${count === 1 ? "problema" : "problemas"}`;
}

/** Heading of the summary block. */
export function purchaseConfigSummaryTitle(count: number): string {
  return `No se puede guardar: la configuración de compra tiene ${problemaCount(count)}.`;
}

/** The sticky bar's line. The same sentence, without the full stop. */
export function purchaseConfigBarText(count: number): string {
  return `La configuración de compra tiene ${problemaCount(count)}`;
}
