"use client";

import ExpiringProductsAlert from "@/components/ExpiringProductsAlert";

interface GestionInventarioAlertsProps {
  tiendaId: string;
}

export function GestionInventarioAlerts({ tiendaId }: GestionInventarioAlertsProps) {
  return <ExpiringProductsAlert tiendaId={tiendaId} />;
}
