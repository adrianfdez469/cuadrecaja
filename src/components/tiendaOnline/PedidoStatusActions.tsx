"use client";

import { useCallback, useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import axios from "axios";

import {
  TIENDA_ONLINE_ORDER_COPY,
  orderLandingAppliedHue,
  orderLandingAppliedNotice,
  orderLandingBlockedCopy,
  orderLandingSkipLines,
  orderManageDeniedNotice,
  orderStatusDivergedNotice,
  orderStatusFailureCopy,
  orderStatusFailureHue,
  orderStatusFailureOffersRetry,
  orderStatusPresentation,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoEntregaDialog } from "@/components/tiendaOnline/PedidoEntregaDialog";
import { PedidoNotice } from "@/components/tiendaOnline/PedidoNotice";
import type { PedidoNoticeHue } from "@/components/tiendaOnline/PedidoNotice";
import { PedidoStatusConfirmDialog } from "@/components/tiendaOnline/PedidoStatusConfirmDialog";
import { PedidoStatusPicker } from "@/components/tiendaOnline/PedidoStatusPicker";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";
import { planOrderLandingEffect } from "@/lib/tiendaOnline/orderLandingPlan";
import { offerOrderStatusTransitions } from "@/lib/tiendaOnline/tiendaOnlineOrderStatus";
import type { IOrderTransitionBlock } from "@/lib/tiendaOnline/tiendaOnlineOrderStatus";
import type {
  IPedidoEntrantePago,
  ITiendaOnlineOrder,
  ITiendaOnlineOrderLanding,
  ITiendaOnlineTransferDestination,
} from "@/schemas/tiendaOnline";
import {
  TiendaOnlineForbiddenError,
  TiendaOnlineOrderNotFound,
  TiendaOnlineOrderNotLandableError,
  TiendaOnlineOrderStatusUpstreamError,
  patchTiendaOnlineOrderStatus,
} from "@/services/tiendaOnlineService";
import { touch } from "@/theme/tokens";

/**
 * The effect that turns an order into a sale. The screen asks
 * `planOrderLandingEffect` which destination that is and NEVER compares against
 * `"DELIVERED"`: a seventh destination that also sold would open the dialog on
 * its own, and a hand-written list would not (E-014).
 */
const SELL_EFFECT = "SELL";

/** What the last attempt ended as. `null` until one has ended. */
type IStatusOutcome =
  | { kind: "applied"; label: string; landing: ITiendaOnlineOrderLanding | null }
  | { kind: "notLandable"; reason: string }
  | { kind: "diverged"; reportedLabel: string; currentLabel: string }
  | { kind: "upstream"; qabError: string; retryable: boolean }
  | { kind: "forbidden" }
  | { kind: "offline" }
  | { kind: "failed" };

/** The sentence each `blocked` reason is explained with. */
const BLOCKED_COPY: Record<IOrderTransitionBlock, string> = {
  TERMINAL: TIENDA_ONLINE_ORDER_COPY.blockedTerminal,
  AWAITING_CUSTOMER: TIENDA_ONLINE_ORDER_COPY.blockedAwaitingCustomer,
  UNKNOWN_STATUS: TIENDA_ONLINE_ORDER_COPY.blockedUnknownStatus,
};

/** `true` when the request never got an answer: no network, a timeout, DNS. */
function isNetworkFailure(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response === undefined;
}

export interface PedidoStatusActionsProps {
  order: ITiendaOnlineOrder;
  /**
   * The destinations of the store that OWNS this order, straight from the
   * detail's body (ADR 0074). This block fires no request for them.
   */
  transferDestinations: readonly ITiendaOnlineTransferDestination[];
  /** The page's ONE `down("sm")`. This block declares no media query of its own. */
  isCompact: boolean;
  /** The status QAB accepted AND this POS wrote. Never called otherwise. */
  onApplied: (status: IQabOrderStatusReportable) => void;
  /** The order left the reach of this session: the whole screen changes. */
  onNotFound: () => void;
}

/**
 * The one block of the detail that writes: the status control, the link to the
 * buyer, and the outcome of the last attempt.
 *
 * It is a named region (`aria-label`) that EXISTS in every state, empty of
 * controls or not: it gives a screen reader the same jump the eye makes, and it
 * is the container every check of this feature is scoped to — the header, the
 * amounts block and the meta block all compete for the same words.
 *
 * What it decides itself: nothing about transitions. It asks
 * `offerOrderStatusTransitions` once, consumes `targets` and `blocked` as they
 * come, and asks the same function again to know whether a destination needs
 * confirming. It never compares a status with a literal (ADR 0065).
 *
 * Only ONE request is in flight at a time, and four independent closures make a
 * double submit impossible: the control goes disabled, the retry goes disabled,
 * the picker is closed, and the confirmation is closed.
 */
export function PedidoStatusActions({
  order,
  transferDestinations,
  isCompact,
  onApplied,
  onNotFound,
}: Readonly<PedidoStatusActionsProps>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] =
    useState<IQabOrderStatusReportable | null>(null);
  const [deliverTarget, setDeliverTarget] =
    useState<IQabOrderStatusReportable | null>(null);
  // The declaration lives as long as the screen does, next to the destination:
  // `Volver a intentarlo` repeats the SAME body, `pago` included. Asking again
  // after a network failure would be punishing somebody for a problem that is
  // not theirs.
  const [lastPago, setLastPago] = useState<IPedidoEntrantePago | undefined>(
    undefined,
  );
  const [inFlight, setInFlight] = useState(false);
  const [lastTarget, setLastTarget] =
    useState<IQabOrderStatusReportable | null>(null);
  const [outcome, setOutcome] = useState<IStatusOutcome | null>(null);
  const { isOnline } = useNetworkStatus();

  const offer = offerOrderStatusTransitions(order.status);
  // The PATCH answers with line IDS only; the names are the ones already on
  // screen, and the two are the same column, `PedidoEntranteLinea.id`.
  const lineNames = useMemo(
    () => new Map(order.lines.map((line) => [line.id, line.name])),
    [order.lines],
  );
  // The permission can be revoked with the screen open: the 403 of an attempt
  // disables the controls too, and both roads show the same one sentence.
  const manageDenied = !order.canManage || outcome?.kind === "forbidden";
  const controlDisabled = manageDenied || !isOnline || inFlight;

  const submit = useCallback(
    async (target: IQabOrderStatusReportable, pago?: IPedidoEntrantePago) => {
      setInFlight(true);
      setLastTarget(target);
      setLastPago(pago);
      // The previous notice is NOT cleared here: it is replaced when the new
      // outcome arrives, and until then its retry control is disabled. Nothing
      // on this screen discards a result on its own.
      try {
        const result = await patchTiendaOnlineOrderStatus(order.id, target, pago);
        if (result.persisted) {
          setOutcome({
            kind: "applied",
            label: orderStatusPresentation(result.status).label,
            // Present if and only if the row was written. Without it there is
            // no landing to describe, and describing one would be a lie.
            landing: result.landing ?? null,
          });
          onApplied(result.status);
          return;
        }
        // QAB is ahead and this POS is not. The screen keeps showing the OLD
        // status everywhere: painting the new one is the lie ADR 0063 exists
        // to prevent.
        setOutcome({
          kind: "diverged",
          reportedLabel: orderStatusPresentation(result.status).label,
          currentLabel: orderStatusPresentation(order.status).label,
        });
      } catch (error) {
        if (error instanceof TiendaOnlineOrderNotFound) {
          onNotFound();
          return;
        }
        if (error instanceof TiendaOnlineForbiddenError) {
          setOutcome({ kind: "forbidden" });
          return;
        }
        // Nothing left this POS and nothing was written: the order is where it
        // was, on both sides. It offers no retry — the same body would hit the
        // same wall — and `Cambiar el estado` is still there to declare again.
        if (error instanceof TiendaOnlineOrderNotLandableError) {
          setOutcome({ kind: "notLandable", reason: error.reason });
          return;
        }
        if (error instanceof TiendaOnlineOrderStatusUpstreamError) {
          setOutcome({
            kind: "upstream",
            qabError: error.qabError,
            // Read from the body, NEVER recomputed from the code (E-014).
            retryable: error.retryable,
          });
          return;
        }
        setOutcome({ kind: isNetworkFailure(error) ? "offline" : "failed" });
      } finally {
        setInFlight(false);
      }
    },
    [onApplied, onNotFound, order.id, order.status],
  );

  const handleSelect = useCallback(
    (target: IQabOrderStatusReportable) => {
      // The two questions, in THIS order, because the selling destination
      // answers both. First: does this destination create the sale? Then it
      // needs the collection declared (ADR 0073).
      if (planOrderLandingEffect(target) === SELL_EFFECT) {
        setDeliverTarget(target);
        return;
      }
      // Asked of the SAME function that built the offer: a destination that
      // would leave the order with no control at all is confirmed first.
      if (offerOrderStatusTransitions(target).blocked !== null) {
        setConfirmTarget(target);
        return;
      }
      void submit(target);
    },
    [submit],
  );

  const handleConfirm = useCallback(() => {
    const target = confirmTarget;
    setConfirmTarget(null);
    if (target !== null) void submit(target);
  }, [confirmTarget, submit]);

  const handleDeliver = useCallback(
    (pago: IPedidoEntrantePago) => {
      const target = deliverTarget;
      // Closed BEFORE the request leaves: the call can take up to ten seconds
      // with the whole order covered, and the outcome has to be read next to
      // the status the screen keeps showing (F-012 §4.7).
      setDeliverTarget(null);
      if (target !== null) void submit(target, pago);
    },
    [deliverTarget, submit],
  );

  return (
    <Box component="section" aria-label={TIENDA_ONLINE_ORDER_COPY.actionsRegionLabel}>
      <Stack spacing={1.5}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "flex-start" },
            gap: 1.5,
          }}
        >
          {offer.blocked === null && (
            <Button
              variant="contained"
              size="large"
              disabled={controlDisabled}
              onClick={() => setPickerOpen(true)}
              sx={{ minHeight: touch.comfortable }}
            >
              {TIENDA_ONLINE_ORDER_COPY.cambiarEstado}
            </Button>
          )}

          {/* A real link, so the BROWSER navigates and never this code. Nothing
              in this feature opens it on its own: no script-driven navigation,
              no effect, no redirect (ADR 0066). */}
          {order.customerWhatsappUrl !== null && (
            <Button
              component="a"
              href={order.customerWhatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              size="large"
              sx={{ minHeight: touch.comfortable }}
            >
              {TIENDA_ONLINE_ORDER_COPY.whatsappAction}
            </Button>
          )}
        </Box>

        {/* Why one of the two is missing, or why the control is off. A blocked
            order shows ONLY that: a permission for an action that does not exist
            is noise, not information. */}
        {offer.blocked !== null ? (
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {BLOCKED_COPY[offer.blocked]}
          </Typography>
        ) : (
          // Only the permission this session is KNOWN to lack. A 403 that
          // arrives mid-flight says the same sentence once, from the outcome
          // notice below: one sentence, two roads to it.
          !order.canManage && (
            <PedidoNotice hue="caution">
              {orderManageDeniedNotice(order.tiendaNombre)}
            </PedidoNotice>
          )
        )}

        {/* A control that is off always says why, right beside it (F-005). */}
        {offer.blocked === null && order.canManage && !isOnline && (
          <Typography
            variant="body2"
            sx={{ color: "semantic.hue.caution.main" }}
          >
            {TIENDA_ONLINE_ORDER_COPY.sinConexionRazon}
          </Typography>
        )}

        {order.customerWhatsappUrl === null && (
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {TIENDA_ONLINE_ORDER_COPY.whatsappSinEnlace}
          </Typography>
        )}

        {/* No spinner anywhere on this screen: a sentence says WHAT is being
            waited for, which a spinner cannot. */}
        {inFlight && (
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {TIENDA_ONLINE_ORDER_COPY.reportando}
          </Typography>
        )}

        <StatusOutcomeNotice
          outcome={outcome}
          disabled={inFlight}
          tiendaNombre={order.tiendaNombre}
          lineNames={lineNames}
          onRetry={() => {
            if (lastTarget !== null) void submit(lastTarget, lastPago);
          }}
        />
      </Stack>

      <PedidoStatusPicker
        open={pickerOpen}
        targets={offer.targets}
        isCompact={isCompact}
        onClose={() => setPickerOpen(false)}
        onSelect={handleSelect}
      />

      {confirmTarget !== null && (
        <PedidoStatusConfirmDialog
          open
          target={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={handleConfirm}
        />
      )}

      {/* Remounted on every open, so a declaration abandoned by closing is
          gone: two taps to make it again, and no stale half-statement. */}
      {deliverTarget !== null && (
        <PedidoEntregaDialog
          open
          order={order}
          target={deliverTarget}
          destinations={transferDestinations}
          onClose={() => setDeliverTarget(null)}
          onConfirm={handleDeliver}
        />
      )}
    </Box>
  );
}

interface IStatusOutcomeNoticeProps {
  outcome: IStatusOutcome | null;
  disabled: boolean;
  tiendaNombre: string;
  /** `PedidoEntranteLinea.id` -> its name, from the order already on screen. */
  lineNames: ReadonlyMap<string, string>;
  onRetry: () => void;
}

/**
 * The outcome of the last attempt, inside the region and never as a toast: it
 * has to sit next to the status it contradicts, and it must not disappear on its
 * own. There is no dismiss control and no timer — it is replaced by the next
 * outcome and gone when the screen is left.
 */
function StatusOutcomeNotice({
  outcome,
  disabled,
  tiendaNombre,
  lineNames,
  onRetry,
}: Readonly<IStatusOutcomeNoticeProps>) {
  if (outcome === null) return null;

  let hue: PedidoNoticeHue = "negative";
  let body: string = TIENDA_ONLINE_ORDER_COPY.statusFailed;
  let offersRetry = true;
  // The lines that did not reach inventory, as a SECOND notice: one block with
  // «two products reserved» and «three lines left out» would have to be painted
  // one colour, and either half of it would lie about the other.
  let skipLines: string[] = [];

  if (outcome.kind === "applied") {
    const landing = outcome.landing;
    hue =
      landing === null
        ? "positive"
        : orderLandingAppliedHue(landing.effect, landing.alreadyLanded);
    body = orderLandingAppliedNotice({
      label: outcome.label,
      effect: landing === null ? "" : landing.effect,
      reservedProducts: landing === null ? 0 : landing.reservedProducts,
      saleRegistered: landing !== null && landing.ventaId !== null,
      alreadyLanded: landing !== null && landing.alreadyLanded,
    });
    offersRetry = false;
    if (landing !== null && landing.skipped.length > 0) {
      skipLines = orderLandingSkipLines(landing.skipped, lineNames);
    }
  } else if (outcome.kind === "notLandable") {
    // Nothing is broken: a local condition is missing, and nothing left this
    // POS. No retry — the same body would meet the same wall (§4.2).
    hue = "caution";
    body = orderLandingBlockedCopy(outcome.reason);
    offersRetry = false;
  } else if (outcome.kind === "diverged") {
    hue = "caution";
    body = orderStatusDivergedNotice(
      outcome.reportedLabel,
      outcome.currentLabel,
    );
  } else if (outcome.kind === "upstream") {
    hue = orderStatusFailureHue(outcome.qabError);
    body = orderStatusFailureCopy(outcome.qabError);
    offersRetry =
      orderStatusFailureOffersRetry(outcome.qabError) && outcome.retryable;
  } else if (outcome.kind === "forbidden") {
    hue = "caution";
    body = orderManageDeniedNotice(tiendaNombre);
    offersRetry = false;
  } else if (outcome.kind === "offline") {
    hue = "caution";
    body = TIENDA_ONLINE_ORDER_COPY.statusOffline;
  }

  return (
    <Stack spacing={1.5}>
      <PedidoNotice hue={hue}>{body}</PedidoNotice>
      {skipLines.length > 0 && (
        <PedidoNotice hue="caution" items={skipLines}>
          {TIENDA_ONLINE_ORDER_COPY.landingSkipTitle}
        </PedidoNotice>
      )}
      {offersRetry && (
        <Button
          variant="outlined"
          disabled={disabled}
          onClick={onRetry}
          sx={{ alignSelf: "flex-start", minHeight: touch.min }}
        >
          {TIENDA_ONLINE_ORDER_COPY.volverAIntentarlo}
        </Button>
      )}
    </Stack>
  );
}

export default PedidoStatusActions;
