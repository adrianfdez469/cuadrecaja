import React from "react";
import { Sale } from "@/store/salesStore";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
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
} from "@mui/material";

interface SaleProductsDetailDrawerProps {
  open: boolean;
  onClose: () => void;
  sale: Sale;
  allowDelete: boolean;
  onDeleteProduct: (product: Sale["productos"][0]) => Promise<void>;
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
  disableAll = false,
  productosTienda,
}) => {
  const { tasasVigentes, monedaBase } = useAppContext();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

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
                        <IconButton
                          size="small"
                          color="error"
                          disabled={
                            disableAll ||
                            isDeleting ||
                            sale.productos.length <= 1
                          }
                          onClick={() => handleDelete(product)}
                          aria-label="Eliminar producto"
                        >
                          {isDeleting ? (
                            <CircularProgress size={20} />
                          ) : (
                            <Delete fontSize="small" />
                          )}
                        </IconButton>
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
