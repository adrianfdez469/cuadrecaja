"use client";

import { Storefront } from "@mui/icons-material";

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
 * Scaffolding of the online-store configuration screen (F-004).
 *
 * It makes no request: the double gate is decided on the client from the value
 * `AppContext` already resolved, and the endpoint exists for the acceptance
 * criteria that are verified with `curl`. F-005 replaces the body of the card
 * with the real form and keeps this frame untouched.
 */
export default function TiendaOnlineConfiguracionPage() {
  const access = useTiendaOnlineAccess(
    TIENDA_ONLINE_PERMISOS.configuracionAcceder,
  );

  // In place, never a redirect to /forbidden: a `router.push` during the
  // "loading" state would be a race, and losing the URL buys nothing.
  if (access === "denied") return <TiendaOnlineDeniedScreen />;

  return (
    <PageContainer
      // `md`, unlike Pedidos: F-005 puts a settings form here and the reading
      // measure matters. Deliberate, and the only structural difference between
      // the two screens of this module.
      maxWidth="md"
      title={TIENDA_ONLINE_LABELS.configuracion}
      subtitle="Cómo se ve y cómo opera tu negocio en la tienda online."
      breadcrumbs={[
        { label: "Inicio", href: "/home" },
        // No href: `/tienda-online` is not a route.
        { label: TIENDA_ONLINE_LABELS.section },
        { label: "Configuración" },
      ]}
    >
      {access === "loading" ? (
        <LoadingState variant="text" count={3} />
      ) : (
        <ContentCard>
          <EmptyState
            variant="empty"
            size="compact"
            icon={<Storefront sx={{ fontSize: "inherit" }} />}
            title="La configuración de la tienda online llega en la próxima entrega"
            description="Esta pantalla ya está habilitada para tu negocio y para tu usuario. Todavía no hay nada que configurar aquí: los datos públicos del local, los horarios y los medios de pago se agregan en la próxima versión."
          />
        </ContentCard>
      )}
    </PageContainer>
  );
}
