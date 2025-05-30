"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Modal,
  Dialog,
  Button,
  Fab,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useCartStore } from "@/store/cartStore";
import { IProductoTienda } from "@/types/IProducto";
import { QuantityDialog } from "./QuantityDialog";

export function ProductModal({
  open,
  closeModal,
  products,
  category,
  openCart,
}) {
  const [selectedProduct, setSelectedProduct] = useState<IProductoTienda | null>(null);
  const { addToCart } = useCartStore();

  const handleProductClick = (product: IProductoTienda) => {
    setSelectedProduct(product);
  };

  const handleResetProductQuantity = () => {
    setSelectedProduct(null);
  };

  const handleConfirmQuantity = () => {
    handleResetProductQuantity();
    openCart();
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
            <Fab size="small" aria-label="close" onClick={closeModal}>
              <CloseIcon />
            </Fab>
          </Box>

          <Grid container spacing={2}>
            {products.map((product) => (
              <Grid item xs={6} sm={4} md={3} key={product.id}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    cursor: "pointer",
                  }}
                  onClick={() => handleProductClick(product)}
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
                      {product.nombre}
                    </Typography>
                    {product.descripcion && (
                      <Typography variant="body2" color="text.secondary">
                        {product.descripcion}
                      </Typography>
                    )}

                    <Box display={'flex'} flexDirection={'row'} justifyContent={'space-between'} alignContent={'space-between'}>
                      <Typography variant="subtitle1" color="text.secondary">
                        {`Cant: ${product.existencia}`}
                      </Typography>
                      <Typography variant="subtitle1" color="textPrimary">
                        ${product.precio}
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
        product={selectedProduct}
        onClose={handleResetProductQuantity}
        onConfirm={handleConfirmQuantity}
      />
    </>
  );
}
