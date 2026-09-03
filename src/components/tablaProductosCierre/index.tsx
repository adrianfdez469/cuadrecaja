import React, { FC, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Button,
  Chip,
  Card,
  CardContent,
  Grid,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  useMediaQuery,
} from "@mui/material";
import StoreIcon from "@mui/icons-material/Store";
import HandshakeIcon from "@mui/icons-material/Handshake";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import { ICierreData } from "@/schemas/cierre";
import { formatCurrency, formatQuantity } from "@/utils/formatters";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import theme from "@/theme";

// Tipos específicos para los productos
interface ProductoVendido {
  id: string;
  nombre: string;
  costo: number;
  precio: number;
  cantidad: number;
  total: number;
  ganancia: number;
  // Descuento aplicado específicamente a este producto en el período
  descuento?: number;
  productoId: string;
  proveedor?: {
    id: string;
    nombre: string;
  };
}

interface ProductoAgrupado {
  productoId: string;
  items: ProductoVendido[];
  nombre: string;
}

export interface ITotales {
  totalCantidad: number;
  totalMonto: number;
  totalGanancia: number;
  // totalTransferencia: number;
}

interface IProps {
  cierreData: ICierreData;
  totales: ITotales;
  handleCerrarCaja?: () => Promise<void>;
  hideTotales?: boolean;
  // La banda de totales y los dos "Resumen de Ventas por..." de acá abajo
  // quedaron duplicados en /cierre una vez que CierreTotalsCard y
  // VentasSummaryCard empezaron a mostrar lo mismo más arriba en la página.
  // No se reutiliza `hideTotales` para esto: resumen_cierre y el drawer de
  // ventas del POS ya dependen de su comportamiento actual.
  hideResumenes?: boolean;
  showOnlyCants?: boolean;
  isProcessing?: boolean;
  formatAmount?: (n: number) => string;
}

export const TablaProductosCierre: FC<IProps> = ({
  cierreData,
  totales,
  handleCerrarCaja,
  hideTotales,
  hideResumenes,
  showOnlyCants,
  isProcessing = false,
  formatAmount = formatCurrency,
}) => {
  const { user } = useAppContext();
  const { showMessage } = useMessageContext();
  const [disableCierreBtn, setDisableCierreBtn] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const handleCierre = async () => {
    if (handleCerrarCaja) {
      setDisableCierreBtn(true);
      await handleCerrarCaja();
      setDisableCierreBtn(false);
    }
  };

  // Funciones de exportación
  const handleExportAll = async () => {
    try {
      setExporting(true);
      // Importado bajo demanda: `xlsx` solo hace falta al exportar, y
      // estáticamente entraba en el bundle inicial del cierre.
      const { exportProductosVendidosToExcel } =
        await import("@/utils/excelExport");
      await exportProductosVendidosToExcel({
        cierreData,
        tiendaNombre: user.localActual.nombre,
        fechaInicio: new Date(), // Esto debería venir del cierre
        fechaFin: new Date(),
      });
      showMessage("Archivo Excel exportado exitosamente", "success");
    } catch (error) {
      console.error("Error al exportar:", error);
      showMessage("Error al exportar el archivo Excel", "error");
    } finally {
      setExporting(false);
    }
  };

  const handleExportProveedor = async (proveedorId: string) => {
    try {
      setExporting(true);
      const { exportProductosProveedorToExcel } =
        await import("@/utils/excelExport");
      await exportProductosProveedorToExcel({
        cierreData,
        tiendaNombre: user.localActual.nombre,
        fechaInicio: new Date(),
        fechaFin: new Date(),
        proveedorId,
      });
      showMessage("Productos del proveedor exportados exitosamente", "success");
    } catch (error) {
      console.error("Error al exportar productos del proveedor:", error);
      showMessage("Error al exportar productos del proveedor", "error");
    } finally {
      setExporting(false);
    }
  };

  // Funciones para manejar menús
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const {
    totalVentas,
    totalGanancia,
    totalGananciaFinal,
    totalTransferencia,
    // Totales ampliados desde el backend
    totalDescuentos,
    totalVentasPropias,
    totalVentasConsignacion,
    totalVentasPropiasNeto,
    totalVentasConsignacionNeto,
    totalGananciasPropias,
    totalGananciasConsignacion,
    productosVendidos,
    totalTransferenciasByDestination,
    totalVentasPorUsuario,
  } = cierreData;

  // Suma de la ganancia tal como se muestra fila por fila en la tabla (bruta,
  // neta solo del descuento de cada producto) — el "Total" al pie de la
  // tabla debe sumar exactamente lo que el usuario ve arriba, sin restar
  // gastos/merma/devoluciones (eso vive aparte en la card de Ganancia).
  const totalGananciaFilas = productosVendidos.reduce(
    (acc, p) => acc + (p.ganancia || 0) - (p.descuento || 0),
    0,
  );

  // Obtener proveedores únicos para el menú de consignación
  const proveedoresUnicos = Array.from(
    new Map(
      productosVendidos
        .filter((p) => p.proveedor)
        .map((p) => [
          p.proveedor!.id,
          { id: p.proveedor!.id, nombre: p.proveedor!.nombre },
        ]),
    ).values(),
  ).sort((a, b) => a.nombre.localeCompare(b.nombre));

  const totalVentasPorProveedor = Object.values(
    productosVendidos.reduce((acc, prod) => {
      if (prod.proveedor) {
        if (acc[prod.proveedor.id]) {
          acc[prod.proveedor.id] = {
            ...acc[prod.proveedor.id],
            total: acc[prod.proveedor.id].total + prod.total,
            ganancia: acc[prod.proveedor.id].ganancia + prod.ganancia,
          };
        } else {
          acc[prod.proveedor.id] = {
            id: prod.proveedor.id,
            nombre: prod.proveedor.nombre,
            total: prod.total,
            ganancia: prod.ganancia,
          };
        }
      }
      return acc;
    }, {}),
  );

  // Muestra "Ventas: $bruto $neto" — si hay descuento, el bruto va tachado y el
  // neto en negrita para resaltar el valor real (mismo patrón que la card de Ganancia)
  const VentaConDescuento = ({
    bruto,
    neto,
  }: {
    bruto: number;
    neto?: number;
  }) => {
    const valorNeto = typeof neto === "number" ? neto : bruto;
    const hayDescuento = valorNeto !== bruto;
    return (
      <Box
        display="flex"
        gap={0.75}
        alignItems="baseline"
        flexWrap="wrap"
        component="span"
      >
        <Typography variant="body2" color="text.secondary" component="span">
          Ventas:
        </Typography>
        {hayDescuento && (
          <Typography
            variant="body2"
            component="span"
            sx={{ textDecoration: "line-through", color: "text.disabled" }}
          >
            {formatAmount(bruto)}
          </Typography>
        )}
        <Typography
          variant="body2"
          component="span"
          fontWeight={hayDescuento ? "bold" : "normal"}
          color={hayDescuento ? "text.primary" : "text.secondary"}
        >
          {formatAmount(valorNeto)}
        </Typography>
      </Box>
    );
  };

  // Agrupar todos los productos (propios y consignación) por productoId —
  // una sola lista en vez de dos tablas separadas.
  const productosAgrupados = productosVendidos.reduce(
    (acc, producto) => {
      const key = producto.productoId || producto.id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(producto);
      return acc;
    },
    {} as Record<string, ProductoVendido[]>,
  );

  const gruposOrdenados: ProductoAgrupado[] = Object.entries(productosAgrupados)
    .map(([productoId, items]) => ({
      productoId,
      items: items.sort((a, b) => (a.costo || 0) - (b.costo || 0)),
      nombre: items[0]?.nombre || "Producto sin nombre",
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Una fila por variante: cantidad/venta con peso, ganancia en verde,
  // descuento/costo/precio en gris de apoyo (rojo el descuento si aplica).
  const renderVariantLine = (item: ProductoVendido) => (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Cant. {formatQuantity(item.cantidad || 0)}
        </Typography>
        {!showOnlyCants && (
          <Typography
            sx={{
              fontSize: "0.9375rem",
              fontWeight: 700,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {formatAmount(item.total || 0)}
          </Typography>
        )}
      </Box>
      {!showOnlyCants && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            gap: 1,
            mt: 0.25,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Costo {formatAmount(item.costo || 0)} · Precio{" "}
            {formatAmount(item.precio || 0)}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontWeight: 600, color: "semantic.hue.positive.main" }}
          >
            Ganancia{" "}
            {formatAmount((item.ganancia || 0) - (item.descuento || 0))}
          </Typography>
        </Box>
      )}
      {!showOnlyCants && (item.descuento || 0) > 0 && (
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.25,
            color: "semantic.hue.negative.main",
          }}
        >
          Descuento -{formatAmount(item.descuento || 0)}
        </Typography>
      )}
    </>
  );

  return (
    <>
      {!hideTotales && !hideResumenes && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "stretch", sm: "center" },
            gap: 2,
          }}
        >
          <Grid container spacing={2} sx={{ flex: 1 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Venta
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="primary.main">
                  {formatAmount(totalVentas)}
                </Typography>
              </Box>
            </Grid>

            {!showOnlyCants &&
              (() => {
                // Ganancia FINAL (neta de gastos operativos, merma y
                // devoluciones) — mismo dato que muestra la card de
                // Ganancia, para no mostrar dos cifras distintas del mismo
                // período. totalGanancia (bruta) se muestra tachada arriba
                // solo cuando difiere, igual que el patrón de descuentos.
                const gananciaFinal =
                  typeof totalGananciaFinal === "number"
                    ? totalGananciaFinal
                    : totalGanancia;
                const hayDeducciones = gananciaFinal !== totalGanancia;
                return (
                  <Grid item xs={12} sm={6} md={3}>
                    <Box textAlign="center">
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                      >
                        Total Ganancia
                      </Typography>
                      {hayDeducciones && (
                        <Typography
                          variant="body2"
                          sx={{
                            textDecoration: "line-through",
                            color: "text.disabled",
                          }}
                        >
                          {formatAmount(totalGanancia)}
                        </Typography>
                      )}
                      <Typography
                        variant="h6"
                        fontWeight="bold"
                        color={
                          gananciaFinal < 0 ? "error.main" : "success.main"
                        }
                      >
                        {formatAmount(gananciaFinal)}
                      </Typography>
                    </Box>
                  </Grid>
                );
              })()}

            <Grid item xs={12} sm={6} md={3}>
              <Box textAlign="center">
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Transferencia
                </Typography>
                <Typography variant="h6" fontWeight="bold" color="info.main">
                  {formatAmount(totalTransferencia)}
                </Typography>
              </Box>
            </Grid>

            {totalTransferenciasByDestination.length > 0 && (
              <Grid item xs={12} sm={6} md={3}>
                <Box>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                    textAlign="center"
                  >
                    Transferencias por Destino
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}
                  >
                    {totalTransferenciasByDestination.map((transfer) => (
                      <Box
                        key={transfer.id}
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ flexShrink: 0 }}
                        >
                          {transfer.nombre}:
                        </Typography>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          color="warning.main"
                          sx={{ ml: 1 }}
                        >
                          {formatAmount(transfer.total)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>

          {handleCerrarCaja && (
            <Box
              sx={{
                display: "flex",
                justifyContent: { xs: "center", sm: "flex-end" },
                minWidth: { sm: "auto", md: "200px" },
                gap: 1,
              }}
            >
              <Button
                variant="contained"
                onClick={handleCierre}
                disabled={disableCierreBtn || isProcessing}
                size="large"
                sx={{
                  minWidth: "140px",
                  height: "48px",
                }}
              >
                {isProcessing ? "Procesando..." : "Cerrar caja"}
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {/* Menú de exportación — vive fuera de la sección de productos: el
          botón que lo abre se renderiza siempre, con o sin
          `hideTotales`/`hideResumenes`. Junta lo que antes eran dos menús
          (general + por proveedor) ahora que el acordeón de consignación
          desapareció y no queda un botón propio para el segundo. */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right",
        }}
      >
        <MenuItem onClick={handleExportAll} disabled={exporting}>
          <ListItemIcon>
            <FileDownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Exportar todos los productos</ListItemText>
        </MenuItem>
        {proveedoresUnicos.map((proveedor) => (
          <MenuItem
            key={proveedor.id}
            onClick={() => {
              handleExportProveedor(proveedor.id);
              handleMenuClose();
            }}
            disabled={exporting}
          >
            <ListItemIcon>
              <FileDownloadIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Exportar productos de {proveedor.nombre}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {!hideResumenes && (
        <>
          {/* Resumen de Ventas por Usuario */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Resumen de Ventas por Usuario
            </Typography>
            <Grid container spacing={2}>
              {totalVentasPorUsuario.map((usuario) => (
                <Grid item xs={12} md={6} key={usuario.id}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <StoreIcon color="primary" />
                        <Typography variant="subtitle1" fontWeight="bold">
                          {usuario.nombre}
                        </Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Ventas: {formatAmount(usuario.total)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Resumen de Consignación con datos reales */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
              Resumen de Ventas por Tipo
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <StoreIcon color="primary" />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Productos Propios
                      </Typography>
                    </Box>
                    <VentaConDescuento
                      bruto={totalVentasPropias}
                      neto={totalVentasPropiasNeto}
                    />
                    {!showOnlyCants && (
                      <Typography variant="body2" color="text.secondary">
                        Ganancia: {formatAmount(totalGananciasPropias)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card variant="outlined">
                  <CardContent>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <HandshakeIcon color="secondary" />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Productos Consignación
                      </Typography>
                    </Box>
                    <VentaConDescuento
                      bruto={totalVentasConsignacion}
                      neto={totalVentasConsignacionNeto}
                    />
                    {!showOnlyCants && (
                      <Typography variant="body2" color="text.secondary">
                        Ganancia: {formatAmount(totalGananciasConsignacion)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {totalVentasPorProveedor.map(
                (item: {
                  id: string;
                  nombre: string;
                  total: number;
                  ganancia: number;
                }) => {
                  return (
                    <Grid item xs={6} md={3} key={item.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            mb={1}
                          >
                            <HandshakeIcon color="secondary" />
                            <Typography variant="subtitle1" fontWeight="bold">
                              {item.nombre}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            Ventas: {formatAmount(item.total)}
                          </Typography>
                          {!showOnlyCants && (
                            <Typography variant="body2" color="text.secondary">
                              Ganancia: {formatAmount(item.ganancia)}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                },
              )}
            </Grid>
          </Paper>
        </>
      )}

      {/* Productos vendidos y consignación — una sola lista en vez de un
          acordeón de consignación aparte más "Todos los Productos": el
          proveedor va como chip junto al nombre, y el neto tras descuento
          se lee en la propia fila de Total en vez de en una tercera card. */}
      <Box
        sx={{
          bgcolor: "background.paper",
          border: 1,
          borderColor: "divider",
          borderRadius: "12px",
          overflow: "hidden",
          mb: 2,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            px: isMobile ? 2 : 2.5,
            py: isMobile ? 1.75 : 2.25,
          }}
        >
          <Typography sx={{ fontSize: "1.0625rem", fontWeight: 700, flex: 1 }}>
            Productos vendidos y consignación
          </Typography>
          <Tooltip title="Exportar">
            <IconButton
              onClick={handleMenuOpen}
              disabled={exporting}
              size="small"
            >
              {exporting ? (
                <CircularProgress size={18} />
              ) : (
                <FileDownloadIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        {gruposOrdenados.length === 0 ? (
          <Box sx={{ px: 2.5, py: 3, borderTop: 1, borderColor: "divider" }}>
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              No hay productos vendidos en este período
            </Typography>
          </Box>
        ) : isMobile ? (
          <>
            {gruposOrdenados.map((grupo) => {
              const proveedorItem = grupo.items.find((i) => i.proveedor);
              const consignacionLabel = proveedorItem
                ? `Consignación · ${proveedorItem.proveedor!.nombre}`
                : undefined;
              return (
                <Box key={grupo.productoId}>
                  <Box
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderTop: 1,
                      borderColor: "divider",
                    }}
                  >
                    <Typography sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>
                      {grupo.nombre}
                    </Typography>
                    {(consignacionLabel || grupo.items.length > 1) && (
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.75,
                          flexWrap: "wrap",
                          mt: 0.75,
                          mb: 0.75,
                        }}
                      >
                        {consignacionLabel && (
                          <Chip
                            label={consignacionLabel}
                            size="small"
                            variant="outlined"
                          />
                        )}
                        {grupo.items.length > 1 && (
                          <Chip
                            label={`${grupo.items.length} variantes`}
                            size="small"
                            color="info"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    )}
                    {showOnlyCants ? (
                      <Typography variant="caption" color="text.secondary">
                        Cantidad: {formatQuantity(grupo.items[0].cantidad || 0)}
                      </Typography>
                    ) : (
                      renderVariantLine(grupo.items[0])
                    )}
                  </Box>
                  {grupo.items.slice(1).map((item, i) => (
                    <Box
                      key={i}
                      sx={{
                        px: 2,
                        py: 1.5,
                        borderTop: 1,
                        borderColor: "divider",
                      }}
                    >
                      {showOnlyCants ? (
                        <Typography variant="caption" color="text.secondary">
                          Cantidad: {formatQuantity(item.cantidad || 0)}
                        </Typography>
                      ) : (
                        renderVariantLine(item)
                      )}
                    </Box>
                  ))}
                </Box>
              );
            })}

            {!hideTotales && (
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  borderTop: 1,
                  borderColor: "divider",
                  bgcolor: "semantic.surface.sunken",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 1,
                  }}
                >
                  <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700 }}>
                    Total · {formatQuantity(totales?.totalCantidad || 0)} uds.
                  </Typography>
                  {!showOnlyCants && (
                    <Typography
                      sx={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {formatAmount(totales?.totalMonto || 0)}
                    </Typography>
                  )}
                </Box>
                {!showOnlyCants && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 1,
                      mt: 0.25,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color:
                          (totalDescuentos || 0) > 0
                            ? "semantic.hue.negative.main"
                            : "text.secondary",
                      }}
                    >
                      {(totalDescuentos || 0) > 0
                        ? `Descuento -${formatAmount(totalDescuentos || 0)} · neto ${formatAmount(totalVentas)}`
                        : ""}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        color: "semantic.hue.positive.main",
                      }}
                    >
                      Ganancia {formatAmount(totalGananciaFilas)}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                  {!showOnlyCants && (
                    <>
                      <TableCell align="right">Venta</TableCell>
                      <TableCell align="right">Ganancia</TableCell>
                      <TableCell align="right" sx={{ color: "text.secondary" }}>
                        Descuento
                      </TableCell>
                      <TableCell align="right" sx={{ color: "text.secondary" }}>
                        Costo
                      </TableCell>
                      <TableCell align="right" sx={{ color: "text.secondary" }}>
                        Precio
                      </TableCell>
                    </>
                  )}
                </TableRow>
              </TableHead>
              <TableBody>
                {gruposOrdenados.map((grupo) => {
                  const proveedorItem = grupo.items.find((i) => i.proveedor);
                  const consignacionLabel = proveedorItem
                    ? `Consignación · ${proveedorItem.proveedor!.nombre}`
                    : undefined;
                  return grupo.items.map((item, index) => (
                    <TableRow key={`${grupo.productoId}-${index}`}>
                      {index === 0 && (
                        <TableCell
                          rowSpan={grupo.items.length}
                          sx={{
                            verticalAlign: "top",
                            borderRight: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 0.75,
                            }}
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {grupo.nombre}
                            </Typography>
                            {(consignacionLabel || grupo.items.length > 1) && (
                              <Box
                                sx={{
                                  display: "flex",
                                  gap: 0.5,
                                  flexWrap: "wrap",
                                }}
                              >
                                {consignacionLabel && (
                                  <Chip
                                    label={consignacionLabel}
                                    size="small"
                                    variant="outlined"
                                  />
                                )}
                                {grupo.items.length > 1 && (
                                  <Chip
                                    label={`${grupo.items.length} variantes`}
                                    size="small"
                                    color="info"
                                    variant="outlined"
                                  />
                                )}
                              </Box>
                            )}
                          </Box>
                        </TableCell>
                      )}
                      <TableCell align="right">
                        {formatQuantity(item.cantidad || 0)}
                      </TableCell>
                      {!showOnlyCants && (
                        <>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatAmount(item.total || 0)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              fontWeight: 600,
                              color: "semantic.hue.positive.main",
                            }}
                          >
                            {formatAmount(
                              (item.ganancia || 0) - (item.descuento || 0),
                            )}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{
                              color:
                                (item.descuento || 0) > 0
                                  ? "semantic.hue.negative.main"
                                  : "text.secondary",
                            }}
                          >
                            -{formatAmount(item.descuento || 0)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "text.secondary" }}
                          >
                            {formatAmount(item.costo || 0)}
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "text.secondary" }}
                          >
                            {formatAmount(item.precio || 0)}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ));
                })}
                {!hideTotales && (
                  <TableRow sx={{ bgcolor: "semantic.surface.sunken" }}>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Total
                      {!showOnlyCants && (totalDescuentos || 0) > 0 && (
                        <Typography
                          component="span"
                          variant="body2"
                          sx={{ fontWeight: 400, color: "text.secondary" }}
                        >
                          {" "}
                          · neto {formatAmount(totalVentas)} tras -
                          {formatAmount(totalDescuentos)} de descuento
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatQuantity(totales?.totalCantidad || 0)}
                    </TableCell>
                    {!showOnlyCants && (
                      <>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>
                          {formatAmount(totales?.totalMonto || 0)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color: "semantic.hue.positive.main",
                          }}
                        >
                          {formatAmount(totalGananciaFilas)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 700,
                            color:
                              (totalDescuentos || 0) > 0
                                ? "semantic.hue.negative.main"
                                : "text.secondary",
                          }}
                        >
                          -{formatAmount(totalDescuentos || 0)}
                        </TableCell>
                        <TableCell />
                        <TableCell />
                      </>
                    )}
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </>
  );
};
