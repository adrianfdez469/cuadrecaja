"use client";

import { Divider, Stack } from "@mui/material";
import { ContentCard } from "@/components/ContentCard";
import MonedaBreakdownRow from "@/app/cierre/components/MonedaBreakdownRow";
import { useAppContext } from "@/context/AppContext";
import { DENOMINACIONES } from "@/constants/billDenominations";
import type { ICierreData } from "@/schemas/cierre";

interface Props {
  tiendaId: string;
  cierreId: string;
  resumenMonedas: NonNullable<ICierreData["resumenMonedas"]>;
  cajaDeducciones?: ICierreData["cajaDeducciones"];
}

/**
 * The drawer of a closed period, per currency — the same row the open-period
 * screen uses, so the initial fund, the gross → final figures and the tips
 * are labelled instead of collapsed into one "≈ base" that read as sales.
 */
export default function CajaPorMonedaHistorico({
  tiendaId,
  cierreId,
  resumenMonedas,
  cajaDeducciones,
}: Readonly<Props>) {
  const { monedasNegocio } = useAppContext();

  if (resumenMonedas.length === 0) return null;

  return (
    <ContentCard
      title="Caja por moneda"
      // Shown at every width, phone included: it is the one sentence that
      // says what this number is NOT, and the phone is where it matters most.
      subtitle="Fondo inicial + cobros − deducciones. No es el total de ventas."
      fullHeight={false}
    >
      <Stack spacing={1.5} divider={<Divider flexItem />}>
        {resumenMonedas.map((rm) => {
          const negocioMoneda = monedasNegocio.find(
            (m) => m.monedaCode === rm.monedaCode,
          );
          const denominations =
            negocioMoneda?.moneda?.denominaciones
              ?.filter((d) => d.activo)
              .map((d) => d.valor)
              .sort((a, b) => b - a) ??
            (rm.monedaCode === "CUP"
              ? [...DENOMINACIONES.CUP].sort((a, b) => b - a)
              : []);
          return (
            <MonedaBreakdownRow
              key={rm.monedaCode}
              monedaCode={rm.monedaCode}
              totalEfectivo={rm.totalEfectivo}
              totalTransfer={rm.totalTransfer}
              equivalenteBase={rm.equivalenteBase}
              totalEfectivoBruto={rm.totalEfectivoBruto}
              equivalenteBaseBruto={rm.equivalenteBaseBruto}
              initialFund={rm.initialFund}
              tipCash={rm.tipCash}
              tipTransfer={rm.tipTransfer}
              tiendaId={tiendaId}
              cierreId={cierreId}
              isOpen={false}
              denominations={denominations}
              deducciones={cajaDeducciones?.[rm.monedaCode] || []}
            />
          );
        })}
      </Stack>
    </ContentCard>
  );
}
