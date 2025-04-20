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

export function ProductModal({
  open,
  closeModal,
  products,
  category,
  openCart,
}) {
  const [selectedProduct, setSelectedProduct] = useState<IProductoTienda>(null);
  const { addToCart } = useCartStore();
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
    console.log(products);
  }, []);

  // Maneja la selección de un producto
  const handleProductClick = (product) => {
    setSelectedProduct(product);
  };

  // Maneja la confirmación de la cantidad
  const handleConfirmQuantity = () => {
    addToCart(
      {
        id: selectedProduct.id,
        name: selectedProduct.nombre,
        price: selectedProduct.precio,
        productoTiendaId: selectedProduct.productoTiendaId,
      },
      quantity
    );
    handleResetProductQuantity();
  };

  const handleResetProductQuantity = () => {
    console.log("entra a handleResetProductQuantity?????");

    setSelectedProduct(null);
    setQuantity(1);
  };

  const increase = () => {
    setQuantity((qty) => qty + 1);
  };
  const decrease = () => {
    setQuantity((qty) => {
      if (qty > 0) {
        return qty - 1;
      } else {
        return qty;
      }
    });
  };

  const handlePayAll = () => {
    handleConfirmQuantity();
    closeModal();
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
                        {`Existencia: ${product.existencia}`}
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

      {/* 📌 Dialog para Selección de Cantidad */}
      <Dialog
        open={Boolean(selectedProduct)}
        onClose={handleResetProductQuantity}
      >
        {selectedProduct && (
          <Box
            p={3}
            display={"flex"}
            flexDirection={"column"}
            alignItems={"center"}
            justifyContent={"center"}
          >
            <Typography variant="h6">{selectedProduct.nombre}</Typography>
            <Typography variant="body2" color="text.secondary">
              Precio: ${selectedProduct.precio}
            </Typography>

            <Box display={"flex"} flexDirection={"row"} padding={2}>
              <Button variant="contained" onClick={decrease}>
                -
              </Button>
              <Box
                flex={1}
                sx={{
                  marginLeft: 2,
                  marginRight: 2,
                  width: "30vw",
                  height: 100,
                  border: "2px solid black",
                }}
                display={"flex"}
                alignItems={"center"}
                justifyContent={"center"}
              >
                <Typography sx={{ fontSize: "8vw", fontWeight: "bold" }}>
                  {quantity}
                </Typography>
              </Box>
              <Button variant="contained" onClick={increase}>
                +
              </Button>
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={handleConfirmQuantity}
            >
              Agregar al Carrito
            </Button>

            <Button
              sx={{ mt: 2 }}
              variant="contained"
              color="success"
              fullWidth
              onClick={handlePayAll}
            >
              Vender todo
            </Button>
          </Box>
        )}
      </Dialog>
    </>
  );
}
