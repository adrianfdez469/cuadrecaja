"use client";

import { useState, useEffect } from "react";
import {
  Typography,
  CircularProgress,
  Box,
  Paper,
  Fab,
  Badge,
  SpeedDial,
  SpeedDialAction,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { Sync } from "@mui/icons-material";
import { useCartStore } from "@/store/cartStore";
import axios from "axios";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ProductModal } from "./components/ProductModal";
import { ICategory } from "@/types/ICategoria";
import { IProductoTienda } from "@/types/IProducto";
import CartDrawer from "@/components/cartDrawer/CartDrawer";
import PaymentModal from "./components/PaymentModal";
import { fetchLastPeriod, openPeriod } from "@/services/cierrePeriodService";
import { ICierrePeriodo } from "@/types/ICierre";
import useConfirmDialog from "@/components/confirmDialog";
import { createSell } from "@/services/sellService";
import { useSalesStore } from "@/store/salesStore";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import BlurOnIcon from "@mui/icons-material/BlurOn";
import { SellsDrawer } from "./components/sells";

export default function POSInterface() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ICategory>(null);
  const [products, setProducts] = useState<IProductoTienda[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [periodo, setPeriodo] = useState<ICierrePeriodo>();

  const {
    items: cart,
    total,
    clearCart,
    removeFromCart,
    updateQuantity,
  } = useCartStore();
  const [loading, setLoading] = useState(true);

  const { user, loadingContext, gotToPath } = useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { productos, sales, addSale, markSynced } = useSalesStore();
  const [syncQuantity, setSyncQuantity] = useState(0);
  const [showSync, setShowSync] = useState(false);
  const [showProductsSells, setShowProductsSells] = useState(false);

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
      const prods = response.data
        .filter((prod) => prod.precio > 0)
        .filter((p) => {
          if (p.existencia <= 0) {
            if (p.fraccionDeId !== null) {
              const pPadre = response.data.find(
                (padre) => padre.id === p.fraccionDeId
              );
              if (pPadre && pPadre.existencia > 0) {
                return true;
              }
            }
            return false;
          }
          return true;
        });

      const productosTienda = prods.sort((a, b) => {
        return a.nombre.localeCompare(b.nombre);
      });
      setProducts(productosTienda);

      const categorias = Object.values(
        prods.reduce((acum, prod) => {
          acum[prod.categoria.id] = prod.categoria;
          return acum;
        }, {}) as ICategory[]
      ).sort((a: ICategory, b: ICategory) => {
        return a.nombre.localeCompare(b.nombre);
      });
      setCategories(categorias);
    } catch (error) {
      console.error("Error al obtener productos", error);
      showMessage("Error al obtener productos", "error");
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

  const handleMakePay = async (
    total: number,
    totalCash: number,
    totalTransfer: number
  ) => {
    try {
      if (total <= totalCash + totalTransfer) {
        const tiendaId = user.tiendaActual.id;
        const cierreId = periodo.id;

        const data = cart.map((prod) => {
          return {
            cantidad: prod.quantity,
            productoTiendaId: prod.productoTiendaId,
            productId: prod.id,
            name: prod.name,
          };
        });
        const cash = total - totalTransfer;

        const identifier = crypto.randomUUID();
        addSale({
          identifier: identifier,
          cierreId: cierreId,
          tiendaId: tiendaId,
          total: total,
          totalcash: cash,
          totaltransfer: totalTransfer,
          productos: data,
          usuarioId: user.id,
        });

        await createSell(
          tiendaId,
          cierreId,
          user.id,
          total,
          cash,
          totalTransfer,
          data
        );
        markSynced(identifier);
      } else {
        showMessage("Falta dinero por pagar ", "warning");
      }
    } catch (error) {
      throw error;
    } finally {
      clearCart();
      setPaymentDialog(false);
      setOpenCart(false);
    }
  };

  const handleSync = async () => {
    setSyncQuantity(ventasSinSincronizar);
    setShowSync(true);
    const salesToSync = sales.filter((sale) => !sale.synced);
    for (const syncObj of salesToSync) {
      try {
        await createSell(
          syncObj.tiendaId,
          syncObj.cierreId,
          syncObj.usuarioId,
          syncObj.total,
          syncObj.totalcash,
          syncObj.totaltransfer,
          syncObj.productos
        );
        markSynced(syncObj.identifier);
      } catch (error) {
        console.error(`Error sincronizando venta ${syncObj.identifier}`, error);
        if (error && error.code && error.code === "ERR_NETWORK") {
          showMessage("Error al sincronizar venta", "error", error);
        }
      }
    }
    setSyncQuantity(ventasSinSincronizar);
    setShowSync(false);
  };

  const ventasSinSincronizar = sales.filter((s) => !s.synced).length;

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <>
      {periodo && periodo.fechaInicio && (
        <Typography variant="body1" bgcolor={"aliceblue"}>
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
          cart={cart}
          onClose={() => setOpenCart(false)}
          open={openCart}
          onOkButtonClick={async () => setPaymentDialog(true)}
          total={total}
          clear={clearCart}
          removeItem={removeFromCart}
          updateQuantity={updateQuantity}
        />

        <PaymentModal
          open={paymentDialog}
          onClose={() => setPaymentDialog(false)}
          total={total}
          makePay={(total: number, totalchash: number, totaltransfer: number) =>
            handleMakePay(total, totalchash, totaltransfer)
          }
        />

        <SellsDrawer
          setShowProducts={setShowProductsSells}
          showProducts={showProductsSells}
        />

        {(ventasSinSincronizar > 0 || productos.length > 0) && (
          <SpeedDial
            ariaLabel="Offline mode"
            sx={{ position: "fixed", bottom: 80, right: 16 }}
            icon={<BlurOnIcon />}
          >
            {ventasSinSincronizar > 0 && !showSync && (
              <SpeedDialAction
                key={"sync"}
                icon={
                  <Badge badgeContent={ventasSinSincronizar} color="secondary">
                    <Sync />
                  </Badge>
                }
                slotProps={{
                  tooltip: {
                    title: "Sincronizar",
                    open: true,
                  },
                }}
                onClick={handleSync}
              />
            )}
            {showSync && (
              <>
                <CircularProgress
                  variant="determinate"
                  value={
                    ((syncQuantity - ventasSinSincronizar) / syncQuantity) * 100
                  }
                />
                <Box
                  sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: "absolute",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography
                    variant="caption"
                    component="div"
                    sx={{ color: "text.secondary" }}
                  >{`${Math.round(
                    ((syncQuantity - ventasSinSincronizar) / syncQuantity) * 100
                  ).toFixed(0)}%`}</Typography>
                </Box>
              </>
            )}
            {productos.length > 0 && (
              <SpeedDialAction
                key={"sells"}
                icon={<CancelPresentationIcon />}
                slotProps={{
                  tooltip: {
                    title: "Productos vendidos",
                    open: true,
                  },
                }}
                onClick={() => setShowProductsSells(true)}
              />
            )}
          </SpeedDial>
        )}

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
