"use client";

import { useState, useEffect } from "react";
import {
  Typography,
  CircularProgress,
  Box,
  Paper,
  Fab,
  Badge,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useCartStore } from "@/store/cartStore";
import axios from "axios";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ProductModal } from "./components/ProductModal";
import { ICategory } from "@/types/ICategorias";
import { IProductoTienda } from "@/types/IProducto";
import CartDrawer from "./components/CartDrawer";
import PaymentModal from "./components/PaymentModal";
import {
  fetchLastPeriod,
  openPeriod
} from "@/services/cierrePeriodService";
import { ICierrePeriodo } from "@/types/ICierre";
import useConfirmDialog from "@/components/confirmDialog";
import { createSell } from "@/services/sellService";

export default function POSInterface() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ICategory>(null);
  const [products, setProducts] = useState<IProductoTienda[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [periodo, setPeriodo] = useState<ICierrePeriodo>();

  const { items: cart, total, clearCart } = useCartStore();
  const [loading, setLoading] = useState(true);

  const { user, loadingContext, gotToPath } = useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        if (!user.tiendaActual) {
          await gotToPath("/");
        } else {
          try {
            const lastPeriod = await fetchLastPeriod(user.tiendaActual.id);
            let message = "";

            if (!lastPeriod || lastPeriod.fechaFin) {
              message =
                "No existe un período abierto. Desea abrir un nuevo período?";
            }

            if (!lastPeriod || lastPeriod.fechaFin) {
              // Mostrar un mensaje

              confirmDialog(
                message,
                () => {
                  openPeriod(user.tiendaActual.id).then((newPeriod) => {
                    setPeriodo(newPeriod);
                    return fetchProductosAndCategories();
                  });
                },
                () => {
                  showMessage(
                    "No puede comenzar a vender si no tiene un período abierto",
                    "warning"
                  );
                  gotToPath("/");
                }
              );
            } else {
              setPeriodo(lastPeriod);
            }
          } catch (error) {
            console.log(error);
            showMessage(
              "Ocurrió un erro intentando cargar le período",
              "error"
            );
          } finally {
            setLoading(false);
          }
        }
      }
    })();
  }, [loadingContext]);

  const fetchProductosAndCategories = async () => {
    try {
      setLoading(true);
      const response = await axios.get<IProductoTienda[]>(
        `/api/productos_tienda/${user.tiendaActual.id}/productos_venta`,
        {
          params: {
            incluseCategories: true,
          },
        }
      );
      setProducts(
        response.data.sort((a, b) => {
          return a.nombre.localeCompare(b.nombre);
        })
      );

      const categorias = Object.values(
        response.data.reduce((acum, prod) => {
          acum[prod.categoria.id] = prod.categoria;
          return acum;
        }, {}) as ICategory[]
      ).sort((a: ICategory, b: ICategory) => {
        return a.nombre.localeCompare(b.nombre);
      });
      setCategories(categorias);
    } catch (error) {
      console.error("Error al obtener productos", error);
      showMessage("Error al obtener productos", 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (periodo) {
      fetchProductosAndCategories().catch((error) => {
        console.log(error);
        showMessage(
          "Ocurrió un error intentando cargar las categorías",
          "error"
        );
      });
    }
  }, [periodo]);

  

  const handleOpenProducts = (category: ICategory) => {
    setSelectedCategory(category);
    setShowProducts(true);
  };

  const handleCartIcon = () => {
    setOpenCart(true);
  };

  const handleMakePay = async (total: number, totalCash: number, totalTransfer: number) => {
    if(total <= totalCash + totalTransfer) {
      const tiendaId = user.tiendaActual.id;
      const cierreId = periodo.id;

      const data = cart.map((prod) => {
        return {
          cantidad: prod.quantity, 
          productoTiendaId: prod.productoTiendaId
        }
      })
      await createSell(tiendaId, cierreId, user.id, total, totalCash, totalTransfer, data);
      clearCart();
      setPaymentDialog(false);
      setOpenCart(false);
    } else {
      showMessage("Falta dinero por pagar ", "warning");
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <>
      {periodo && periodo.fechaInicio && (
        <Typography variant="body1" bgcolor={'aliceblue'}>
          Corte: {new Date(periodo.fechaInicio).toLocaleDateString()}
        </Typography>
      )}

      <Box display="flex" flexWrap="wrap" gap={2} p={2} justifyContent="center">
        {categories.map((category) => (
          <Paper
            key={category.id}
            sx={{
              minWidth: 180,
              maxWidth: 250,
              flex: "1 1 180px",
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: category.color,
              color: "white",
              borderRadius: 3,
              boxShadow: 3,
              cursor: "pointer",
              transition: "transform 0.2s, box-shadow 0.2s",
              "&:hover": {
                transform: "scale(1.05)",
                boxShadow: 6,
              },
            }}
            onClick={() => handleOpenProducts(category)}
          >
            <Typography
              variant="h6"
              sx={{
                bgcolor: "rgba(255,255,255,0.8)",
                color: "black",
                px: 2,
                py: 1,
                borderRadius: 2,
                textAlign: "center",
                fontWeight: "bold",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "90%",
              }}
            >
              {category.nombre}
            </Typography>
          </Paper>
        ))}

        {selectedCategory && (
          <ProductModal
            open={showProducts}
            products={products.filter(
              (p) => p.categoria.id === selectedCategory.id
            )}
            category={selectedCategory}
            closeModal={() => setShowProducts(false)}
            openCart={() => setOpenCart(true)}
          />
        )}

        <CartDrawer
          cartItems={cart}
          onClose={() => setOpenCart(false)}
          open={openCart}
          sell={() => setPaymentDialog(true)}
        />

        <PaymentModal
          open={paymentDialog}
          onClose={() => setPaymentDialog(false)}
          total={total}
          makePay={(total: number, totalchash: number, totaltransfer: number) => handleMakePay(total, totalchash, totaltransfer)}
        />

        {cart.length > 0 && !openCart && (
          <Fab
            color="primary"
            aria-label="cart"
            sx={{ position: "fixed", bottom: 16, right: 16 }}
            onClick={handleCartIcon}
          >
            <Badge badgeContent={cart.length} color="secondary">
              <ShoppingCartIcon />
            </Badge>
          </Fab>
        )}

        {ConfirmDialogComponent}
      </Box>
    </>
  );
}
