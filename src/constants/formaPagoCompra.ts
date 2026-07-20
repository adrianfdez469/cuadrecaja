import { IFormaPagoCompra } from "@/schemas/movimiento";

export const FORMA_PAGO_COMPRA_LABELS: Record<IFormaPagoCompra, string> = {
  EFECTIVO_CAJA: "Efectivo de caja",
  EXTERNO: "Fuente externa (banco, aporte propio)",
  MIXTO: "Mixto (caja + fondeo externo)",
};

export const FORMA_PAGO_COMPRA_DESCRIPTIONS: Record<IFormaPagoCompra, string> =
  {
    EFECTIVO_CAJA:
      "Sale de la caja del negocio — resta del efectivo disponible, no de la ganancia",
    EXTERNO:
      "No sale de la caja registradora (transferencia, aporte propio) — no afecta el efectivo disponible",
    MIXTO:
      "La compra superó el efectivo disponible en caja — se tomó lo disponible y el resto se cubrió con fondeo externo",
  };
