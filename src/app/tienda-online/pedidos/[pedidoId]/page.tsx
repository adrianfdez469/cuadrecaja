"use client";

import { use } from "react";
import { Box, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { ErrorOutline } from "@mui/icons-material";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { SectionLabel } from "@/components/SectionLabel";
import {
  TIENDA_ONLINE_ORDER_COPY,
  conversionMismatchTitle,
  formatOrderDateLong,
  productsSectionLabel,
  rateSnapshotProvenance,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoAmountsBlock } from "@/components/tiendaOnline/PedidoAmountsBlock";
import { PedidoCautionNotice } from "@/components/tiendaOnline/PedidoCautionNotice";
import { PedidoContactBlock } from "@/components/tiendaOnline/PedidoContactBlock";
import { PedidoEstadoPills } from "@/components/tiendaOnline/PedidoEstadoPills";
import { PedidoLinesMobileList } from "@/components/tiendaOnline/PedidoLinesMobileList";
import { PedidoLinesTable } from "@/components/tiendaOnline/PedidoLinesTable";
import { PedidoMetaBlock } from "@/components/tiendaOnline/PedidoMetaBlock";
import { TiendaOnlineDeniedScreen } from "@/components/tiendaOnline/TiendaOnlineDeniedScreen";
import {
  TIENDA_ONLINE_LABELS,
  TIENDA_ONLINE_ORDER_AMOUNT_KIND,
  TIENDA_ONLINE_PEDIDOS_OFFLINE_DESCRIPTION,
  TIENDA_ONLINE_PERMISOS,
  TIENDA_ONLINE_ROUTES,
} from "@/constants/tiendaOnline";
import { useTiendaOnlineAccess } from "@/hooks/useTiendaOnlineAccess";
import { useTiendaOnlineOrder } from "@/hooks/useTiendaOnlineOrder";
import { shape } from "@/theme/tokens";

/**
 * One order, in its own route (ADR 0057).
 *
 * A document and not a table: `maxWidth="md"`, one column, and the summary
 * before the lines — the first question at a counter is how much it is and
 * whether the delivery is settled, and that is four rows that fit without
 * scrolling.
 *
 * There is NO action here and no disabled control that promises one: changing
 * the state of an order is F-012, and a greyed-out `Confirmar` would advertise
 * a permission problem where there is only an unbuilt feature.
 *
 * The threshold is the canonical `down("sm")`, declared ONCE: four short columns
 * of lines fit in the 696 px box of a 768 px viewport without squeezing.
 */
export default function TiendaOnlinePedidoDetallePage({
  params,
}: Readonly<{ params: Promise<{ pedidoId: string }> }>) {
  const { pedidoId } = use(params);
  const access = useTiendaOnlineAccess(TIENDA_ONLINE_PERMISOS.pedidosAcceder);
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("sm"));
  const router = useRouter();
  const detail = useTiendaOnlineOrder(pedidoId, access === "allowed");

  if (access === "denied" || detail.status === "forbidden") {
    return <TiendaOnlineDeniedScreen />;
  }

  const order = detail.order;
  const ready = detail.status === "ready" && order !== null;

  const mismatchCount = ready
    ? order.lines.filter(
        (line) => line.conversion !== null && !line.conversion.matchesStored,
      ).length
    : 0;
  const showProvenance =
    ready &&
    order.rateSnapshot !== null &&
    order.lines.some((line) => line.original !== null);

  return (
    <PageContainer
      maxWidth="md"
      title={
        ready
          ? `${TIENDA_ONLINE_ORDER_COPY.detailTitlePrefix}${order.code}`
          : TIENDA_ONLINE_ORDER_COPY.detailTitleFallback
      }
      subtitle={
        ready
          ? `${order.tiendaNombre} · ${TIENDA_ONLINE_ORDER_COPY.detailReceivedPrefix}${formatOrderDateLong(order.createdAt)}`
          : undefined
      }
      breadcrumbs={[
        { label: "Inicio", href: "/home" },
        // No href: `/tienda-online` is not a route.
        { label: TIENDA_ONLINE_LABELS.section },
        { label: TIENDA_ONLINE_LABELS.pedidos, href: TIENDA_ONLINE_ROUTES.pedidos },
        ...(ready ? [{ label: order.code }] : []),
      ]}
      titleAdornment={
        ready ? (
          <PedidoEstadoPills status={order.status} amounts={order.amounts} />
        ) : undefined
      }
    >
      {access === "loading" || detail.status === "loading" ? (
        <Stack spacing={2}>
          <LoadingState variant="text" count={4} />
          {isCompact ? (
            <LoadingState variant="list" count={4} />
          ) : (
            <LoadingState variant="table" count={4} columns={4} />
          )}
        </Stack>
      ) : detail.status === "not-found" ? (
        // Not an `ErrorState`: there is nothing to retry, and its `Reintentar`
        // would invite pressing it forever. The description keeps the 404's
        // ambiguity on purpose — the server refused to say which of the four
        // reasons it was.
        <EmptyState
          variant="empty"
          size="page"
          icon={<ErrorOutline sx={{ fontSize: "inherit" }} />}
          title={TIENDA_ONLINE_ORDER_COPY.notFoundTitle}
          description={TIENDA_ONLINE_ORDER_COPY.notFoundDescription}
          action={{
            label: TIENDA_ONLINE_ORDER_COPY.notFoundAction,
            onClick: () => router.push(TIENDA_ONLINE_ROUTES.pedidos),
          }}
        />
      ) : detail.status === "offline" ? (
        <ErrorState
          kind="offline"
          description={TIENDA_ONLINE_PEDIDOS_OFFLINE_DESCRIPTION}
          onRetry={detail.retry}
        />
      ) : !ready ? (
        <ErrorState
          kind="error"
          title={TIENDA_ONLINE_ORDER_COPY.detailErrorTitle}
          description={TIENDA_ONLINE_ORDER_COPY.errorDescription}
          onRetry={detail.retry}
        />
      ) : (
        <Stack spacing={3}>
          {/* Two short label-and-value blocks side by side from 900 px: a
              breakpoint object inside `sx`, not a second JavaScript threshold. */}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 3,
            }}
          >
            <Box>
              <SectionLabel>{TIENDA_ONLINE_ORDER_COPY.sectionResumen}</SectionLabel>
              <Stack spacing={1.5}>
                <PedidoAmountsBlock
                  amounts={order.amounts}
                  currencyCode={order.currencyCode}
                />
                {order.amounts.kind ===
                  TIENDA_ONLINE_ORDER_AMOUNT_KIND.pendingQuote && (
                  <PedidoCautionNotice>
                    {TIENDA_ONLINE_ORDER_COPY.pendingQuoteNote}
                  </PedidoCautionNotice>
                )}
              </Stack>
            </Box>

            <Box>
              <SectionLabel>{TIENDA_ONLINE_ORDER_COPY.sectionContacto}</SectionLabel>
              <PedidoContactBlock order={order} />
            </Box>
          </Box>

          {order.notes !== null && order.notes.trim().length > 0 && (
            <Box>
              <SectionLabel>{TIENDA_ONLINE_ORDER_COPY.sectionNotas}</SectionLabel>
              {/* No clamp and no «ver más»: the buyer's note is the part of an
                  order most likely to carry the one instruction that matters. */}
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: `${shape.radius.md}px`,
                  bgcolor: "semantic.surface.sunken",
                  color: "semantic.text.primary",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                <Typography variant="body2" component="span">
                  {order.notes}
                </Typography>
              </Box>
            </Box>
          )}

          {/* ONE notice, not one per line: it says HOW MANY and WHAT IT MEANS,
              and each affected line says which and how much. */}
          {mismatchCount > 0 && (
            <PedidoCautionNotice title={conversionMismatchTitle(mismatchCount)}>
              {TIENDA_ONLINE_ORDER_COPY.conversionMismatchBody}
            </PedidoCautionNotice>
          )}

          <Box>
            <SectionLabel>{productsSectionLabel(order.lines.length)}</SectionLabel>
            {isCompact ? (
              <PedidoLinesMobileList lines={order.lines} />
            ) : (
              <PedidoLinesTable lines={order.lines} />
            )}
            {showProvenance && order.rateSnapshot !== null && (
              <Typography
                sx={{
                  mt: 1.5,
                  fontSize: "0.75rem",
                  color: "semantic.text.secondary",
                }}
              >
                {rateSnapshotProvenance(order.rateSnapshot)}
              </Typography>
            )}
          </Box>

          <Box>
            <SectionLabel>{TIENDA_ONLINE_ORDER_COPY.sectionDatos}</SectionLabel>
            <PedidoMetaBlock order={order} />
          </Box>
        </Stack>
      )}
    </PageContainer>
  );
}
