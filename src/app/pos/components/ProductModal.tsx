"use client";

import { useState } from "react";
import {
  Box,
  Grid,
  Typography,
  Modal,
  Fab,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { QuantityDialog } from "./QuantityDialog";
import { calcularDisponibilidadReal } from "../utils/calcularDisponibilidadReal";
import { PosProductItemLayout } from "./PosProductItemLayout";

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

          <Grid container spacing={1.5}>
            {productosTienda.map((productoTienda) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={productoTienda.id}>
                <PosProductItemLayout
                  productoTienda={productoTienda}
                  allProductosTienda={allProducts}
                  showDescription
                  onClick={() => handleProductClick(productoTienda)}
                  sx={{ height: "100%" }}
                />
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
