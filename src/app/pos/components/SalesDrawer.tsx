import { Sale, useSalesStore } from "@/store/salesStore";
import {
  Close,
  CloudUpload,
  Done,
  Sync,
  Wifi,
  WifiOff,
  Print,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Drawer,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { FC, useEffect, useMemo, useState, Fragment } from "react";
import { useVirtualRows } from "@/hooks/useVirtualRows";
import {
  VENTAS_ROW_ESTIMATED_HEIGHT,
  VENTAS_VIRTUALIZATION_MIN_ROWS,
} from "@/constants/pos";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { SaleProductsDetailDrawer } from "./SaleProductsDetailDrawer";
import {
  createSell,
  getSells,
  removeSell,
  removeProductFromSale,
} from "@/services/sellService";
import { useMessageContext } from "@/context/MessageContext";
import useConfirmDialog from "@/components/confirmDialog";
import { useAppContext } from "@/context/AppContext";
import { ICierrePeriodo } from "@/schemas/cierre";
import { usePermisos } from "@/utils/permisos_front";
import { formatDateTime, formatMontoEnMoneda } from "@/utils/formatters";
import { IProductoTiendaPos } from "@/schemas/producto";
import { convertToBase } from "@/lib/currency";
import { usePrinter } from "@/features/printing/hooks/usePrinter";

interface IProps {
  showSales: boolean;
  period: ICierrePeriodo;
  handleClose: () => void;
  reloadProdsAndCategories: () => void;
  incrementarCantidades: (id: string, nuevaCantidad: number) => void;
  productosTienda?: IProductoTiendaPos[];
}

export const SalesDrawer: FC<IProps> = ({
  showSales,
  period,
  handleClose,
  reloadProdsAndCategories,
  incrementarCantidades,
  productosTienda,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const {
    sales,
    markSynced,
    markSyncError,
    markSyncing,
    deleteSale,
    removeProductFromSale: removeProductFromSaleStore,
    synchronizeSales,
  } = useSalesStore();

  // Ordenadas en una copia: `sales` es el array del store y `.sort()` ordena
  // en el sitio, así que esto estaba mutando el estado en pleno render.
  const sortedSales = useMemo(
    () =>
      [...sales].sort((a, b) => {
        if (!a.synced && b.synced) return -1;
        if (a.synced && !b.synced) return 1;
        return b.createdAt - a.createdAt;
      }),
    [sales],
  );

  // La moneda de cada línea se resolvía con un `find` sobre el catálogo
  // completo, una vez por producto y por venta. Con 2000 productos en la
  // tienda eso es un recorrido lineal por cada línea de cada venta en pantalla.
  const monedaPorProductoTienda = useMemo(() => {
    const porId = new Map<string, string | null>();
    for (const pt of productosTienda ?? []) {
      porId.set(pt.id, pt.monedaPrecioCode ?? null);
    }
    return porId;
  }, [productosTienda]);

  // Modo contenedor, no ventana: esta lista vive dentro de un Drawer, que ya
  // es su propia área de scroll — la página de detrás no se mueve.
  const ventasVirtual = useVirtualRows(sortedSales, {
    minItems: VENTAS_VIRTUALIZATION_MIN_ROWS,
    estimateSize: VENTAS_ROW_ESTIMATED_HEIGHT,
    scroller: "container",
  });

  const [showProducts, setShowProducts] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale>();
  const [disableAll, setDisableAll] = useState(false);
  const [deletingSaleId, setDeletingSaleId] = useState<string | null>(null);
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const [offline, setOffline] = useState(false);
  const { user, tasasVigentes, monedaBase } = useAppContext();
  const { verificarPermiso } = usePermisos();
  const { reprintSale } = usePrinter(user?.localActual?.id);
  const puedeImprimir = verificarPermiso("operaciones.pos-venta.imprimir");

  const handleSelectViewSale = (sale) => {
    setSelectedSale(sale);
    setShowProducts(true);
  };

  const handleSyncAll = async () => {
    setDisableAll(true);
    const salesToSync = sales.filter((sale) => !sale.synced);
    for (const syncObj of salesToSync) {
      try {
        markSyncing(syncObj.identifier);
        const multimonedaSyncAll = syncObj.pagosDetalle
          ? {
              monedaCobro: syncObj.monedaCobro ?? "CUP",
              pagosDetalle: syncObj.pagosDetalle,
              vueltoDetalle: syncObj.vueltoDetalle ?? [],
              tasaSnapshot: syncObj.tasaSnapshot ?? {},
            }
          : undefined;
        const ventaDb = await createSell(
          syncObj.tiendaId,
          syncObj.cierreId,
          syncObj.usuarioId,
          syncObj.total,
          syncObj.totalcash,
          syncObj.totaltransfer,
          syncObj.productos,
          syncObj.identifier,
          syncObj.transferDestinationId,
          syncObj.createdAt, // 🆕 Usar timestamp de la venta
          syncObj.wasOffline, // 🆕 Usar estado offline de la venta
          syncObj.syncAttempts, // 🆕 Enviar intentos de sincronización
          syncObj.discountCodes, // 🆕 Reenviar códigos de descuento si existen
          multimonedaSyncAll,
        );
        markSynced(syncObj.identifier, ventaDb.id);
        setOffline(false);
        reloadProdsAndCategories();
      } catch (error) {
        console.error(`Error sincronizando venta ${syncObj.identifier}`, error);

        // Manejo mejorado de errores
        if (error.message?.includes("TIMEOUT_ERROR")) {
          markSyncError(syncObj.identifier);
          showMessage(
            "Timeout al sincronizar venta - se reintentará automáticamente",
            "warning",
          );
        } else if (error.message?.includes("NETWORK_ERROR")) {
          markSyncError(syncObj.identifier);
          showMessage("Error de red al sincronizar venta", "warning");
          setOffline(true);
        } else if (error.message?.includes("SERVER_ERROR")) {
          markSyncError(syncObj.identifier);
          showMessage("Error del servidor al sincronizar venta", "error");
        } else if (error.message?.includes("CLIENT_ERROR")) {
          markSyncError(syncObj.identifier);
          showMessage("Error en los datos de la venta", "error");
        } else {
          markSyncError(syncObj.identifier);
          showMessage("Error al sincronizar venta", "error", error);
        }
      } finally {
        setDisableAll(false);
      }
    }
  };

  const handleSyncOne = async (sale: Sale) => {
    setDisableAll(true);
    const syncObj = sales.find((s) => s.identifier === sale.identifier);
    try {
      markSyncing(syncObj.identifier);
      const multimonedaSyncOne = syncObj.pagosDetalle
        ? {
            monedaCobro: syncObj.monedaCobro ?? "CUP",
            pagosDetalle: syncObj.pagosDetalle,
            vueltoDetalle: syncObj.vueltoDetalle ?? [],
            tasaSnapshot: syncObj.tasaSnapshot ?? {},
          }
        : undefined;
      const ventaDb = await createSell(
        syncObj.tiendaId,
        syncObj.cierreId,
        syncObj.usuarioId,
        syncObj.total,
        syncObj.totalcash,
        syncObj.totaltransfer,
        syncObj.productos,
        syncObj.identifier,
        syncObj.transferDestinationId,
        syncObj.createdAt, // 🆕 Usar timestamp de la venta
        syncObj.wasOffline, // 🆕 Usar estado offline de la venta
        syncObj.syncAttempts, // 🆕 Enviar intentos de sincronización
        syncObj.discountCodes, // 🆕 Reenviar códigos de descuento si existen
        multimonedaSyncOne,
      );
      markSynced(syncObj.identifier, ventaDb.id);
      setOffline(false);
      reloadProdsAndCategories();
    } catch (error) {
      console.error(`Error sincronizando venta ${syncObj.identifier}`, error);

      // Manejo mejorado de errores
      if (error.message?.includes("TIMEOUT_ERROR")) {
        markSyncError(syncObj.identifier);
        showMessage(
          "Timeout al sincronizar venta - se reintentará automáticamente",
          "warning",
        );
      } else if (error.message?.includes("NETWORK_ERROR")) {
        markSyncError(syncObj.identifier);
        showMessage("Error de red al sincronizar venta", "warning");
        setOffline(true);
      } else if (error.message?.includes("SERVER_ERROR")) {
        markSyncError(syncObj.identifier);
        showMessage("Error del servidor al sincronizar venta", "error");
      } else if (error.message?.includes("CLIENT_ERROR")) {
        markSyncError(syncObj.identifier);
        showMessage("Error en los datos de la venta", "error");
      } else {
        markSyncError(syncObj.identifier);
        showMessage("Error al sincronizar venta", "error", error);
      }
    } finally {
      setDisableAll(false);
    }
  };

  const handleDeleteProductFromSale = async (product: Sale["productos"][0]) => {
    if (!selectedSale) return;
    await confirmDialog(
      `¿Eliminar "${product.name}" (${product.cantidad} unidad/es) de la venta?`,
      async () => {
        try {
          setDisableAll(true);
          if (
            selectedSale.synced &&
            selectedSale.dbId &&
            product.ventaProductoId
          ) {
            const tiendaId = user.localActual?.id;
            if (!tiendaId) throw new Error("No hay tienda seleccionada");
            await removeProductFromSale(
              tiendaId,
              period.id,
              selectedSale.dbId,
              product.ventaProductoId,
            );
          }
          removeProductFromSaleStore(
            selectedSale.identifier,
            product.productoTiendaId,
            product.productId,
            product.cantidad,
            product.ventaProductoId,
          );
          incrementarCantidades(product.productoTiendaId, product.cantidad);
          const updatedSale = useSalesStore
            .getState()
            .sales.find((s) => s.identifier === selectedSale.identifier);
          if (updatedSale?.productos.length === 0) {
            setShowProducts(false);
            setSelectedSale(undefined);
          } else if (updatedSale) {
            setSelectedSale(updatedSale);
          }
          reloadProdsAndCategories();
          showMessage("Producto eliminado de la venta", "success");
        } catch (error) {
          console.error(error);
          showMessage("No se pudo eliminar el producto", "error", error);
        } finally {
          setDisableAll(false);
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const handleDeleteOne = async (sale: Sale) => {
    await confirmDialog(
      "Está seguro que desea elimnar las venta seleccionada?",
      async () => {
        try {
          setDisableAll(true);
          setDeletingSaleId(sale.identifier);
          if (sale.synced) {
            // eliminar de las ventas en backend
            const tiendaId = user.localActual.id;
            await removeSell(tiendaId, period.id, sale.dbId);
          }

          // eliminar de las ventas y los productos en el storage
          deleteSale(sale.identifier);
          // restaurar las cantidades de los productos
          sale.productos.forEach((p) => {
            incrementarCantidades(p.productoTiendaId, p.cantidad);
          });
          setOffline(false);
          showMessage("La venta fue eliminada satisfactoriamente", "success");
        } catch (error) {
          console.error(error);

          if (error && error.code && error.code === "ERR_NETWORK") {
            setOffline(true);
            showMessage(
              "La venta no puedo ser eliminada por error de conexión",
              "warning",
              error,
            );
          } else {
            showMessage("La venta no puedo ser eliminada", "error", error);
          }
        } finally {
          setDisableAll(false);
          setDeletingSaleId(null);
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const handleDeleteSaleFromDetail = async (sale: Sale) => {
    await handleDeleteOne(sale);
    setShowProducts(false);
    setSelectedSale(undefined);
  };

  const reloadSales = async () => {
    try {
      setDisableAll(true);
      const tiendaId = user.localActual.id;
      const ventasDb = await getSells(tiendaId, period.id);
      const salesSust: Sale[] = ventasDb.map((venta) => {
        const sale: Sale = {
          cierreId: venta.cierrePeriodoId,
          identifier: venta.syncId,
          synced: true,
          syncState: "synced",
          tiendaId: venta.tiendaId,
          total: venta.total,
          totalcash: venta.totalcash,
          totaltransfer: venta.totaltransfer,
          transferDestinationId: venta.transferDestinationId,
          usuarioId: venta.usuarioId,
          dbId: venta.id,
          // 🆕 USAR CAMPOS DE LA BASE DE DATOS
          createdAt: venta.frontendCreatedAt
            ? new Date(venta.frontendCreatedAt).getTime()
            : new Date(venta.createdAt).getTime(),
          wasOffline: venta.wasOffline || false,
          syncAttempts: venta.syncAttempts || 0, // 🆕 Preservar intentos de la base de datos
          // Multimoneda — necesarios para el guard de "eliminar producto individual"
          // (bloqueado cuando la venta tiene más de un pago registrado)
          monedaCobro: venta.monedaCobro,
          pagosDetalle: venta.pagosDetalle,
          vueltoDetalle: venta.vueltoDetalle,
          tasaSnapshot: venta.tasaSnapshot,
          // Propina — sin esto el detalle de una venta recargada del servidor
          // mostraría el vuelto pero no la propina que sí se cobró.
          tipTotal: venta.tipTotal,
          tipDetail: venta.tipDetail,
          productos: venta.productos.map((p) => {
            return {
              name: p.name,
              cantidad: p.cantidad,
              productId: p.id,
              productoTiendaId: p.productoTiendaId,
              price: p.price,
              ventaProductoId: p.ventaProductoId,
            };
          }),
        };
        return sale;
      });
      synchronizeSales(salesSust);
      setOffline(false);
    } catch (error) {
      console.error(error);
      if (error && error.code && error.code === "ERR_NETWORK") {
        setOffline(true);
        showMessage("Ocurrió un error de red al sincronizar", "warning", error);
      } else {
        showMessage(
          "Ocurrió un error al sincrinozar los datos con el servidor",
          "error",
          error,
        );
      }
    } finally {
      setDisableAll(false);
    }
  };

  const handleReprint = async (sale: Sale) => {
    if (!puedeImprimir) return;
    try {
      await reprintSale(sale);
      showMessage("Ticket enviado a impresión", "success");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Error al reimprimir",
        "error",
      );
    }
  };

  const formatSaleInfo = (sale: Sale) => {
    const createdDate = formatDateTime(sale.createdAt);
    // 🆕 Mostrar intentos solo si la venta no está sincronizada o si tiene intentos
    const syncAttemptsText =
      sale.syncAttempts > 0 ? ` (${sale.syncAttempts} intentos)` : "";
    const offlineText = sale.wasOffline
      ? " - Creada offline"
      : " - Creada online";

    return {
      date: createdDate.toLocaleString(),
      status: `${sale.syncState}${syncAttemptsText}${offlineText}`,
      total: `$${sale.total.toFixed(2)}`,
      products: sale.productos.length,
    };
  };

  useEffect(() => {
    (async () => {
      await reloadSales();
    })();
  }, [showSales]);

  return (
    <>
      <Drawer
        anchor="bottom"
        open={showSales}
        onClose={handleClose}
        disableEnforceFocus
        disableAutoFocus
        disableRestoreFocus
        PaperProps={{ sx: { borderRadius: "16px 16px 0 0" } }}
      >
        <Box
          sx={{
            width: "100vw",
            p: 2,
            pt: "calc(8px + env(safe-area-inset-top))",
            pb: "calc(8px + env(safe-area-inset-bottom))",
            display: "flex",
            flexDirection: "column",
            height: "100dvh",
          }}
        >
          {/* Header Fijo */}
          <Box
            display={"flex"}
            flexDirection={"row"}
            justifyContent={"space-between"}
            alignItems={"center"}
            sx={{ mb: 2 }}
          >
            <Box display="flex" alignItems="center" gap={1}>
              <Typography
                sx={{
                  fontSize: "11.5px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "text.primary",
                }}
              >
                Ventas del Turno
              </Typography>
              {sales.length > 0 && (
                <Typography
                  sx={{
                    fontSize: "11.5px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "text.secondary",
                  }}
                >
                  {sales.length} {sales.length === 1 ? "venta" : "ventas"}
                </Typography>
              )}
            </Box>
            {sales.length > 0 && (
              <Chip
                label={offline ? "Desconectado" : "Conectado"}
                deleteIcon={offline ? <WifiOff /> : <Wifi />}
                onDelete={() => {}}
                color={offline ? "warning" : "success"}
                size="small"
                variant={offline ? "filled" : "filled"}
              />
            )}
            <IconButton
              onClick={handleClose}
              color="default"
              sx={{ width: 44, height: 44 }}
            >
              <Close />
            </IconButton>
          </Box>

          {/* Contenido Scrollable */}
          <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
            {sales.filter((s) => !s.synced).length > 0 && (
              <Box
                sx={{ mt: 2, mb: 1 }}
                display={"flex"}
                flexDirection={"row"}
                justifyContent={"space-around"}
                gap={2}
              >
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSyncAll}
                  disabled={disableAll}
                  startIcon={<CloudUpload />}
                >
                  Sincronizar todos
                </Button>
              </Box>
            )}

            {isMobile && (
              <Box
                ref={ventasVirtual.containerRef}
                sx={
                  ventasVirtual.needsVirtualization
                    ? { mt: 1, maxHeight: "60vh", overflowY: "auto" }
                    : { mt: 1 }
                }
              >
                {ventasVirtual.paddingTop > 0 && (
                  <Box sx={{ height: ventasVirtual.paddingTop }} />
                )}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {ventasVirtual.visible.map(({ item: s, virtual }) => {
                    const saleInfo = formatSaleInfo(s);
                    const totalConvertido = s.productos.reduce((sum, p) => {
                      const moneda =
                        p.monedaPrecioCode ??
                        monedaPorProductoTienda.get(p.productoTiendaId) ??
                        monedaBase;
                      return (
                        sum +
                        convertToBase(
                          p.price,
                          moneda,
                          tasasVigentes,
                          monedaBase,
                        ) *
                          p.cantidad
                      );
                    }, 0);
                    return (
                      <Box
                        key={s.identifier}
                        {...(virtual
                          ? {
                              "data-index": virtual.index,
                              ref: ventasVirtual.measureElement,
                            }
                          : {})}
                        sx={{
                          border: 1,
                          borderColor: "divider",
                          borderRadius: 2,
                          p: 1.5,
                          minHeight: 64,
                        }}
                      >
                        <Box
                          display="flex"
                          justifyContent="space-between"
                          alignItems="flex-start"
                          gap={1}
                        >
                          <Box sx={{ minWidth: 0 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                              <Chip
                                size="small"
                                label={s.synced ? "Subida" : "Pendiente"}
                                color={s.synced ? "success" : "warning"}
                                variant="filled"
                              />
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {saleInfo.date}
                              </Typography>
                            </Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ mt: 0.5, display: "block" }}
                            >
                              Efectivo{" "}
                              {formatMontoEnMoneda(s.totalcash, monedaBase)} ·
                              Transf{" "}
                              {formatMontoEnMoneda(s.totaltransfer, monedaBase)}
                            </Typography>
                          </Box>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ flexShrink: 0 }}
                          >
                            {formatMontoEnMoneda(totalConvertido, monedaBase)}
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 0.5,
                            mt: 1,
                            pt: 1,
                            borderTop: 1,
                            borderColor: "divider",
                          }}
                        >
                          <IconButton
                            aria-label="view"
                            color="default"
                            onClick={() => handleSelectViewSale(s)}
                            disabled={disableAll}
                            sx={{ width: 44, height: 44 }}
                          >
                            <VisibilityIcon />
                          </IconButton>

                          {puedeImprimir && (
                            <IconButton
                              aria-label="reprint"
                              color="default"
                              onClick={() => handleReprint(s)}
                              disabled={disableAll}
                              sx={{ width: 44, height: 44 }}
                            >
                              <Print />
                            </IconButton>
                          )}

                          {s.syncState === "syncing" ? (
                            <Box
                              sx={{
                                width: 44,
                                height: 44,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <CircularProgress size={24} />
                            </Box>
                          ) : (
                            <IconButton
                              aria-label="sync"
                              color="primary"
                              onClick={() => handleSyncOne(s)}
                              disabled={disableAll || s.synced}
                              sx={{ width: 44, height: 44 }}
                            >
                              {s.synced ? <Done /> : <Sync />}
                            </IconButton>
                          )}

                          {verificarPermiso(
                            "operaciones.pos-venta.cancelarventa",
                          ) && (
                            <IconButton
                              aria-label="delete"
                              color="error"
                              onClick={() => handleDeleteOne(s)}
                              disabled={disableAll || (offline && s.synced)}
                              sx={{ width: 44, height: 44 }}
                            >
                              {deletingSaleId === s.identifier ? (
                                <CircularProgress size={24} />
                              ) : (
                                <DeleteIcon />
                              )}
                            </IconButton>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
                {ventasVirtual.paddingBottom > 0 && (
                  <Box sx={{ height: ventasVirtual.paddingBottom }} />
                )}
              </Box>
            )}

            {!isMobile && (
              <TableContainer
                component={Paper}
                ref={ventasVirtual.containerRef}
                sx={
                  ventasVirtual.needsVirtualization
                    ? { mt: 1, maxHeight: "60vh", overflowY: "auto" }
                    : { mt: 1 }
                }
              >
                <Table
                  size="small"
                  stickyHeader={ventasVirtual.needsVirtualization}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <b>Estado</b>
                      </TableCell>
                      <TableCell>
                        <b>Fecha</b>
                      </TableCell>
                      <TableCell align="right">
                        <b>Efectivo</b>
                      </TableCell>
                      <TableCell align="right">
                        <b>Transf</b>
                      </TableCell>
                      <TableCell align="right">
                        <b>Total</b>
                      </TableCell>
                      <TableCell>
                        <b>Acciones</b>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ventasVirtual.paddingTop > 0 && (
                      <TableRow style={{ height: ventasVirtual.paddingTop }}>
                        <TableCell colSpan={6} sx={{ p: 0, border: 0 }} />
                      </TableRow>
                    )}
                    {ventasVirtual.visible.map(({ item: s, virtual }) => {
                      const saleInfo = formatSaleInfo(s);
                      const totalConvertido = s.productos.reduce((sum, p) => {
                        const moneda =
                          p.monedaPrecioCode ??
                          monedaPorProductoTienda.get(p.productoTiendaId) ??
                          monedaBase;
                        return (
                          sum +
                          convertToBase(
                            p.price,
                            moneda,
                            tasasVigentes,
                            monedaBase,
                          ) *
                            p.cantidad
                        );
                      }, 0);
                      return (
                        <Fragment key={s.identifier}>
                          <TableRow
                            sx={{ borderColor: "Highlight" }}
                            {...(virtual
                              ? {
                                  "data-index": virtual.index,
                                  ref: ventasVirtual.measureElement,
                                }
                              : {})}
                          >
                            <TableCell>
                              <Box
                                display={"flex"}
                                flexDirection={"column"}
                                gap={0.5}
                              >
                                <Chip
                                  size="small"
                                  label={s.synced ? "Subida" : "Pendiente"}
                                  color={s.synced ? "success" : "warning"}
                                  variant="filled"
                                />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {saleInfo.products} productos
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {saleInfo.date}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              {formatMontoEnMoneda(s.totalcash, monedaBase)}
                            </TableCell>
                            <TableCell align="right">
                              {formatMontoEnMoneda(s.totaltransfer, monedaBase)}
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="h6">
                                {formatMontoEnMoneda(
                                  totalConvertido,
                                  monedaBase,
                                )}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Box
                                width={"100%"}
                                display={"flex"}
                                flexDirection={"row"}
                                justifyContent={"space-around"}
                                alignItems={"center"}
                              >
                                <IconButton
                                  aria-label="view"
                                  color="default"
                                  onClick={() => handleSelectViewSale(s)}
                                  disabled={disableAll}
                                  sx={{ width: 44, height: 44 }}
                                >
                                  <VisibilityIcon />
                                </IconButton>

                                {puedeImprimir && (
                                  <IconButton
                                    aria-label="reprint"
                                    color="default"
                                    onClick={() => handleReprint(s)}
                                    disabled={disableAll}
                                    sx={{ width: 44, height: 44 }}
                                  >
                                    <Print />
                                  </IconButton>
                                )}

                                {s.syncState === "syncing" ? (
                                  <Box
                                    sx={{
                                      width: 44,
                                      height: 44,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                    }}
                                  >
                                    <CircularProgress size={24} />
                                  </Box>
                                ) : (
                                  <IconButton
                                    aria-label="sync"
                                    color="primary"
                                    onClick={() => handleSyncOne(s)}
                                    disabled={disableAll || s.synced}
                                    sx={{ width: 44, height: 44 }}
                                  >
                                    {s.synced ? <Done /> : <Sync />}
                                  </IconButton>
                                )}

                                {verificarPermiso(
                                  "operaciones.pos-venta.cancelarventa",
                                ) && (
                                  <IconButton
                                    aria-label="delete"
                                    color="error"
                                    onClick={() => handleDeleteOne(s)}
                                    disabled={
                                      disableAll || (offline && s.synced)
                                    }
                                    sx={{ width: 44, height: 44 }}
                                  >
                                    {deletingSaleId === s.identifier ? (
                                      <CircularProgress size={24} />
                                    ) : (
                                      <DeleteIcon />
                                    )}
                                  </IconButton>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        </Fragment>
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
          </Box>
        </Box>
      </Drawer>

      {selectedSale && (
        <SaleProductsDetailDrawer
          open={showProducts}
          onClose={() => {
            setShowProducts(false);
            setSelectedSale(undefined);
          }}
          sale={selectedSale}
          allowDelete={verificarPermiso("operaciones.pos-venta.cancelarventa")}
          onDeleteProduct={handleDeleteProductFromSale}
          onDeleteSale={handleDeleteSaleFromDetail}
          disableAll={disableAll}
          productosTienda={productosTienda}
        />
      )}

      {ConfirmDialogComponent}
    </>
  );
};
