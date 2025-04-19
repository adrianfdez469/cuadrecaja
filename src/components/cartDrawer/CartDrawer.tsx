import React, { FC, useEffect } from "react";
import {
  Drawer,
  Box,
  Typography,
  IconButton,
  Button,
  Paper,
} from "@mui/material";
import { Close, Delete, Add, Remove } from "@mui/icons-material";
import { ICartItem } from "@/store/cartStore";
import { useMessageContext } from "@/context/MessageContext";

interface IProps {
  open: boolean;
  cart: ICartItem[];
  onClose: () => void;
  onOkButtonClick?: () => Promise<void>; //sell: () => Promise<void>;

  updateQuantity?: (id: string, quantity: number) => void;
  clear?: () => void;
  removeItem?: (id: string) => void;
  total: number;
}

const CartDrawer: FC<IProps> = ({
  open,
  cart,
  onClose,
  onOkButtonClick,
  updateQuantity,
  clear,
  removeItem,
  total,
}) => {
  const { showMessage } = useMessageContext();

  const decreseQty = (id: string) => {
    const prevQuantity = cart.find((p) => p.id === id).quantity;
    if (prevQuantity === 1) {
      if (removeItem) {
        removeItem(id);
      } else {
        showMessage("No puede elminar completamente el producto", "warning");
      }
    } else {
      updateQuantity(id, prevQuantity - 1);
    }
  };
  const increseQty = (id: string) => {
    const prevQuantity = cart.find((p) => p.id === id).quantity;
    updateQuantity(id, prevQuantity + 1);
  };

  useEffect(() => {
    if (cart.length === 0) {
      onClose();
    }
  }, [cart]);

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
          <Box display={"flex"} flexDirection={"column"}>
            <Typography variant="h6">Venta</Typography>
            <Typography variant="body2" color="green">
              Productos ({cart.length})
            </Typography>
          </Box>

          <Box display={"flex"} flexDirection={"row"}>
            {clear && (
              <Button
                startIcon={<Delete />}
                variant="contained"
                onClick={clear}
                disabled={cart.length === 0}
              >
                Vaciar{" "}
              </Button>
            )}
            <IconButton onClick={onClose}>
              <Close color="error" />
            </IconButton>
          </Box>
        </Box>

        {/* Productos */}
        <Box flex={1} overflow="auto">
          {cart.map((item) => (
            <Paper
              key={item.id}
              sx={{ display: "flex", alignItems: "center", p: 1, mb: 1 }}
            >
              <Box flex={1}>
                <Typography variant="body1" fontWeight="bold">
                  {item.name}
                </Typography>

                <Box
                  display={"flex"}
                  flexDirection={"row"}
                  alignItems={"center"}
                  justifyContent={"space-between"}
                >
                  <Box>
                    <Typography variant="body2" color="green">
                      {item.price} CUP
                    </Typography>
                    <Box
                      display={"flex"}
                      flexDirection={"row"}
                      alignItems={"center"}
                    >
                      <Box
                        display="flex"
                        alignItems="center"
                        bgcolor={"aliceblue"}
                      >
                        {updateQuantity && (
                          <IconButton
                            size="small"
                            onClick={() => decreseQty(item.id)}
                          >
                            <Remove />
                          </IconButton>
                        )}
                        <Typography variant="body2">{item.quantity}</Typography>
                        {updateQuantity && (
                          <IconButton
                            size="small"
                            onClick={() => increseQty(item.id)}
                          >
                            <Add />
                          </IconButton>
                        )}
                      </Box>
                      <Typography
                        variant="body2"
                        color="textSecondary"
                        sx={{ paddingLeft: 2 }}
                      >
                        Total: {item.price * item.quantity} CUP
                      </Typography>
                    </Box>
                  </Box>
                  {removeItem && (
                    <IconButton onClick={() => removeItem(item.id)}>
                      <Delete />
                    </IconButton>
                  )}
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
          {onOkButtonClick && (
            <Button
              variant="contained"
              color="success"
              disabled={cart.length === 0}
              onClick={onOkButtonClick}
            >
              VENDER
            </Button>
          )}
        </Box>
      </Box>
    </Drawer>
  );
};

export default CartDrawer;
