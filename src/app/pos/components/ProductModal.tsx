"use client";

import { useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Modal,
  Fab,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { IProductoTiendaV2 } from "@/types/IProducto";
import { QuantityDialog } from "./QuantityDialog";
import { useCartStore } from "@/store/cartStore";

interface ProductModalProps {
  open: boolean;
  closeModal: () => void;
  productosTienda: IProductoTiendaV2[];
  allProductosTienda?: IProductoTiendaV2[]; // Lista completa para calcular disponibilidad de fracciones
  category: { id: string; nombre: string; color: string } | null;
  openCart: () => void;
}

/**
 * Calcula la disponibilidad real de un producto, considerando desagregación para productos fracción.
 */
function calcularDisponibilidadReal(
  producto: IProductoTiendaV2 | null | undefined,
  allProductos: IProductoTiendaV2[]
): { disponibilidadReal: number; maxPorTransaccion: number; esFraccion: boolean } {
  if (!producto) {
    return { disponibilidadReal: 0, maxPorTransaccion: 0, esFraccion: false };
  }

  if (!producto.producto) {
    return { disponibilidadReal: Math.max(0, producto.existencia || 0), maxPorTransaccion: Math.max(0, producto.existencia || 0), esFraccion: false };
  }

  const existenciaProducto = Math.max(0, producto.existencia || 0);
  const fraccionDeId = producto.producto.fraccionDeId;
  const unidadesPorFraccion = producto.producto.unidadesPorFraccion;

  if (!fraccionDeId || !unidadesPorFraccion || unidadesPorFraccion <= 0) {
    return { disponibilidadReal: existenciaProducto, maxPorTransaccion: existenciaProducto, esFraccion: false };
  }

  if (!Array.isArray(allProductos) || allProductos.length === 0) {
    const maxFraccion = Math.max(0, unidadesPorFraccion - 1);
    return { disponibilidadReal: Math.min(existenciaProducto, maxFraccion), maxPorTransaccion: Math.min(existenciaProducto, maxFraccion), esFraccion: true };
  }

  const productoPadre = allProductos.find(p => p && p.productoId === fraccionDeId);
  const existenciaPadre = productoPadre ? Math.max(0, productoPadre.existencia || 0) : 0;
  const disponibilidadTotal = existenciaProducto + (existenciaPadre * unidadesPorFraccion);
  const maxFraccion = Math.max(0, unidadesPorFraccion - 1);
  const maxPorTransaccion = Math.min(disponibilidadTotal, maxFraccion);

  return { disponibilidadReal: disponibilidadTotal, maxPorTransaccion: Math.max(0, maxPorTransaccion), esFraccion: true };
}

export function ProductModal({
  open,
  closeModal,
  productosTienda,
  allProductosTienda,
  category,
  openCart,
}: ProductModalProps) {
  const [selectedProduct, setSelectedProduct] = useState<IProductoTiendaV2 | null>(null);
  const { items } = useCartStore();

  // Usar allProductosTienda si está disponible, sino usar productosTienda
  const allProducts = allProductosTienda || productosTienda;

  const handleProductClick = (product: IProductoTiendaV2) => {
    setSelectedProduct(product);
  };

  const handleResetProductQuantity = () => {
    setSelectedProduct(null);
  };

  const handleConfirmQuantity = () => {
    handleResetProductQuantity();
    openCart();
    closeModal();
  };

  const getCartQuantity = (productoTiendaId: string) => {
    return items.find(item => item.productoTiendaId === productoTiendaId)?.quantity || 0;
  };

  // Calcular el máximo disponible para el producto seleccionado
  const selectedProductMaxDisponible = selectedProduct 
    ? calcularDisponibilidadReal(selectedProduct, allProducts).maxPorTransaccion 
    : 0;


  return (
    <>
      {/* 📌 Modal de Productos */}
      <Modal
        open={open}
        onClose={closeModal}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Box
          sx={{
            width: "95vw",
            height: "95vh",
            bgcolor: "white",
            p: 3,
            borderRadius: 2,
            overflow: "auto",
          }}
          flexDirection={"column"}
          // justifyItems={"center"}
        >
          <Box
            display={"flex"}
            flexDirection={"row"}
            alignItems={"flex-start"}
            justifyContent={"space-between"}
          >
            <Typography variant="h4" mb={2} textAlign="left">
              {category ? category.nombre : ""}
            </Typography>
            <Fab size="small" aria-label="close" onClick={closeModal} sx={{position: 'absolute', top: 20, right: 20}}>
              <CloseIcon />
            </Fab>
          </Box>

          <Grid container spacing={2}>
            {productosTienda.map((productoTienda) => (
              <Grid item xs={6} sm={4} md={3} key={productoTienda.id}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                  }}
                  onClick={() => handleProductClick(productoTienda)}
                >
                  <CardContent
                    sx={{
                      flexGrow: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                    }}
                  >
                    <Typography variant="h6" fontWeight="bold">
                      {productoTienda.producto.nombre}
                    </Typography>
                    {productoTienda.producto.descripcion && (
                      <Typography variant="body2" color="text.secondary">
                        {productoTienda.producto.descripcion}
                      </Typography>
                    )}

                    <Box display={'flex'} flexDirection={'row'} justifyContent={'space-between'} alignContent={'space-between'}>
                      <Typography variant="subtitle1" color="text.secondary">
                        {(() => {
                          const { maxPorTransaccion, esFraccion } = calcularDisponibilidadReal(productoTienda, allProducts);
                          const cartQty = getCartQuantity(productoTienda.id);
                          const disponible = maxPorTransaccion - cartQty;
                          return esFraccion 
                            ? `Máx: ${disponible > 0 ? disponible : 0}`
                            : `Cant: ${disponible > 0 ? disponible : 0}`;
                        })()}
                      </Typography>
                      <Typography variant="subtitle1" color="textPrimary">
                        ${productoTienda.precio}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Modal>

      <QuantityDialog
        productoTienda={selectedProduct}
        onClose={handleResetProductQuantity}
        onConfirm={handleConfirmQuantity}
        maxDisponibleOverride={selectedProductMaxDisponible}
      />
    </>
  );
}
