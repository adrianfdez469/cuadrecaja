"use client";

import React, { useEffect, useState } from "react";
import { StatStrip } from "@/components/StatStrip";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import {
  VENTAS_CARD_ESTIMATED_HEIGHT,
  VENTAS_ROW_ESTIMATED_HEIGHT,
  VENTAS_VIRTUALIZATION_MIN_ROWS,
} from "@/constants/pos";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  IconButton,
  Alert,
  Button,
  InputAdornment,
  Card,
  CardContent,
  Stack,
  Tooltip,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import { Delete, Search, Refresh, Visibility } from "@mui/icons-material";
import { fetchLastPeriod, openPeriod } from "@/services/cierrePeriodService";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ICierrePeriodo } from "@/schemas/cierre";
import { IVenta } from "@/schemas/venta";
import useConfirmDialog from "@/components/confirmDialog";
import {
  getSells,
  removeProductFromSale,
  removeSell,
} from "@/services/sellService";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { LoadingState } from "@/components/LoadingState";
import SelectableTextField from "@/components/SelectableTextField";
import VentaDetailDialog from "./components/VentaDetailDialog";
import { formatDate, formatDateTime, isToday } from "@/utils/formatters";
import { saleReportedAt } from "@/lib/venta/saleTime";
import { toSaleTimestamps } from "@/lib/venta/ventaTimestamps";
import { hasSyncTrace } from "@/lib/venta/saleSyncTrace";
import {
  matchesSaleSearchTerm,
  saleHistoryEmptyReason,
} from "@/lib/venta/saleHistoryFilter";
import SyncTraceFilterToggle from "./components/SyncTraceFilterToggle";
import SalesHistoryEmptyState from "./components/SalesHistoryEmptyState";
import { usePermisos } from "@/utils/permisos_front";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { touch } from "@/theme/tokens";

/**
 * Said once, in one node, at every width: the two figures follow whatever the
 * list is showing. Kept as a constant so its rendered text is exactly this
 * string, with no help from JSX whitespace collapsing.
 */
const FILTER_FIGURES_NOTICE =
  "Con el filtro activo, Total Vendido y Monto Hoy cuentan solo las ventas que se ven. Quita el filtro para ver las cifras del período completo.";

const Ventas = () => {
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { verificarPermiso } = usePermisos();

  const [currentPeriod, setCurrentPeriod] = useState<ICierrePeriodo>();
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [ventas, setVentas] = useState<IVenta[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlySyncTraced, setShowOnlySyncTraced] = useState(false);
  const [noPeriodFound, setNoPeriodFound] = useState(false);
  const [noLocalActual, setNoLocalActual] = useState(false);
  const [isProcessingPeriod, setIsProcessingPeriod] = useState(false);
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedVenta, setSelectedVenta] = useState<IVenta | null>(null);
  const [deletingVentaProductoId, setDeletingVentaProductoId] = useState<
    string | null
  >(null);
  const [deletingVentaId, setDeletingVentaId] = useState<string | null>(null);

  const handleCreateFirstPeriod = async () => {
    // Evitar múltiples clics mientras se procesa
    if (isProcessingPeriod) return;

    setIsProcessingPeriod(true);
    try {
      setIsDataLoading(true);
      const tiendaId = user.localActual.id;
      await openPeriod(tiendaId);
      await loadData();
      showMessage("Primer período creado exitosamente", "success");
    } catch (error) {
      console.error(error);
      showMessage("Error al crear el primer período", "error");
    } finally {
      setIsProcessingPeriod(false);
    }
  };

  const loadData = async (): Promise<IVenta[]> => {
    setIsDataLoading(true);
    setNoPeriodFound(false);
    setNoLocalActual(false);

    try {
      if (!user.localActual || !user.localActual.id) {
        setNoLocalActual(true);
        return [];
      }

      const tiendaId = user.localActual.id;
      const currentPeriod = await fetchLastPeriod(tiendaId);

      if (!currentPeriod) {
        setNoPeriodFound(true);
        return [];
      }

      setCurrentPeriod(currentPeriod);

      const data = await getSells(tiendaId, currentPeriod.id);
      setVentas(data || []);
      return data || [];
    } catch (error) {
      console.error(error);
      showMessage(
        "Error: los datos de ventas no pudieron ser cargados",
        "error",
      );
      setVentas([]);
      return [];
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleOpenVenta = (venta: IVenta) => {
    setSelectedVenta(venta);
    setDetailDialogOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedVenta(null);
  };

  const handleCancelVenta = async (venta: IVenta) => {
    confirmDialog(
      "¿Está seguro que desea eliminar completamente esta venta?",
      async () => {
        try {
          setDeletingVentaId(venta.id);
          const tiendaId = user.localActual.id;
          await removeSell(tiendaId, currentPeriod.id, venta.id);
          setVentas((prev) => prev.filter((v) => v.id !== venta.id));
          showMessage("La venta fue eliminada satisfactoriamente", "success");
          handleCloseDetail();
        } catch (error) {
          console.error(error);
          showMessage("La venta no pudo ser eliminada", "error");
        } finally {
          setDeletingVentaId(null);
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const handleDeleteProductoFromVenta = (
    venta: IVenta,
    ventaProductoId: string,
  ) => {
    confirmDialog(
      "¿Está seguro que desea eliminar este producto de la venta?",
      async () => {
        try {
          setDeletingVentaProductoId(ventaProductoId);
          const tiendaId = user.localActual.id;
          await removeProductFromSale(
            tiendaId,
            currentPeriod.id,
            venta.id,
            ventaProductoId,
          );
          showMessage("Producto eliminado de la venta", "success");
        } catch (error) {
          console.error(error);
          const msg =
            (error as { response?: { data?: { error?: string } } })?.response
              ?.data?.error || "No se pudo eliminar el producto de la venta";
          showMessage(msg, "error");
        } finally {
          setDeletingVentaProductoId(null);
          const data = await loadData();
          const updated = data.find((v) => v.id === venta.id) || null;
          if (updated) {
            setSelectedVenta(updated);
          } else {
            handleCloseDetail();
          }
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  useEffect(() => {
    if (!loadingContext) {
      loadData();
    }
  }, [loadingContext]);

  const searchedVentas = ventas.filter((venta) =>
    matchesSaleSearchTerm(venta, searchTerm),
  );

  const filteredVentas = showOnlySyncTraced
    ? searchedVentas.filter(hasSyncTrace)
    : searchedVentas;

  const emptyReason = saleHistoryEmptyReason({
    totalCount: ventas.length,
    visibleCount: filteredVentas.length,
    searchTerm,
    syncTraceFilterActive: showOnlySyncTraced,
    anySaleWithSyncTrace: ventas.some(hasSyncTrace),
  });

  // Un negocio activo acumula ventas sin techo, y esta lista las pintaba todas
  // —tarjeta en móvil, fila en escritorio— cada vez que se abría la pantalla.
  // Las alturas difieren entre las dos vistas, de ahí los dos estimados.
  const ventasVirtual = useVirtualRows(filteredVentas, {
    minItems: VENTAS_VIRTUALIZATION_MIN_ROWS,
    estimateSize: isMobile
      ? VENTAS_CARD_ESTIMATED_HEIGHT
      : VENTAS_ROW_ESTIMATED_HEIGHT,
  });

  // Cálculos para estadísticas
  const montoTotal = filteredVentas.reduce(
    (sum, venta) => sum + (venta.total || 0),
    0,
  );

  const montoHoy = filteredVentas
    .filter((v) => isToday(saleReportedAt(toSaleTimestamps(v))))
    .reduce((sum, venta) => sum + (venta.total || 0), 0);

  if (loadingContext || isDataLoading) {
    return (
      <PageContainer
        title="Ventas"
        breadcrumbs={[{ label: "Inicio", href: "/home" }, { label: "Ventas" }]}
        maxWidth="xl"
      >
        <LoadingState variant={isMobile ? "cards" : "table"} />
      </PageContainer>
    );
  }

  if (noLocalActual) {
    return (
      <PageContainer
        title="Ventas"
        breadcrumbs={[{ label: "Inicio", href: "/home" }, { label: "Ventas" }]}
      >
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para ver y gestionar las ventas, necesitas tener una tienda
            seleccionada como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la
            configuración.
          </Typography>
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              href="/configuracion/tiendas"
              sx={{ mr: 2 }}
            >
              Ir a Configuración de Tiendas
            </Button>
          </Box>
        </Alert>
      </PageContainer>
    );
  }

  const breadcrumbs = [{ label: "Inicio", href: "/home" }, { label: "Ventas" }];

  if (noPeriodFound) {
    return (
      <PageContainer title="Ventas" breadcrumbs={breadcrumbs}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            ¡Bienvenido a tu nuevo negocio!
          </Typography>
          <Typography variant="body1" gutterBottom>
            No se encontraron períodos de cierre. Para comenzar a registrar
            ventas necesitas crear tu primer período de cierre.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Una vez creado el período, podrás realizar ventas desde el POS y
            revisarlas aquí.
          </Typography>
        </Alert>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleCreateFirstPeriod}
          disabled={isDataLoading || isProcessingPeriod}
        >
          {isProcessingPeriod ? "Creando período..." : "Crear Primer Período"}
        </Button>
      </PageContainer>
    );
  }

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      <Tooltip title="Actualizar ventas">
        <IconButton onClick={loadData} disabled={isDataLoading} size="small">
          <Refresh />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  // Componente de estadística móvil optimizado
  return (
    <PageContainer
      title={`Ventas - Período ${currentPeriod ? formatDate(currentPeriod.fechaInicio) : ""}`}
      subtitle={
        !isMobile ? "Historial de ventas del período actual" : undefined
      }
      breadcrumbs={breadcrumbs}
      headerActions={headerActions}
      maxWidth="xl"
    >
      {isMobile ? (
        // En mobile las dos cifras van apiladas en una sola caja, no en
        // columnas — el mockup (`ventas-con-datos-movil.html`) las dibuja
        // como filas de una tarjeta, no como el grid 2-up de `StatStrip`.
        <Box
          sx={{
            bgcolor: "background.paper",
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            mb: 2,
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
            <Typography variant="body2" color="text.secondary">
              Total Vendido
            </Typography>
            <MultiCurrencyAmount amount={montoTotal} variant="stat" />
          </Box>
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Monto Hoy
            </Typography>
            <MultiCurrencyAmount amount={montoHoy} variant="stat" />
          </Box>
        </Box>
      ) : (
        <StatStrip
          variant="card"
          stats={[
            {
              label: "Total Vendido",
              value: <MultiCurrencyAmount amount={montoTotal} variant="stat" />,
            },
            {
              label: "Monto Hoy",
              value: <MultiCurrencyAmount amount={montoHoy} variant="stat" />,
            },
          ]}
        />
      )}

      {showOnlySyncTraced && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {FILTER_FIGURES_NOTICE}
        </Alert>
      )}

      {/* Lista de ventas */}
      <ContentCard
        title="Historial de Ventas"
        subtitle={
          !isMobile
            ? "Haz clic en cualquier venta para ver los detalles"
            : undefined
        }
        headerActions={
          // Stacked at 320px and side by side from `sm` up, with the search
          // first: `useFlexGap` so the gap survives the wrap onto a second
          // line, and `stretch` so the button fills the column without needing
          // a width of its own.
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            spacing={1.25}
            useFlexGap
            flexWrap="wrap"
          >
            <SelectableTextField
              size="small"
              placeholder={isMobile ? "Buscar..." : "Buscar venta..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{
                width: isMobile ? "100%" : 252,
                flexShrink: 0,
                // The field sits next to a control that clears the touch floor
                // by itself, so it has to clear it too. `border-box` because
                // InputBase sets the inner input to `content-box`, where a
                // height would add its padding on top.
                "& .MuiOutlinedInput-input": {
                  boxSizing: "border-box",
                  height: touch.min,
                },
              }}
            />
            <SyncTraceFilterToggle
              active={showOnlySyncTraced}
              onToggle={setShowOnlySyncTraced}
            />
          </Stack>
        }
        noPadding
        fullHeight
      >
        {emptyReason !== null ? (
          <SalesHistoryEmptyState
            reason={emptyReason}
            onClearFilter={() => setShowOnlySyncTraced(false)}
          />
        ) : isMobile ? (
          // Vista móvil con cards más densos
          // Con muchas ventas la lista gana su propio scroll y solo pinta las
          // tarjetas visibles; con pocas se comporta igual que antes.
          <Box ref={ventasVirtual.containerRef} sx={{ p: 1 }}>
            <Stack
              spacing={1}
              sx={
                ventasVirtual.needsVirtualization
                  ? {
                      position: "relative",
                      height: `${ventasVirtual.totalSize}px`,
                    }
                  : undefined
              }
            >
              {ventasVirtual.visible.map(({ item: venta, virtual }) => {
                const reportedAt = saleReportedAt(toSaleTimestamps(venta));

                return (
                  <Card
                    key={venta.id}
                    {...(virtual
                      ? {
                          "data-index": virtual.index,
                          ref: ventasVirtual.measureElement,
                          style: {
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            transform: `translateY(${virtual.start - ventasVirtual.offset}px)`,
                          },
                        }
                      : {})}
                    onClick={() => handleOpenVenta(venta)}
                    sx={{
                      cursor: "pointer",
                      "&:hover": {
                        backgroundColor: "semantic.surface.sunken",
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        gap={1.5}
                      >
                        {/* venta.total ya está en moneda base; mostramos base + equivalentes */}
                        <MultiCurrencyAmount
                          amount={venta.total}
                          variant="stat"
                        />
                        <Stack direction="row" gap={0.5} sx={{ flexShrink: 0 }}>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVenta(venta);
                            }}
                            color="primary"
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelVenta(venta);
                            }}
                            color="error"
                            disabled={deletingVentaId === venta.id}
                          >
                            {deletingVentaId === venta.id ? (
                              <CircularProgress size={18} />
                            ) : (
                              <Delete fontSize="small" />
                            )}
                          </IconButton>
                        </Stack>
                      </Box>

                      <Stack
                        direction="row"
                        alignItems="center"
                        gap={1}
                        sx={{
                          mt: 1.5,
                          pt: 1.25,
                          borderTop: 1,
                          borderColor: "divider",
                        }}
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          #{venta.id.slice(-8)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          · {formatDateTime(reportedAt)}
                        </Typography>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            ml: "auto",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {venta.productos?.length || 0} prod.
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mt: 0.5 }}
                      >
                        {venta.usuario?.nombre || ""}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        ) : (
          // Vista desktop con tabla
          // Sin alto fijo: la tabla crece y scrollea la página, como siempre.
          <TableContainer ref={ventasVirtual.containerRef} sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>ID Venta</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Monto Total</TableCell>
                  <TableCell align="right">Productos</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell align="center">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ventasVirtual.paddingTop > 0 && (
                  <TableRow style={{ height: ventasVirtual.paddingTop }}>
                    <TableCell colSpan={6} sx={{ p: 0, border: 0 }} />
                  </TableRow>
                )}
                {ventasVirtual.visible.map(({ item: venta, virtual }) => {
                  const reportedAt = saleReportedAt(toSaleTimestamps(venta));

                  return (
                    <TableRow
                      key={venta.id}
                      {...(virtual
                        ? {
                            "data-index": virtual.index,
                            ref: ventasVirtual.measureElement,
                          }
                        : {})}
                      onClick={() => handleOpenVenta(venta)}
                      sx={{
                        cursor: "pointer",
                        "&:hover": {
                          backgroundColor: "semantic.surface.sunken",
                        },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          #{venta.id.slice(-8)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {formatDate(reportedAt)} ·{" "}
                          {formatDateTime(reportedAt).split(" • ")[1]}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {/* venta.total ya está en moneda base; mostramos base + equivalentes */}
                        <MultiCurrencyAmount
                          amount={venta.total}
                          align="right"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          sx={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          {venta.productos?.length || 0}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {venta.usuario?.nombre || ""}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack
                          direction="row"
                          spacing={0.5}
                          justifyContent="center"
                        >
                          <Tooltip title="Ver detalles">
                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenVenta(venta);
                              }}
                              size="small"
                              color="primary"
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Eliminar venta">
                            <span>
                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelVenta(venta);
                                }}
                                size="small"
                                color="error"
                                disabled={deletingVentaId === venta.id}
                              >
                                {deletingVentaId === venta.id ? (
                                  <CircularProgress size={18} />
                                ) : (
                                  <Delete fontSize="small" />
                                )}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {ventasVirtual.paddingBottom > 0 && (
                  <TableRow style={{ height: ventasVirtual.paddingBottom }}>
                    <TableCell colSpan={6} sx={{ p: 0, border: 0 }} />
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Diálogo de detalles de venta */}
      <VentaDetailDialog
        open={detailDialogOpen}
        onClose={handleCloseDetail}
        venta={selectedVenta}
        deletingVentaProductoId={deletingVentaProductoId}
        deletingVenta={!!selectedVenta && deletingVentaId === selectedVenta.id}
        canDeleteProducts={
          !!selectedVenta &&
          (verificarPermiso("operaciones.pos-venta.cancelarventa") ||
            verificarPermiso("operaciones.ventas.eliminar"))
        }
        onDeleteProduct={handleDeleteProductoFromVenta}
        onDeleteSale={handleCancelVenta}
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
};

export default Ventas;
