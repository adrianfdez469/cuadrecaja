"use client";

import { useRouter } from "next/navigation";
import { Button, Stack } from "@mui/material";
import {
  Category,
  Inventory,
  People,
  ReportProblem,
  ShowChart,
} from "@mui/icons-material";
import { usePermisos } from "@/utils/permisos_front";

const LINKS = [
  {
    label: "Tendencias",
    path: "/reportes/tendencias",
    permission: "recuperaciones.reportes.tendencias",
    icon: ShowChart,
  },
  {
    label: "Inventario",
    path: "/reportes/inventario",
    permission: "recuperaciones.reportes.inventario",
    icon: Inventory,
  },
  {
    label: "Rentabilidad",
    path: "/reportes/rentabilidad",
    permission: "recuperaciones.reportes.rentabilidad",
    icon: Category,
  },
  {
    label: "Operación",
    path: "/reportes/operacion",
    permission: "recuperaciones.reportes.operacion",
    icon: People,
  },
  {
    label: "Mermas",
    path: "/reportes/mermas",
    permission: "recuperaciones.reportes.mermas",
    icon: ReportProblem,
  },
];

/** Drill-down from the dashboard summary into the detailed reports. */
export function DashboardReportLinks() {
  const router = useRouter();
  const { verificarPermiso } = usePermisos();

  const visible = LINKS.filter((link) => verificarPermiso(link.permission));
  if (visible.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {visible.map(({ label, path, icon: Icon }) => (
        <Button
          key={path}
          size="small"
          variant="outlined"
          startIcon={<Icon />}
          onClick={() => router.push(path)}
        >
          {label}
        </Button>
      ))}
    </Stack>
  );
}
