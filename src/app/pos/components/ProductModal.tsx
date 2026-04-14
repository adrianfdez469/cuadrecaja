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
import { IProductoTiendaV2 } from "@/schemas/producto";
import { QuantityDialog } from "./QuantityDialog";
import { ProductQuickActions } from "./ProductQuickActions";
import { useCartStore } from "@/store/cartStore";
import { calcularDisponibilidadReal } from "../utils/calcularDisponibilidadReal";

interface ProductModalProps {
  open: boolean;
  closeModal: () => void;
  productosTienda: IProductoTiendaV2[];
  allProductosTienda?: IProductoTiendaV2[];
  category: { id: string; nombre: string; color: string } | null;
  openCart: () => void;
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
    return items.find((item) => item.productoTiendaId === productoTiendaId)?.quantity || 0;
  };

  const selectedProductMaxDisponible = selectedProduct
    ? calcularDisponibilidadReal(selectedProduct, allProducts).maxPorTransaccion
    : 0;

  return (
    <>
      <Modal
        open={open}
        onClose={closeModal}
        sx={{ display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <Box
          sx={{
            width: { xs: "100vw", sm: "95vw" },
            height: { xs: "100dvh", sm: "95vh" },
            bgcolor: "white",
            p: { xs: 2, sm: 3 },
            pt: { xs: "calc(16px + env(safe-area-inset-top))", sm: 3 },
            pb: { xs: "calc(16px + env(safe-area-inset-bottom))", sm: 3 },
            borderRadius: { xs: 0, sm: 2 },
            overflow: "auto",
            position: "relative",
          }}
          flexDirection={"column"}
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
            <Fab
              size="small"
              aria-label="Cerrar"
              onClick={closeModal}
              sx={{
                position: "fixed",
                top: { xs: "calc(16px + env(safe-area-inset-top))", sm: 20 },
                right: { xs: "calc(16px + env(safe-area-inset-right))", sm: 20 },
                zIndex: 10,
              }}
            >
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

                    <Box
                      display="flex"
                      flexDirection="row"
                      justifyContent="space-between"
                      alignItems="center"
                      flexWrap="wrap"
                      gap={0.5}
                    >
                      <Typography
                        variant="subtitle1"
                        color="text.secondary"
                        sx={{ fontSize: { xs: "0.75rem", sm: "0.875rem" } }}
                      >
                        {(() => {
                          const { maxPorTransaccion, esFraccion } = calcularDisponibilidadReal(
                            productoTienda,
                            allProducts
                          );
                          const cartQty = getCartQuantity(productoTienda.id);
                          const disponible = maxPorTransaccion - cartQty;
                          if (esFraccion) {
                            const existenciaReal = Math.max(
                              0,
                              productoTienda.existencia || 0
                            );
                            return `Stock: ${existenciaReal} | Máx: ${disponible > 0 ? disponible : 0}`;
                          }
                          return `Cant: ${disponible > 0 ? disponible : 0}`;
                        })()}
                      </Typography>
                      <Typography
                        variant="subtitle1"
                        color="textPrimary"
                        fontWeight="medium"
                        sx={{ fontSize: { xs: "0.875rem", sm: "1rem" } }}
                      >
                        ${productoTienda.precio}
                      </Typography>
                    </Box>

                    <Box mt={1}>
                      <ProductQuickActions
                        productoTienda={productoTienda}
                        allProductosTienda={allProducts}
                      />
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
