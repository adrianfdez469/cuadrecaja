"use client";

import { VencidosBanner } from "./VencidosBanner";

interface GestionInventarioAlertsProps {
  tiendaId: string;
  onVerVencidos: () => void;
}

export function GestionInventarioAlerts({
  tiendaId,
  onVerVencidos,
}: GestionInventarioAlertsProps) {
  return <VencidosBanner tiendaId={tiendaId} onVerVencidos={onVerVencidos} />;
}
