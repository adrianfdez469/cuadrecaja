"use client";

import { ShoppingBag } from "@mui/icons-material";

import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { PageContainer } from "@/components/PageContainer";
import { TiendaOnlineDeniedScreen } from "@/components/tiendaOnline/TiendaOnlineDeniedScreen";
import {
  TIENDA_ONLINE_LABELS,
  TIENDA_ONLINE_PERMISOS,
} from "@/constants/tiendaOnline";
import { useTiendaOnlineAccess } from "@/hooks/useTiendaOnlineAccess";

/**
 * Scaffolding of the incoming-orders screen (F-004).
 *
 * It makes no request and lists nothing: F-011 builds the real inbox inside this
 * card. The frame — container, breadcrumbs, `maxWidth`, the three states — is
 * what that feature inherits, so it does not have to invent one.
 */
export default function TiendaOnlinePedidosPage() {
  const access = useTiendaOnlineAccess(TIENDA_ONLINE_PERMISOS.pedidosAcceder);

  if (access === "denied") return <TiendaOnlineDeniedScreen />;

  return (
    // `xl` — the default — on purpose: F-011 puts a table of orders in here and
    // narrowing it now would force it to widen later.
    <PageContainer
      title={TIENDA_ONLINE_LABELS.pedidos}
      subtitle="Los pedidos que entran desde tu tienda online."
      breadcrumbs={[
        { label: "Inicio", href: "/home" },
        // No href: `/tienda-online` is not a route.
        { label: TIENDA_ONLINE_LABELS.section },
        { label: TIENDA_ONLINE_LABELS.pedidos },
      ]}
    >
      {access === "loading" ? (
        // `text` and not `table`: a skeleton promises the shape of what is
        // coming, and what comes in F-004 is text. F-011 changes this variant.
        <LoadingState variant="text" count={3} />
      ) : (
        <ContentCard>
          <EmptyState
            variant="empty"
            size="compact"
            icon={<ShoppingBag sx={{ fontSize: "inherit" }} />}
            title="La bandeja de pedidos llega en la próxima entrega"
            // The last sentence is a checkable claim, not a consolation: the
            // sync cron persists incoming orders every two minutes. If it stops
            // being true, delete it — do not soften it.
            description="Esta pantalla ya está habilitada para tu negocio y para tu usuario. Los pedidos que entren desde tu tienda online quedan guardados y van a aparecer aquí en cuanto la bandeja esté disponible: no se pierde ninguno."
          />
        </ContentCard>
      )}
    </PageContainer>
  );
}
