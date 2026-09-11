"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, IconButton, Tooltip, useMediaQuery, useTheme } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { StatStrip } from "@/components/StatStrip";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { useAppContext } from "@/context/AppContext";
import { formatMontoEnMoneda } from "@/utils/formatters";
import { getCuentasPorCobrar } from "@/services/cuentasPorCobrarService";
import {
  countFiltrosActivos,
  CUENTAS_POR_COBRAR_COPY,
  CUENTAS_POR_COBRAR_DOM,
} from "@/constants/cuentasPorCobrar";
import {
  buildFiltroOpciones,
  formatAntiguedadDias,
  type IFiltroOpciones,
} from "@/lib/cuentasPorCobrar/panel";
import type {
  ICuentasPorCobrarFiltros,
  IDeudorRow,
} from "@/schemas/cuentasPorCobrarPanel";
import { FiltrosDeudores } from "./components/FiltrosDeudores";
import { DeudoresMobileList } from "./components/DeudoresMobileList";
import { DeudoresTable } from "./components/DeudoresTable";

const COPY = CUENTAS_POR_COBRAR_COPY;
const DOM = CUENTAS_POR_COBRAR_DOM;

const SIN_OPCIONES: IFiltroOpciones = { deudores: [], tiendas: [] };

/**
 * `/cuentas-por-cobrar` — who owes what, since when.
 *
 * State is LOCAL to the screen: nothing here is needed outside its own route, so no Zustand
 * store is added (contract § 7). There is no pagination either (ADR 0126), so no paginator is
 * mounted: a control that governs nothing is noise.
 */
export default function CuentasPorCobrarPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  // A SECOND breakpoint, and only for CONTENT: the seventh column and the phone line are mounted
  // conditionally, which `sx={{ display }}` cannot do — `textContent` walks through a hidden node.
  const isWide = useMediaQuery(theme.breakpoints.up("md"));
  const router = useRouter();
  const { monedaBase } = useAppContext();

  const [filtros, setFiltros] = useState<ICuentasPorCobrarFiltros>({});
  const [deudores, setDeudores] = useState<IDeudorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"error" | "offline" | null>(null);
  // The filter universe is rewritten with the response ONLY when the request carried no
  // `clienteId`: with one set, the answer holds a single debtor and the universe must not shrink
  // to it.
  const [opciones, setOpciones] = useState<IFiltroOpciones>(SIN_OPCIONES);
  const universoCargado = useRef(false);

  const activos = countFiltrosActivos(filtros);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const respuesta = await getCuentasPorCobrar(filtros);
      setDeudores(respuesta.data);
      if (!filtros.clienteId || !universoCargado.current) {
        setOpciones(buildFiltroOpciones(respuesta.data));
        universoCargado.current = true;
      }
    } catch (e) {
      setDeudores([]);
      setError(
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "offline"
          : "error",
      );
      console.error("[/cuentas-por-cobrar]", e);
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const totales = useMemo(() => {
    let saldo = 0;
    let cuentas = 0;
    let conSaldo = 0;
    let masAntigua: number | null = null;
    for (const deudor of deudores) {
      saldo += deudor.saldo;
      cuentas += deudor.cuentasAbiertas;
      if (deudor.estado === "CON_DEUDA") conSaldo += 1;
      if (
        deudor.antiguedadDias !== null &&
        (masAntigua === null || deudor.antiguedadDias > masAntigua)
      ) {
        masAntigua = deudor.antiguedadDias;
      }
    }
    return {
      saldo: Math.round(saldo * 100) / 100,
      cuentas,
      conSaldo,
      masAntigua,
    };
  }, [deudores]);

  const breadcrumbs = [
    { label: COPY.breadcrumbInicio, href: "/home" },
    { label: COPY.pageTitle },
  ];

  const headerActions = (
    <Tooltip title={COPY.recargar}>
      <span>
        <IconButton
          aria-label={COPY.recargar}
          onClick={cargar}
          disabled={loading}
        >
          <RefreshIcon />
        </IconButton>
      </span>
    </Tooltip>
  );

  const verDetalle = (clienteId: string) =>
    router.push(`/cuentas-por-cobrar/${clienteId}`);

  const subtitle = isMobile
    ? `${deudores.length} deudores · ${formatMontoEnMoneda(totales.saldo, monedaBase)} por cobrar`
    : `${deudores.length} deudores registrados`;

  const contenido = () => {
    if (loading) {
      return (
        <Box sx={{ p: 2 }}>
          {isMobile ? (
            <LoadingState variant="cards" count={4} />
          ) : (
            <LoadingState variant="table" count={6} columns={isWide ? 7 : 6} />
          )}
        </Box>
      );
    }

    if (error) {
      return (
        <ErrorState
          kind={error}
          title={error === "offline" ? COPY.offlineTitulo : COPY.errorTitulo}
          description={
            error === "offline"
              ? COPY.offlineDescripcion
              : COPY.errorDescripcion
          }
          onRetry={cargar}
        />
      );
    }

    if (deudores.length === 0) {
      // Which kind of nothing this is comes from the filters, never from the length of the
      // answer (design § 1).
      return activos > 0 ? (
        <EmptyState
          variant="no-results"
          title={COPY.sinResultadosTitulo}
          description={COPY.sinResultadosDescripcion}
          action={{
            label: COPY.sinResultadosAccion,
            onClick: () => setFiltros({}),
          }}
        />
      ) : (
        <EmptyState
          variant="empty"
          title={COPY.vacioTitulo}
          description={COPY.vacioDescripcion}
        />
      );
    }

    return isMobile ? (
      <DeudoresMobileList
        deudores={deudores}
        monedaBase={monedaBase}
        onVerDetalle={verDetalle}
      />
    ) : (
      <DeudoresTable
        deudores={deudores}
        monedaBase={monedaBase}
        isWide={isWide}
        onVerDetalle={verDetalle}
      />
    );
  };

  return (
    <PageContainer
      title={COPY.pageTitle}
      subtitle={COPY.pageSubtitle}
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {/*
        The strip does not mount at 320 px: on a phone it pushes the list half a screen down, and
        the two figures that matter travel in the card's subtitle instead. Same departure the
        clientes screen of F-033 already took.
      */}
      {!isMobile && (
        <Box sx={{ mb: 3 }}>
          <StatStrip
            variant="card"
            stats={[
              { label: COPY.statDeudores, value: totales.conSaldo },
              {
                label: COPY.statTotal,
                value: formatMontoEnMoneda(totales.saldo, monedaBase),
              },
              { label: COPY.statCuentas, value: totales.cuentas },
              {
                label: COPY.statMasAntigua,
                value:
                  totales.masAntigua === null
                    ? COPY.sinDato
                    : formatAntiguedadDias(totales.masAntigua),
              },
            ]}
          />
        </Box>
      )}

      <Box
        component="section"
        className={DOM.panel}
        aria-label={COPY.seccionEtiqueta}
      >
        <FiltrosDeudores
          filtros={filtros}
          opciones={opciones}
          onChange={setFiltros}
          isMobile={isMobile}
        />

        <ContentCard
          title={COPY.listaTitulo}
          subtitle={subtitle}
          noPadding
          fullHeight
        >
          {contenido()}
        </ContentCard>
      </Box>
    </PageContainer>
  );
}
