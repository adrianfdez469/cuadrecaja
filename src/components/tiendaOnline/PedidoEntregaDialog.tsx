"use client";

import { useMemo, useState } from "react";
import { Stack, Typography } from "@mui/material";

import { AppDialog } from "@/components/AppDialog";
import {
  TIENDA_ONLINE_ORDER_COPY,
  formatOrderAmount,
  orderDeliverySaleNotice,
  orderStatusConfirmTitle,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoPagoFields } from "@/components/tiendaOnline/PedidoPagoFields";
import type { IPedidoPagoMetodo } from "@/components/tiendaOnline/PedidoPagoFields";
import { TIENDA_ONLINE_ORDER_AMOUNT_KIND } from "@/constants/tiendaOnline";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";
import type { IClienteOption } from "@/schemas/clienteSaldo";
import type {
  IPedidoEntrantePago,
  ITiendaOnlineOrder,
  ITiendaOnlineTransferDestination,
} from "@/schemas/tiendaOnline";

/** The method that needs a destination. */
const TRANSFER_METHOD = "TRANSFERENCIA" satisfies IPedidoPagoMetodo;

/** The method that needs a debtor. */
const CREDIT_METHOD = "CREDITO" satisfies IPedidoPagoMetodo;

/** Below this many destinations there is nothing to choose, so nothing to ask. */
const MIN_DESTINATIONS_TO_CHOOSE = 2;

/**
 * The destination the dialog starts on: the one the business marked as default,
 * and otherwise the first of the list. Preselecting HERE does not contradict the
 * rule that no payment method comes preselected: a default destination is a fact
 * the business configured, not a guess about how this order was collected.
 */
function defaultDestinationId(
  destinations: readonly ITiendaOnlineTransferDestination[],
): string | null {
  if (destinations.length === 0) return null;
  const preferred = destinations.find((destination) => destination.default);
  return (preferred ?? destinations[0]).id;
}

export interface PedidoEntregaDialogProps {
  open: boolean;
  order: ITiendaOnlineOrder;
  /** The destination being declared. It is the one whose effect is the sale. */
  target: IQabOrderStatusReportable;
  destinations: readonly ITiendaOnlineTransferDestination[];
  onClose: () => void;
  onConfirm: (pago: IPedidoEntrantePago) => void;
}

/**
 * The dialog `Entregado` already opened, now also the place where the collection
 * is declared (ADR 0073).
 *
 * It is NOT `PedidoStatusConfirmDialog` with a field bolted on: that one has no
 * field at all, and its docstring says that is exactly why nothing is lost by
 * closing it. A conditional form inside it would turn it into two components
 * with an `if`, and would drag `Cancelado` and `Rechazado por la tienda` into a
 * dialog that is no longer theirs.
 *
 * Its title, subtitle and button labels are the SAME ones F-012 fixed for this
 * destination: criterion 16 of that feature already verified them, and a later
 * feature contradicting a verified criterion is the worst kind of debt (E-018).
 *
 * It closes the moment it is confirmed and the request runs on the page behind
 * it, so neither `busy` nor `confirm.loading` is ever set — which is what keeps
 * this route free of the one spinner `AppDialog` can paint.
 *
 * Closing it without confirming DISCARDS the declaration — the debtor included:
 * a half-made statement that comes back days later, over another collection, is
 * worse than starting again, and starting again is two taps.
 *
 * Switching methods does NOT discard the other method's field: the debtor
 * survives a trip through `Efectivo` and the default destination stays loaded
 * while `A crédito` is chosen. What guarantees neither leaks into the other's
 * body is the early `return` of each branch of `handleConfirm`, and nothing
 * else (ADR 0137).
 */
export function PedidoEntregaDialog({
  open,
  order,
  target,
  destinations,
  onClose,
  onConfirm,
}: Readonly<PedidoEntregaDialogProps>) {
  const [metodo, setMetodo] = useState<IPedidoPagoMetodo | null>(null);
  const [transferDestinationId, setTransferDestinationId] = useState<
    string | null
  >(() => defaultDestinationId(destinations));
  // There is NO `defaultCliente` and none is invented: a default destination is
  // a fact the business configured, a debtor would be a guess about this order.
  const [cliente, setCliente] = useState<IClienteOption | null>(null);

  const amountNotice = useMemo(() => {
    // The unquoted branch of the DTO HAS NO `total`, so there is no number to
    // say. Not saying one is not a guard against the 409 the contract owns: the
    // destination is still offered and the request still leaves (E-032).
    if (order.amounts.kind === TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote) {
      return orderDeliverySaleNotice(null);
    }
    return orderDeliverySaleNotice(
      formatOrderAmount(order.amounts.total, order.currencyCode),
    );
  }, [order.amounts, order.currencyCode]);

  const needsDestination =
    metodo === TRANSFER_METHOD &&
    destinations.length >= MIN_DESTINATIONS_TO_CHOOSE;
  const missingDestination = needsDestination && transferDestinationId === null;
  const missingCliente = metodo === CREDIT_METHOD && cliente === null;

  const reason =
    metodo === null
      ? TIENDA_ONLINE_ORDER_COPY.pagoFaltaMetodo
      : missingDestination
        ? TIENDA_ONLINE_ORDER_COPY.pagoFaltaDestino
        : missingCliente
          ? TIENDA_ONLINE_ORDER_COPY.pagoFaltaCliente
          : null;

  const handleConfirm = () => {
    if (metodo === null) return;
    if (metodo === CREDIT_METHOD) {
      // The one extra field of this method, and never the other one: sending a
      // `transferDestinationId` alongside it is row 9 of the schema's table and
      // the body would be refused with a 400 the screen cannot explain.
      if (cliente === null) return;
      onConfirm({ metodo, clienteId: cliente.id });
      return;
    }
    if (metodo !== TRANSFER_METHOD) {
      onConfirm({ metodo });
      return;
    }
    const destination = transferDestinationId ?? defaultDestinationId(destinations);
    if (destination === null) return;
    onConfirm({ metodo, transferDestinationId: destination });
  };

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
        onClick: handleConfirm,
        disabled: reason !== null,
        tone: "primary",
      }}
    >
      <Stack spacing={2}>
        <Typography variant="body2">
          {TIENDA_ONLINE_ORDER_COPY.confirmBody}
        </Typography>

        <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
          {amountNotice}
        </Typography>

        <PedidoPagoFields
          destinations={destinations}
          metodo={metodo}
          transferDestinationId={transferDestinationId}
          clienteId={cliente?.id ?? null}
          clienteNombre={cliente?.nombre ?? null}
          onMetodoChange={setMetodo}
          onDestinationChange={setTransferDestinationId}
          onClienteChange={setCliente}
        />

        {/* A control that is off always says why, and the reason goes away the
            moment it stops explaining anything. */}
        {reason !== null && (
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {reason}
          </Typography>
        )}
      </Stack>
    </AppDialog>
  );
}

export default PedidoEntregaDialog;
