"use client";

import { useCallback, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import axios from "axios";

import {
  TIENDA_ONLINE_ORDER_COPY,
  orderManageDeniedNotice,
  orderStatusAppliedNotice,
  orderStatusDivergedNotice,
  orderStatusFailureCopy,
  orderStatusFailureHue,
  orderStatusFailureOffersRetry,
  orderStatusPresentation,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoNotice } from "@/components/tiendaOnline/PedidoNotice";
import type { PedidoNoticeHue } from "@/components/tiendaOnline/PedidoNotice";
import { PedidoStatusConfirmDialog } from "@/components/tiendaOnline/PedidoStatusConfirmDialog";
import { PedidoStatusPicker } from "@/components/tiendaOnline/PedidoStatusPicker";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import type { IQabOrderStatusReportable } from "@/lib/qab/qabOrderStatusClient";
import { offerOrderStatusTransitions } from "@/lib/tiendaOnline/tiendaOnlineOrderStatus";
import type { IOrderTransitionBlock } from "@/lib/tiendaOnline/tiendaOnlineOrderStatus";
import type { ITiendaOnlineOrder } from "@/schemas/tiendaOnline";
import {
  TiendaOnlineForbiddenError,
  TiendaOnlineOrderNotFound,
  TiendaOnlineOrderStatusUpstreamError,
  patchTiendaOnlineOrderStatus,
} from "@/services/tiendaOnlineService";
import { touch } from "@/theme/tokens";

/** What the last attempt ended as. `null` until one has ended. */
type IStatusOutcome =
  | { kind: "applied"; label: string }
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
  isCompact,
  onApplied,
  onNotFound,
}: Readonly<PedidoStatusActionsProps>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] =
    useState<IQabOrderStatusReportable | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [lastTarget, setLastTarget] =
    useState<IQabOrderStatusReportable | null>(null);
  const [outcome, setOutcome] = useState<IStatusOutcome | null>(null);
  const { isOnline } = useNetworkStatus();

  const offer = offerOrderStatusTransitions(order.status);
  // The permission can be revoked with the screen open: the 403 of an attempt
  // disables the controls too, and both roads show the same one sentence.
  const manageDenied = !order.canManage || outcome?.kind === "forbidden";
  const controlDisabled = manageDenied || !isOnline || inFlight;

  const submit = useCallback(
    async (target: IQabOrderStatusReportable) => {
      setInFlight(true);
      setLastTarget(target);
      // The previous notice is NOT cleared here: it is replaced when the new
      // outcome arrives, and until then its retry control is disabled. Nothing
      // on this screen discards a result on its own.
      try {
        const result = await patchTiendaOnlineOrderStatus(order.id, target);
        if (result.persisted) {
          setOutcome({
            kind: "applied",
            label: orderStatusPresentation(result.status).label,
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
          onRetry={() => {
            if (lastTarget !== null) void submit(lastTarget);
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
    </Box>
  );
}

interface IStatusOutcomeNoticeProps {
  outcome: IStatusOutcome | null;
  disabled: boolean;
  tiendaNombre: string;
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
  onRetry,
}: Readonly<IStatusOutcomeNoticeProps>) {
  if (outcome === null) return null;

  let hue: PedidoNoticeHue = "negative";
  let body: string = TIENDA_ONLINE_ORDER_COPY.statusFailed;
  let offersRetry = true;

  if (outcome.kind === "applied") {
    hue = "positive";
    body = orderStatusAppliedNotice(outcome.label);
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
