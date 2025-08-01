import { useState, useEffect } from "react";
import {
  Dialog,
  Box,
  Typography,
  Button,
  Grow,
} from "@mui/material";
import { IProductoTiendaV2 } from "@/types/IProducto";
import { useCartStore } from "@/store/cartStore";

interface QuantityDialogProps {
  productoTienda: IProductoTiendaV2 | null;
  onClose: () => void;
  onConfirm: () => void;
  onAddToCart?: () => void; // Nueva prop para callback después de agregar al carrito
}

export const QuantityDialog = ({ productoTienda, onClose, onConfirm, onAddToCart }: QuantityDialogProps) => {
  const [quantity, setQuantity] = useState(1);
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const { addToCart, items } = useCartStore();

  useEffect(() => {
    setQuantity(1);
  }, [productoTienda]);

  const increase = () => {
    if (productoTienda) {
      // Si el producto tiene unidades por fracción, se usa ese valor.
      // Si si no son productos con fracción se debe verificar que ese producto no esté ya en el carrito,
      // si no está en el carrito la cantidad maxima seria igual a la existencia del producto.
      // si está en el carrito la cantidad maxima seria igual a la existencia del producto menos la cantidad de productos en el carrito.
      
      let maxQuantity = 0;

      const cartQuantity = items.find(item => item.id === productoTienda.id)?.quantity || 0;
      if (cartQuantity > 0) {
        maxQuantity = (
          productoTienda.producto.unidadesPorFraccion > 0
            ? productoTienda.producto.unidadesPorFraccion - 1
            : productoTienda.existencia) - cartQuantity;
      } else {
        maxQuantity = productoTienda.producto.unidadesPorFraccion
          ? productoTienda.producto.unidadesPorFraccion - 1
          : productoTienda.existencia;
      }

      if (quantity < maxQuantity) {
        setDirection('up');
        setQuantity(quantity + 1);
      }
    }
  };

  const decrease = () => {
    if (quantity > 1) {
      setDirection('down');
      setQuantity(quantity - 1);
    }
  };

  const increaseByAmount = (amount: number) => {
    if (productoTienda) {
      const cartQuantity = items.find(item => item.id === productoTienda.id)?.quantity || 0;
      let maxQuantity = 0;

      if (cartQuantity > 0) {
        maxQuantity = (
          productoTienda.producto.unidadesPorFraccion > 0
            ? productoTienda.producto.unidadesPorFraccion - 1
            : productoTienda.existencia) - cartQuantity;
      } else {
        maxQuantity = productoTienda.producto.unidadesPorFraccion
          ? productoTienda.producto.unidadesPorFraccion - 1
          : productoTienda.existencia;
      }

      const newQuantity = quantity + amount;
      if (newQuantity <= maxQuantity) {
        setDirection('up');
        setQuantity(newQuantity);
      }
    }
  };

  const decreaseByAmount = (amount: number) => {
    const newQuantity = quantity - amount;
    if (newQuantity >= 1) {
      setDirection('down');
      setQuantity(newQuantity);
    }
  };

  const canIncreaseByAmount = (amount: number): boolean => {
    if (!productoTienda) return false;

    const cartQuantity = items.find(item => item.id === productoTienda.id)?.quantity || 0;
    let maxQuantity = 0;

    if (cartQuantity > 0) {
      maxQuantity = (
        productoTienda.producto.unidadesPorFraccion > 0
          ? productoTienda.producto.unidadesPorFraccion - 1
          : productoTienda.existencia) - cartQuantity;
    } else {
      maxQuantity = productoTienda.producto.unidadesPorFraccion
        ? productoTienda.producto.unidadesPorFraccion - 1
        : productoTienda.existencia;
    }

    return quantity + amount <= maxQuantity;
  };

  const canDecreaseByAmount = (amount: number): boolean => {
    return quantity - amount >= 1;
  };

  const handleConfirmQuantity = () => {
    if (productoTienda) {
      addToCart({
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id
      }, quantity);
      onClose();
      // Ejecutar callback después de agregar al carrito
      if (onAddToCart) {
        onAddToCart();
      }
    }
  };

  const handlePayAll = () => {
    if (productoTienda) {
      addToCart({
        id: productoTienda.id,
        name: productoTienda.producto.nombre,
        price: productoTienda.precio,
        productoTiendaId: productoTienda.id,
      }, quantity);
      onConfirm();
      // Ejecutar callback después de agregar al carrito
      if (onAddToCart) {
        onAddToCart();
      }
    }
  };

  return (
    <Dialog
      open={Boolean(productoTienda)}
      onClose={onClose}
    >
      {productoTienda && (
        <Box
          p={3}
          display={"flex"}
          flexDirection={"column"}
          alignItems={"center"}
          justifyContent={"center"}
        >
          <Typography variant="h6">{productoTienda.producto.nombre}</Typography>
          <Typography variant="body2" color="text.secondary">
            Precio: ${productoTienda.precio}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Disponibles: {productoTienda.producto.unidadesPorFraccion || productoTienda.existencia}
          </Typography>

          <Box
            display={"flex"}
            flexDirection={"row"}
            padding={0}
            sx={{
              flexWrap: 'wrap',
              gap: { xs: 1, sm: 1.5, md: 2 },
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Button
              variant="contained"
              onClick={decrease}
              disabled={quantity <= 1}
              sx={{
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
              }}
            >
              -1
            </Button>
            <Box
              flex={1}
              sx={{
                marginLeft: 2,
                marginRight: 2,
                width: "30vw",
                height: 100,
                border: "2px solid black",
                position: "relative",
                overflow: "hidden",
                borderRadius: "8px",
              }}
              display={"flex"}
              alignItems={"center"}
              justifyContent={"center"}
            >
              <Grow
                in={true}
                timeout={200}
                style={{
                  position: 'absolute',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Typography
                  sx={{
                    fontSize: "8vw",
                    fontWeight: "bold",
                    transition: 'all 0.2s ease-in-out',
                    transform: direction === 'up' ? 'translateY(-10px)' : 'translateY(10px)',
                    animation: `${direction === 'up' ? 'slideUp' : 'slideDown'} 0.2s ease-in-out`,
                    '@keyframes slideUp': {
                      '0%': {
                        transform: 'translateY(10px)',
                        opacity: 0,
                      },
                      '100%': {
                        transform: 'translateY(0)',
                        opacity: 1,
                      },
                    },
                    '@keyframes slideDown': {
                      '0%': {
                        transform: 'translateY(-10px)',
                        opacity: 0,
                      },
                      '100%': {
                        transform: 'translateY(0)',
                        opacity: 1,
                      },
                    },
                  }}
                >
                  {quantity}
                </Typography>
              </Grow>
            </Box>
            <Button
              variant="contained"
              onClick={increase}
              disabled={quantity >= (productoTienda.producto.unidadesPorFraccion || productoTienda.existencia)}
              sx={{
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  transform: 'scale(1.1)',
                },
                '&:active': {
                  transform: 'scale(0.95)',
                },
              }}
            >
              +1
            </Button>
          </Box>


          <Box
            display={"flex"}
            flexDirection={"row"}
            pt={1}
            sx={{

              flexWrap: 'wrap',
              gap: { xs: 1, sm: 1.5, md: 2 },
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            {(productoTienda.existencia >= 10 || productoTienda.producto.unidadesPorFraccion >= 10) &&
              <>
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  onClick={() => increaseByAmount(10)}
                  disabled={!canIncreaseByAmount(10)}
                  sx={{
                    minWidth: { xs: '40px', sm: '50px', md: '60px' },
                    fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' },
                    padding: { xs: '4px 8px', sm: '6px 12px', md: '8px 16px' },
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                    '&:active': {
                      transform: 'scale(0.95)',
                    },
                  }}
                >
                  +10
                </Button>
                {(productoTienda.existencia >= 50 || productoTienda.producto.unidadesPorFraccion >= 50) &&
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      color="primary"
                      onClick={() => increaseByAmount(50)}
                      disabled={!canIncreaseByAmount(50)}
                      sx={{
                        minWidth: { xs: '40px', sm: '50px', md: '60px' },
                        fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' },
                        padding: { xs: '4px 8px', sm: '6px 12px', md: '8px 16px' },
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        },
                        '&:active': {
                          transform: 'scale(0.95)',
                        },
                      }}
                    >
                      +50
                    </Button>
                    {(productoTienda.existencia >= 100 || productoTienda.producto.unidadesPorFraccion >= 100) &&

                      <Button
                        size="small"
                        variant="contained"
                        color="primary"
                        onClick={() => increaseByAmount(100)}
                        disabled={!canIncreaseByAmount(100)}
                        sx={{
                          minWidth: { xs: '40px', sm: '50px', md: '60px' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' },
                          padding: { xs: '4px 8px', sm: '6px 12px', md: '8px 16px' },
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'scale(1.05)',
                          },
                          '&:active': {
                            transform: 'scale(0.95)',
                          },
                        }}
                      >
                        +100
                      </Button>
                    }
                  </>
                }
              </>
            }
          </Box>



          <Box
            display={"flex"}
            flexDirection={"row"}
            pb={1}
            pt={1}
            sx={{
              flexWrap: 'wrap',
              gap: { xs: 1, sm: 1.5, md: 2 },
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {(productoTienda.existencia >= 10 || productoTienda.producto.unidadesPorFraccion >= 10) &&
              <>
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  onClick={() => decreaseByAmount(10)}
                  disabled={!canDecreaseByAmount(10)}
                  sx={{
                    minWidth: { xs: '40px', sm: '50px', md: '60px' },
                    fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' },
                    padding: { xs: '4px 8px', sm: '6px 12px', md: '8px 16px' },
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                    '&:active': {
                      transform: 'scale(0.95)',
                    },
                  }}
                >
                  -10
                </Button>
                {(productoTienda.existencia >= 50 || productoTienda.producto.unidadesPorFraccion >= 50) &&
                  <>
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      onClick={() => decreaseByAmount(50)}
                      disabled={!canDecreaseByAmount(50)}
                      sx={{
                        minWidth: { xs: '40px', sm: '50px', md: '60px' },
                        fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' },
                        padding: { xs: '4px 8px', sm: '6px 12px', md: '8px 16px' },
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'scale(1.05)',
                        },
                        '&:active': {
                          transform: 'scale(0.95)',
                        },
                      }}
                    >
                      -50
                    </Button>

                    {(productoTienda.existencia >= 100 || productoTienda.producto.unidadesPorFraccion >= 100) &&
                      <Button
                        size="small"
                        variant="contained"
                        color="warning"
                        onClick={() => decreaseByAmount(100)}
                        disabled={!canDecreaseByAmount(100)}
                        sx={{
                          minWidth: { xs: '40px', sm: '50px', md: '60px' },
                          fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' },
                          padding: { xs: '4px 8px', sm: '6px 12px', md: '8px 16px' },
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            transform: 'scale(1.05)',
                          },
                          '&:active': {
                            transform: 'scale(0.95)',
                          },
                        }}
                      >
                        -100
                      </Button>
                    }
                  </>}
              </>
            }










          </Box>

          <Button
            variant="contained"
            fullWidth
            onClick={handleConfirmQuantity}
            sx={{
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              },
            }}
          >
            Agregar al Carrito
          </Button>

          <Button
            sx={{
              mt: 2,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
              },
            }}
            variant="contained"
            color="success"
            fullWidth
            onClick={handlePayAll}
            disabled={!productoTienda.existencia && productoTienda.producto.unidadesPorFraccion === 0}
          >
            Venta Rápida
          </Button>
        </Box>
      )}
    </Dialog>
  );
}; 