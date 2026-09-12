"use client";

import React from "react";
import { Box } from "@mui/material";
import {
  CREDITO_ESTADO_HUE,
  CREDITO_ESTADO_LABEL,
  VENTA_CREDITO_COPY,
  VENTA_CREDITO_DOM,
} from "@/constants/ventaCredito";
import type { IVentaCreditoEstado } from "@/lib/cuentasPorCobrar/ventaCreditoEstado";

export interface CreditoEstadoChipProps {
  estado: IVentaCreditoEstado;
  /** Live balance, base currency. The chip may show it; it never derives the state from it. */
  saldoPendiente?: number;
  monedaBase?: string;
  size?: "small" | "medium";
}

/**
 * `StatusPill`'s exact treatment — the hue's wash behind the hue's own ink, 22 px tall, 0.75 rem,
 * weight 600, pill radius — on ONE element instead of MUI's `Chip` root + `<span class="label">`
 * pair.
 *
 * The single node is not a style preference: design criterion 6 locates this pill by the element
 * whose OWN TEXT is the label and requires that element to carry
 * `VENTA_CREDITO_DOM.chip`, while criterion 8 reads `background-color` off that same element and
 * criterion 5 counts the class once per credit sale. A `Chip` puts the text in a child span and
 * the wash on the parent, so no single class placement can satisfy the three at once. Merging
 * them does, and the rendered pill is visually the one the design asked for.
 */
const PILL_SX = {
  display: "inline-flex",
  alignItems: "center",
  height: 22,
  px: 1,
  borderRadius: 999,
  fontSize: "0.75rem",
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
} as const;

/** `"medium"` is the same pill, taller. F-037 never passes `size`; F-038 may. */
const MEDIUM_SX = { height: 28, fontSize: "0.8125rem" } as const;

/**
 * The credit state of a sale, as a tinted pill. Created by F-037 and SHARED with the online
 * order tray of F-038 from day one — "no se escriben dos" (dosier § 4), which is why it lives in
 * `src/components/credito/` and not under `src/app/ventas/`.
 *
 * It holds NO logic worth testing, on purpose (E-015: nothing of a `.tsx` is importable from a
 * test). The state is resolved by `resolveVentaCreditoEstado`, the label comes from
 * `CREDITO_ESTADO_LABEL`, the ink from `CREDITO_ESTADO_HUE` and the text from
 * `VENTA_CREDITO_COPY` — all four in `.ts` modules with their own cases in the contract's
 * testability list.
 *
 * With `SIN_CREDITO` it renders NOTHING — not an empty `Box`, not a reserved gap: a cash sale
 * carries no mark (criterion 1), and an invisible node would break any absence check by count.
 *
 * It does NOT compute the state and does NOT derive it from the balance it receives, not even to
 * pick the ink: with a `saldoPendiente` and no `estado` it would paint nothing.
 */
export const CreditoEstadoChip: React.FC<Readonly<CreditoEstadoChipProps>> = ({
  estado,
  saldoPendiente,
  monedaBase,
  size = "small",
}) => {
  const label = CREDITO_ESTADO_LABEL[estado];
  const hue = CREDITO_ESTADO_HUE[estado];
  if (label === null || hue === null) return null;

  // The balance rides along only while there is one to collect. A settled sale shows no figure:
  // it would always be 0, and 0 is noise.
  const texto =
    estado === "CON_SALDO" &&
    saldoPendiente !== undefined &&
    monedaBase !== undefined
      ? VENTA_CREDITO_COPY.chipConSaldoConSaldo(saldoPendiente, monedaBase)
      : label;

  return (
    <Box
      component="span"
      className={VENTA_CREDITO_DOM.chip}
      sx={{
        ...PILL_SX,
        ...(size === "medium" ? MEDIUM_SX : {}),
        bgcolor: `semantic.hue.${hue}.surface`,
        color: `semantic.hue.${hue}.main`,
      }}
    >
      {texto}
    </Box>
  );
};
