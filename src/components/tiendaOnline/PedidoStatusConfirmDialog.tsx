"use client";

import { Typography } from "@mui/material";

import { AppDialog } from "@/components/AppDialog";
import {
  TIENDA_ONLINE_ORDER_COPY,
  orderStatusConfirmTitle,
  orderStatusPresentation,
} from "@/components/tiendaOnline/orderPresentation";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";

/** The hue F-011 gave a decision somebody will have to answer for. */
const DANGER_HUE = "negative";

export interface PedidoStatusConfirmDialogProps {
  open: boolean;
  /** The destination being confirmed. Only rendered when there is one. */
  target: IQabOrderStatusReportable;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Asked ONLY for a destination the order cannot move on from — and which one
 * that is comes from `offerOrderStatusTransitions`, never from a list of
 * terminal states kept here (E-014).
 *
 * It has NO field: this feature captures no reason, so there is nothing to type
 * and nothing to lose by closing it.
 *
 * `cancelLabel` is `Volver` and not the default: one of the destinations is
 * «Cancelado», and a `Cancelar` beside it would be asking whether to cancel the
 * cancelling.
 *
 * It closes as soon as it is confirmed and the request runs on the page behind
 * it, so neither `busy` nor `confirm.loading` is ever set — which is what keeps
 * this screen free of the one spinner `AppDialog` can paint.
 */
export function PedidoStatusConfirmDialog({
  open,
  target,
  onClose,
  onConfirm,
}: Readonly<PedidoStatusConfirmDialogProps>) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      title={orderStatusConfirmTitle(target)}
      subtitle={TIENDA_ONLINE_ORDER_COPY.confirmSubtitle}
      maxWidth="xs"
      cancelLabel={TIENDA_ONLINE_ORDER_COPY.volver}
      confirm={{
        label: TIENDA_ONLINE_ORDER_COPY.cambiarEstado,
        onClick: onConfirm,
        tone:
          orderStatusPresentation(target).hue === DANGER_HUE
            ? "danger"
            : "primary",
      }}
    >
      <Typography variant="body2">
        {TIENDA_ONLINE_ORDER_COPY.confirmBody}
      </Typography>
    </AppDialog>
  );
}

export default PedidoStatusConfirmDialog;
