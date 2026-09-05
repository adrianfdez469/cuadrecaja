"use client";

import { Box, Button, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import { ShoppingBag } from "@mui/icons-material";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { StatusPill } from "@/components/StatusPill";
import {
  TIENDA_ONLINE_ORDER_COPY,
  unassignedTitle,
  unattendedCountLabel,
} from "@/components/tiendaOnline/orderPresentation";
import { PedidoNotice } from "@/components/tiendaOnline/PedidoNotice";
import { PedidosMetaRow } from "@/components/tiendaOnline/PedidosMetaRow";
import { PedidosMobileList } from "@/components/tiendaOnline/PedidosMobileList";
import { PedidosTable } from "@/components/tiendaOnline/PedidosTable";
import { TiendaOnlineDeniedScreen } from "@/components/tiendaOnline/TiendaOnlineDeniedScreen";
import {
  TIENDA_ONLINE_LABELS,
  TIENDA_ONLINE_PEDIDOS_OFFLINE_DESCRIPTION,
  TIENDA_ONLINE_PERMISOS,
  TIENDA_ONLINE_ROUTES,
} from "@/constants/tiendaOnline";
import { useTiendaOnlineAccess } from "@/hooks/useTiendaOnlineAccess";
import { useTiendaOnlineOrders } from "@/hooks/useTiendaOnlineOrders";
import { touch } from "@/theme/tokens";

/**
 * The inbox of the orders that come in from the online store.
 *
 * Two branches and not one component with hidden columns: cards below 900 px, a
 * real table from there. The threshold is `down("md")` and not the canonical
 * `down("sm")`, and it is declared ONCE here and passed down — the table has five
 * columns, two of them free text and one a stack of pills, and on the 696 px box
 * of a 768 px viewport the state column pushes each pill onto its own line and
 * doubles the row height. From 900 px the split fits without squeezing.
 */
export default function TiendaOnlinePedidosPage() {
  const access = useTiendaOnlineAccess(TIENDA_ONLINE_PERMISOS.pedidosAcceder);
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  const router = useRouter();
  const inbox = useTiendaOnlineOrders(access === "allowed");

  // A 403 of the GET is the same answer as the gate's: this user does not see
  // the module. Never `signOut` (E-007) and never the body of the 403 (E-009).
  if (access === "denied" || inbox.status === "forbidden") {
    return <TiendaOnlineDeniedScreen />;
  }

  const handleRefresh = () => {
    inbox.refresh();
    window.scrollTo({ top: 0 });
  };

  // The gate's skeleton and the first load's are the SAME: two waits in a row
  // that the user reads as one, and changing shape between them jumps the page.
  const skeleton =
    access === "loading" || inbox.status === "loading" ? (
      isCompact ? (
        <LoadingState variant="list" count={6} />
      ) : (
        <LoadingState variant="table" count={8} columns={5} />
      )
    ) : null;

  return (
    <PageContainer
      maxWidth="lg"
      title={TIENDA_ONLINE_LABELS.pedidos}
      subtitle={TIENDA_ONLINE_ORDER_COPY.subtitle}
      breadcrumbs={[
        { label: "Inicio", href: "/home" },
        // No href: `/tienda-online` is not a route.
        { label: TIENDA_ONLINE_LABELS.section },
        { label: TIENDA_ONLINE_LABELS.pedidos },
      ]}
      titleAdornment={
        inbox.unattendedCount > 0 ? (
          <StatusPill
            label={unattendedCountLabel(inbox.unattendedCount)}
            hue="caution"
          />
        ) : undefined
      }
    >
      {skeleton ?? (
        <Stack spacing={2}>
          {inbox.unassignedCount > 0 && (
            <PedidoNotice title={unassignedTitle(inbox.unassignedCount)}>
              {TIENDA_ONLINE_ORDER_COPY.unassignedBody}
            </PedidoNotice>
          )}

          {inbox.status === "error" && (
            <ErrorState
              kind="error"
              title={TIENDA_ONLINE_ORDER_COPY.errorTitle}
              description={TIENDA_ONLINE_ORDER_COPY.errorDescription}
              onRetry={inbox.refresh}
            />
          )}

          {inbox.status === "offline" && (
            <ErrorState
              kind="offline"
              description={TIENDA_ONLINE_PEDIDOS_OFFLINE_DESCRIPTION}
              onRetry={inbox.refresh}
            />
          )}

          {inbox.status === "ready" && inbox.lastLoadedAt !== null && (
            <PedidosMetaRow
              lastLoadedAt={inbox.lastLoadedAt}
              online={inbox.online}
              busy={inbox.busy}
              autoRefreshPaused={inbox.multiplePagesLoaded}
              onRefresh={handleRefresh}
            />
          )}

          {inbox.status === "ready" &&
            (inbox.orders.length === 0 ? (
              <EmptyState
                variant="empty"
                size="page"
                icon={<ShoppingBag sx={{ fontSize: "inherit" }} />}
                title={TIENDA_ONLINE_ORDER_COPY.emptyTitle}
                description={TIENDA_ONLINE_ORDER_COPY.emptyDescription}
                action={{
                  label: TIENDA_ONLINE_ORDER_COPY.emptyAction,
                  onClick: () => router.push(TIENDA_ONLINE_ROUTES.configuracion),
                }}
              />
            ) : isCompact ? (
              <PedidosMobileList orders={inbox.orders} />
            ) : (
              <PedidosTable orders={inbox.orders} />
            ))}

          {/* A button, never infinite scrolling: that would carry the notice and
              the meta row off screen exactly when they are needed, and leave the
              end of the list with no way to be checked. */}
          {inbox.status === "ready" && inbox.nextCursor !== null && (
            <Button
              variant="outlined"
              fullWidth
              onClick={inbox.loadMore}
              disabled={inbox.busy}
              sx={{ minHeight: touch.min }}
            >
              {TIENDA_ONLINE_ORDER_COPY.cargarMas}
            </Button>
          )}

          {/* Only after paginating: on the first page nobody had asked yet. */}
          {inbox.status === "ready" &&
            inbox.nextCursor === null &&
            inbox.multiplePagesLoaded && (
              <Box sx={{ textAlign: "center" }}>
                <Typography
                  sx={{ fontSize: "0.75rem", color: "semantic.text.secondary" }}
                >
                  {TIENDA_ONLINE_ORDER_COPY.noHayMas}
                </Typography>
              </Box>
            )}
        </Stack>
      )}
    </PageContainer>
  );
}
