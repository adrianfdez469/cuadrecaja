import { Close, Delete, Remove, Add } from "@mui/icons-material";
import { Box, Typography,Button, IconButton, Paper, useMediaQuery, useTheme } from "@mui/material";
import { ICartItem } from "@/store/cartStore";
import PushPinIcon from '@mui/icons-material/PushPin';

import { formatCurrencyCUP } from "@/utils/formatters";
import useConfirmDialog from "@/components/confirmDialog";
import { useMessageContext } from "@/context/MessageContext";

interface IProps {
  clear?: () => void;
  cart: ICartItem[];
  updateQuantity?: (id: string, quantity: number) => void;
  onClose: () => void;
  removeItem?: (id: string) => void;
  total: number;
  onOkButtonClick: () => void;
  isCartPinned: boolean;
  setIsCartPinned: (isCartPinned: boolean) => void;
}

export const CartContent = ({
  cart,
  total,
  isCartPinned,
  clear,
  updateQuantity,
  onClose,
  removeItem,
  onOkButtonClick,
  setIsCartPinned,
}: IProps) => {

  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { showMessage } = useMessageContext();

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  const handleRemoveItem = (item: ICartItem) => {
    if (removeItem) {
      confirmDialog(
        `¿Estás seguro de que deseas eliminar "${item.name}" del carrito?`,
        () => {
          removeItem(item.id);
        }
      );
    }
  };

  const decreseQty = (id: string) => {
    const prevQuantity = cart.find((p) => p.id === id).quantity;
    if (prevQuantity === 1) {
      if (removeItem) {
        // Confirmar antes de eliminar completamente el producto
        const product = cart.find((p) => p.id === id);
        confirmDialog(
          `¿Estás seguro de que deseas eliminar "${product?.name}" del carrito?`,
          () => {
            removeItem(id);
          }
        );
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

  const handleClearCart = () => {
    if (clear && cart.length > 0) {
      confirmDialog(
        `¿Estás seguro de que deseas vaciar el carrito? Se eliminarán ${cart.length} producto${cart.length !== 1 ? 's' : ''}.`,
        () => {
          clear();
        }
      );
    }
  };

  const handlePinCart = () => {
    if(!isMobile) {
      setIsCartPinned(!isCartPinned);
    }
  }

  // Calcular ancho dinámico según el estado y pantalla
  const getContainerWidth = () => {
    if (isCartPinned) {
      // Cuando está pineado, usar 100% del contenedor padre que ya está limitado
      return '100%';
    }
    return 360; // Ancho estándar para drawer
  };

  return (
    <Box
      sx={{
        width: getContainerWidth(),
        p: 2,
        display: "flex",
        flexDirection: "column",
        height: isCartPinned ? "calc(100vh - 120px)" : "auto",
        ...(isCartPinned && {
          maxWidth: isMobile ? '100%' : isTablet ? '40vw' : '35vw', // Más flexible según la pantalla
          minWidth: 360,
          maxHeight: 'calc(100vh - 120px)', // Altura máxima para evitar que el buscador lo tape
          position: 'sticky',
          top: 0,
          overflow: 'hidden' // Evitar desbordamiento del contenedor
        })
      }}
    >
      {/* Header */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        mb={2}
      >
        <Box display={"flex"} flexDirection={"column"} flex={1}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6">Venta</Typography>
            {!isMobile && (
              <IconButton 
                onClick={() => handlePinCart()}
                size="small"
                sx={{ 
                  color: isCartPinned ? 'primary.main' : 'secondary.main',
                  '&:hover': {
                    backgroundColor: isCartPinned ? 'primary.50' : 'grey.100'
                  }
                }}
              >
                {isCartPinned ? <PushPinIcon /> : <PushPinIcon />}
              </IconButton>
            )}
          </Box>
          <Typography variant="body2" color="green">
            Productos ({cart.length}) 
          </Typography>
        </Box>

        <Box display={"flex"} flexDirection={"row"} alignItems={"flex-start"}>
          {clear && (
            <Button
              startIcon={<Delete />}
              variant="contained"
              onClick={handleClearCart}
              disabled={cart.length === 0}
              size={isCartPinned && !isTablet ? "medium" : "small"}
              sx={{ 
                mr: 1,
                ...(isCartPinned && !isTablet && {
                  minWidth: 'auto',
                  px: 2
                })
              }}
            >
              Vaciar{" "}
            </Button>
          )}
          <IconButton onClick={onClose} disabled={isCartPinned}>
            <Close color={isCartPinned ? 'disabled' : 'error'}/>
          </IconButton>
        </Box>
      </Box>

      {/* Productos */}
      <Box 
        flex={1} 
        overflow="auto"
        sx={{
          ...(isCartPinned && {
            maxHeight: 'calc(100vh - 280px)', // Restar espacio del header y footer
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'rgba(0,0,0,0.05)',
              borderRadius: '3px',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '3px',
              '&:hover': {
                background: 'rgba(0,0,0,0.3)',
              },
            },
          })
        }}
      >
        {cart.map((item) => (
          <Paper
            key={item.id}
            sx={{ 
              display: "flex", 
              alignItems: "center", 
              p: isCartPinned ? 1.5 : 1, 
              mb: 1,
              ...(isCartPinned && {
                borderRadius: 2,
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              })
            }}
          >
            <Box flex={1}>
              <Typography 
                variant="body1" 
                fontWeight="bold"
                sx={{
                  fontSize: isCartPinned && !isTablet ? '1rem' : '0.875rem'
                }}
              >
                {item.name}
              </Typography>

              <Box
                display={"flex"}
                flexDirection={isCartPinned ? "row" : "column"}
                alignItems={isCartPinned ? "center" : "flex-start"}
                justifyContent={"space-between"}
                gap={isCartPinned ? 2 : 1}
              >
                <Box display="flex" flexDirection="column" alignItems="flex-start">
                  <Typography variant="body2" color="green" fontWeight="medium">
                    {formatCurrencyCUP(item.price)}
                  </Typography>
                  
                  <Box
                    display={"flex"}
                    flexDirection={"row"}
                    alignItems={"center"}
                    gap={isCartPinned ? 1 : 0.5}
                  >
                    <Box
                      display="flex"
                      alignItems="center"
                      bgcolor={"aliceblue"}
                      borderRadius={1}
                      sx={{
                        ...(isCartPinned && {
                          px: 0.5,
                          py: 0.25
                        })
                      }}
                    >
                      {updateQuantity && (
                        <IconButton
                          size="small"
                          onClick={() => decreseQty(item.id)}
                        >
                          <Remove />
                        </IconButton>
                      )}
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          minWidth: '20px', 
                          textAlign: 'center',
                          fontWeight: 'medium'
                        }}
                      >
                        {item.quantity}
                      </Typography>
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
                      fontWeight="medium"
                      sx={{ 
                        paddingLeft: isCartPinned ? 1 : 2,
                        fontSize: isCartPinned ? '0.8rem' : '0.75rem'
                      }}
                    >
                      Total: {formatCurrencyCUP(item.price * item.quantity)}
                    </Typography>
                  </Box>
                </Box>
                
                {removeItem && (
                  <IconButton 
                    onClick={() => handleRemoveItem(item)}
                    size={isCartPinned ? "medium" : "small"}
                    sx={{
                      color: 'error.main',
                      '&:hover': {
                        backgroundColor: 'error.50'
                      }
                    }}
                  >
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
        alignItems={"center"}
        justifyContent={"space-between"}
        sx={{
          ...(isCartPinned && {
            pt: 2,
            borderTop: '1px solid rgba(0,0,0,0.1)'
          })
        }}
      >
        <Box>
          <Typography 
            variant="h6" 
            color="green"
            sx={{
              fontSize: isCartPinned && !isTablet ? '1.25rem' : '1.125rem',
              fontWeight: 'bold'
            }}
          >
            Total: {formatCurrencyCUP(total)}
          </Typography>
        </Box>
        {onOkButtonClick && (
          <Button
            variant="contained"
            color="success"
            disabled={cart.length === 0}
            onClick={onOkButtonClick}
            size={isCartPinned && !isTablet ? "large" : "medium"}
            sx={{
              fontWeight: 'bold',
              ...(isCartPinned && !isTablet && {
                px: 4,
                py: 1.5
              })
            }}
          >
            VENDER
          </Button>
        )}
      </Box>

      {ConfirmDialogComponent}
    </Box>
  );
};
