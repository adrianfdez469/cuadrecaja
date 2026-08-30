"use client";

import { useRouter } from "next/navigation";
import { Alert, Card } from "@mui/material";
import {
  Category,
  Inventory,
  ShowChart,
  People,
  ReportProblem,
} from "@mui/icons-material";
import { PageContainer } from "@/components/PageContainer";
import { useAppContext } from "@/context/AppContext";
import { usePermisos } from "@/utils/permisos_front";
import { TipoLocal } from "@/schemas/tienda";

import { ReportRow } from "./components/ReportRow";

type ReportCard = {
  title: string;
  description: string;
  path: string;
  permission: string;
  icon: typeof ShowChart;
  /** Reports that make no sense in a warehouse, which never sells. */
  hideOnWarehouse?: boolean;
};

const REPORTS: ReportCard[] = [
  {
    title: "Tendencias",
    description:
      "Evolución de ventas y ganancia frente al período anterior, y horarios de mayor venta.",
    path: "/reportes/tendencias",
    permission: "recuperaciones.reportes.tendencias",
    icon: ShowChart,
    hideOnWarehouse: true,
  },
  {
    title: "Inventario",
    description:
      "Rotación y días de cobertura, capital inmovilizado, análisis ABC y valor en riesgo por vencimiento.",
    path: "/reportes/inventario",
    permission: "recuperaciones.reportes.inventario",
    icon: Inventory,
  },
  {
    title: "Rentabilidad",
    description:
      "Estado de resultados del período, margen por categoría y efectividad de los descuentos.",
    path: "/reportes/rentabilidad",
    permission: "recuperaciones.reportes.rentabilidad",
    icon: Category,
    hideOnWarehouse: true,
  },
  {
    title: "Operación",
    description:
      "Rendimiento por vendedor y mix de métodos de pago y monedas, con conciliación por destino.",
    path: "/reportes/operacion",
    permission: "recuperaciones.reportes.operacion",
    icon: People,
    hideOnWarehouse: true,
  },
  {
    title: "Mermas y devoluciones",
    description: "Pérdidas por producto y por causa, valorizadas al costo.",
    path: "/reportes/mermas",
    permission: "recuperaciones.reportes.mermas",
    icon: ReportProblem,
  },
];

export default function ReportesHubPage() {
  const router = useRouter();
  const { user } = useAppContext();
  const { verificarPermiso } = usePermisos();

  const isWarehouse = user?.localActual?.tipo === TipoLocal.ALMACEN;

  const visible = REPORTS.filter((report) => {
    if (isWarehouse && report.hideOnWarehouse) return false;
    return verificarPermiso(report.permission);
  });

  return (
    <PageContainer
      title="Reportes"
      subtitle="Análisis del negocio sobre los períodos ya cerrados"
      breadcrumbs={[{ label: "Inicio", href: "/home" }, { label: "Reportes" }]}
    >
      {visible.length === 0 ? (
        <Alert severity="info">
          No tienes permisos para ver ningún reporte.
        </Alert>
      ) : (
        <Card>
          {visible.map(({ title, description, path, icon }, index) => (
            <ReportRow
              key={path}
              title={title}
              description={description}
              icon={icon}
              divider={index > 0}
              onClick={() => router.push(path)}
            />
          ))}
        </Card>
      )}
    </PageContainer>
  );
}
