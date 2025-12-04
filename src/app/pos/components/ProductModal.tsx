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

export function ProductModal({
  open,
  closeModal,
  productosTienda,
  category,
  openCart,
}) {
  const [selectedProduct, setSelectedProduct] = useState<IProductoTiendaV2 | null>(null);
  const { getCartQuantity } = useCartStore();



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
                        {
                          productoTienda.producto.unidadesPorFraccion &&
                          (getCartQuantity(productoTienda.id) > 0 
                            ? `Cant: ${productoTienda.producto.unidadesPorFraccion - getCartQuantity(productoTienda.id)}`
                            : `Cant: ${productoTienda.producto.unidadesPorFraccion}`)
                        }
                        
                        {!productoTienda.producto.unidadesPorFraccion && 
                         (getCartQuantity(productoTienda.id) > 0 
                          ? `Cant: ${productoTienda.existencia - getCartQuantity(productoTienda.id)}` 
                          : `Cant: ${productoTienda.existencia}`)
                        }
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
      />
    </>
  );
}
