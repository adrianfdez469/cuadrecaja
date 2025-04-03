import React, { useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Paper,
} from "@mui/material";
import { Close, Delete, Add, Remove } from "@mui/icons-material";
import { useCartStore } from "@/store/cartStore";

const CartDrawer = ({ open, onClose, cartItems, sell }) => {
  const {
    items: cart,
    updateQuantity,
    clearCart,
    removeFromCart,
    total,
  } = useCartStore();

  const decreseQty = (id: string) => {
    const prevQuantity = cart.find(p => p.id === id).quantity;
    if(prevQuantity === 1){
      deleteItem(id);
    } else {
      updateQuantity(id, prevQuantity - 1);
    }
  }
  const increseQty = (id: string) => {
    const prevQuantity = cart.find(p => p.id === id).quantity;
    updateQuantity(id, prevQuantity + 1);
  }
  const deleteItem = (id: string) => {
    removeFromCart(id);
  }
  const emptyCart = () => {
    clearCart();
  }

  useEffect(() => {
    if(cartItems.length === 0) {
      onClose();
    }
  }, [cartItems])

  return (
    <Drawer anchor="right" open={open} onClose={onClose}>
      <Box
        sx={{
          width: 360,
          p: 2,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
        }}
      >
        {/* Header */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box display={'flex'} flexDirection={'column'}>
            <Typography variant="h6">Venta</Typography>
            <Typography variant="body2" color="green">Productos ({cart.length})</Typography>
          </Box>

          <Box display={'flex'} flexDirection={'row'}>
            <Button startIcon={<Delete />} variant="contained" onClick={emptyCart} disabled={cart.length === 0}>Vaciar </Button>
            <IconButton onClick={onClose}>
              <Close color="error" />
            </IconButton>
          </Box>

        </Box>

        {/* Productos */}
        <Box flex={1} overflow="auto">
          {cartItems.map((item) => (
            <Paper
              key={item.id}
              sx={{ display: "flex", alignItems: "center", p: 1, mb: 1 }}
            >
              <Box flex={1}>
                
                  <Typography variant="body1" fontWeight="bold">
                    {item.name}
                  </Typography>
                
                <Box display={'flex'} flexDirection={'row'} alignItems={'center'} justifyContent={'space-between'}>
                  <Box>
                    <Typography variant="body2" color="green">
                      {item.price} CUP
                    </Typography>
                    <Box display={'flex'} flexDirection={'row'} alignItems={'center'}>
                      <Box display="flex" alignItems="center" bgcolor={'aliceblue'}>
                        <IconButton size="small" onClick={() => decreseQty(item.id)} >
                          <Remove />
                        </IconButton>
                        <Typography variant="body2">{item.quantity}</Typography>
                        <IconButton size="small" onClick={() => increseQty(item.id)}>
                          <Add />
                        </IconButton>
                      </Box>
                      <Typography variant="body2" color="textSecondary" sx={{paddingLeft: 2}}>
                        Total: {item.price * item.quantity} CUP
                      </Typography>
                    </Box>
                  </Box>
                  <IconButton onClick={() => deleteItem(item.id)}>
                    <Delete />
                  </IconButton>
                </Box>
              </Box>
              
            </Paper>
          ))}
        </Box>

        {/* Footer */}
        <Box
          mt={2}
          display={"flex"}
          flexDirection={"row"}
          alignItems={"flex-end"}
          justifyContent={"space-between"}
        >
          <Box>
            <Typography variant="h6" color="green">
              Total: {total} CUP
            </Typography>
          </Box>
          <Button variant="contained" color="success" disabled={cart.length === 0} onClick={sell}>
            VENDER
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
};

export default CartDrawer;
