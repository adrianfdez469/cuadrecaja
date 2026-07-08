import React from "react";
import { Sale } from "@/store/salesStore";
import { useAppContext } from "@/context/AppContext";
import { convertToBase, pagadaConUnSoloPago } from "@/lib/currency";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { Close, Delete } from "@mui/icons-material";
import {
  Box,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  CircularProgress,
  Tooltip,
} from "@mui/material";

const TOOLTIP_MULTIPLES_PAGOS =
  "No se puede eliminar un producto de una venta con más de un pago registrado (varias monedas, o efectivo y transferencia combinados)";

interface SaleProductsDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  sale: Sale;
  allowDelete: boolean;
  onDeleteProduct: (product: Sale["productos"][0]) => Promise<void>;
  onDeleteSale: (sale: Sale) => Promise<void>;
  disableAll?: boolean;
  productosTienda?: IProductoTiendaV2[];
}

export const SaleProductsDetailDrawer: React.FC<
  SaleProductsDetailDrawerProps
> = ({
  open,
  onClose,
  sale,
  allowDelete,
  onDeleteProduct,
  onDeleteSale,
  disableAll = false,
  productosTienda,
}) => {
  const { tasasVigentes, monedaBase } = useAppContext();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [deletingSale, setDeletingSale] = React.useState(false);

  const isLastProduct = sale.productos.length <= 1;
  const blockedByMultiplesPagos =
    !isLastProduct && !pagadaConUnSoloPago(sale.pagosDetalle);

  const totalConvertido = sale.productos.reduce((sum, product) => {
    const moneda =
      product.monedaPrecioCode ??
      productosTienda?.find((p) => p.id === product.productoTiendaId)
        ?.monedaPrecioCode ??
      monedaBase;
    return (
      sum +
      convertToBase(product.price, moneda, tasasVigentes, monedaBase) *
        product.cantidad
    );
  }, 0);

  const handleDelete = async (product: Sale["productos"][0]) => {
    if (isLastProduct) {
      setDeletingSale(true);
      try {
        await onDeleteSale(sale);
      } finally {
        setDeletingSale(false);
      }
      return;
    }
    const key = product.ventaProductoId ?? product.productoTiendaId;
    setDeletingId(key);
    try {
      await onDeleteProduct(product);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Drawer anchor="bottom" open={open} onClose={onClose}>
      <Box
        sx={{
          width: "100vw",
          p: 2,
          display: "flex",
          flexDirection: "column",
          minHeight: "50vh",
          maxHeight: "80vh",
        }}
      >
        <Box
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">Detalle de venta</Typography>
          <IconButton onClick={onClose} color="default">
            <Close />
          </IconButton>
        </Box>

        <TableContainer component={Paper} sx={{ flex: 1, overflow: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>
                  <strong>Producto</strong>
                </TableCell>
                <TableCell align="center">
                  <strong>Cantidad</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Precio</strong>
                </TableCell>
                <TableCell align="right">
                  <strong>Total</strong>
                </TableCell>
                {allowDelete && (
                  <TableCell align="center">
                    <strong>Acciones</strong>
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {sale.productos.map((product, index) => {
                const moneda =
                  product.monedaPrecioCode ??
                  productosTienda?.find(
                    (p) => p.id === product.productoTiendaId,
                  )?.monedaPrecioCode ??
                  monedaBase;
                const precioBase = convertToBase(
                  product.price,
                  moneda,
                  tasasVigentes,
                  monedaBase,
                );
                const totalLinea = precioBase * product.cantidad;
                const key =
                  product.ventaProductoId ??
                  `${product.productoTiendaId}-${index}`;
                const isDeleting = deletingId === key;
                return (
                  <TableRow key={key} hover>
                    <TableCell>{product.name}</TableCell>
                    <TableCell align="center">{product.cantidad}</TableCell>
                    <TableCell align="right">
                      ${precioBase?.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      ${totalLinea.toFixed(2)}
                    </TableCell>
                    {allowDelete && (
                      <TableCell align="center">
                        <Tooltip
                          title={
                            blockedByMultiplesPagos
                              ? TOOLTIP_MULTIPLES_PAGOS
                              : ""
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={
                                disableAll ||
                                isDeleting ||
                                deletingSale ||
                                blockedByMultiplesPagos
                              }
                              onClick={() => handleDelete(product)}
                              aria-label="Eliminar producto"
                            >
                              {isDeleting || (isLastProduct && deletingSale) ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Delete fontSize="small" />
                              )}
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
              <TableRow sx={{ bgcolor: "action.hover" }}>
                <TableCell colSpan={allowDelete ? 3 : 3}>
                  <Typography fontWeight="bold">Total</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight="bold">
                    ${totalConvertido.toFixed(2)}
                  </Typography>
                </TableCell>
                {allowDelete && <TableCell />}
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Drawer>
  );
};
