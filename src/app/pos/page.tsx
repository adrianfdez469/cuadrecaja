"use client";

import { useState, useEffect, useRef } from "react";
import {
  Typography,
  CircularProgress,
  Box,
  Paper,
  Fab,
  Badge,
  SpeedDial,
  SpeedDialAction,
  TextField,
  Popper,
  Fade,
  Paper as MuiPaper,
  List,
  ListItem,
  ListItemText,
  InputAdornment,
  IconButton,
  ListItemButton,
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
import { ProducsSalesDrawer } from "./components/ProductsSalesDrawer";
import { SalesDrawer } from "./components/SalesDrawer";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import { QuantityDialog } from "./components/QuantityDialog";

export default function POSInterface() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ICategory>(null);
  const [products, setProducts] = useState<IProductoTienda[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [periodo, setPeriodo] = useState<ICierrePeriodo>();
  const { user, loadingContext, gotToPath } = useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { productos, sales, addSale, markSynced } = useSalesStore();
  const [showProductsSells, setShowProductsSells] = useState(false);
  const [showSyncView, setShowSyncView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IProductoTienda[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<IProductoTienda | null>(null);

  const {
    items: cart,
    total,
    clearCart,
    removeFromCart,
    updateQuantity,
  } = useCartStore();
  const [loading, setLoading] = useState(true);

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
          syncState: "not_synced",
        });


        const newProds = products.map((p) => {
          const cartProd = cart.find((cartItem) => cartItem.id === p.id);
          if(cartProd) {
            return {...p, existencia: p.existencia - cartProd.quantity}
          } else {
            return p;
          }
        });
        setProducts(newProds);

        const ventaDb = await createSell(
          tiendaId,
          cierreId,
          user.id,
          total,
          cash,
          totalTransfer,
          data,
          identifier
        );
        markSynced(identifier, ventaDb.id);
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

  const handleShowSyncView = () => {
    setShowSyncView(true);
  };

  const ventasSinSincronizar = sales.filter((s) => !s.synced).length;

  const handleCloseSyncView = () => {
    setShowSyncView(false);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      const results = products
        .filter(product => 
          product.nombre.toLowerCase().includes(query.toLowerCase())
        )
        .sort((a, b) => {
          // Ordenar por relevancia (coincidencia exacta primero)
          const aStartsWith = a.nombre.toLowerCase().startsWith(query.toLowerCase());
          const bStartsWith = b.nombre.toLowerCase().startsWith(query.toLowerCase());
          if (aStartsWith && !bStartsWith) return -1;
          if (!aStartsWith && bStartsWith) return 1;
          return a.nombre.localeCompare(b.nombre);
        });
      setSearchResults(results);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleProductSelect = (product: IProductoTienda) => {
    setSelectedProduct(product);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  const handleResetProductQuantity = () => {
    setSelectedProduct(null);
  };

  const handleConfirmQuantity = () => {
    handleResetProductQuantity();
    setOpenCart(true);
  };

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

      <Box 
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            md: "repeat(4, 1fr)",
          },
          gap: { xs: 1, sm: 1.5, md: 2 },
          p: { xs: 1, sm: 2 },
          width: "100%",
          maxWidth: "1400px",
          margin: "0 auto",
          pb: { xs: "80px", sm: "90px" },
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
        }}
      >
        {categories.map((category) => (
          <Box
            key={category.id}
            onClick={() => handleOpenProducts(category)}
            sx={{
              position: "relative",
              aspectRatio: "1/1", // Mantiene proporción cuadrada
              borderRadius: { xs: "12px", sm: "16px" },
              overflow: "hidden",
              cursor: "pointer",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:active": {
                transform: "scale(0.98)",
              },
              "&:hover": {
                transform: "translateY(-4px)",
                "& .category-content": {
                  transform: "translateY(0)",
                  opacity: 1,
                },
                "& .category-overlay": {
                  opacity: 0.85,
                },
              },
            }}
          >
            {/* Fondo con gradiente */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `linear-gradient(135deg, ${category.color} 0%, ${category.color}dd 100%)`,
                zIndex: 1,
              }}
            />

            {/* Overlay que se oscurece al hover */}
            <Box
              className="category-overlay"
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))",
                opacity: 0.6,
                transition: "opacity 0.3s ease",
                zIndex: 2,
              }}
            />

            {/* Contenido de la categoría */}
            <Box
              className="category-content"
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                p: { xs: 1.5, sm: 2 },
                transform: "translateY(10px)",
                opacity: 0.9,
                transition: "all 0.3s ease",
                zIndex: 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)",
              }}
            >
              <Typography
                variant="h6"
                sx={{
                  color: "white",
                  fontWeight: 600,
                  fontSize: { xs: "1rem", sm: "1.25rem" },
                  textAlign: "center",
                  textShadow: `
                    0 0 1px rgba(0,0,0,0.8),
                    0 0 2px rgba(0,0,0,0.8),
                    0 0 3px rgba(0,0,0,0.8)
                  `,
                  mb: 0.5,
                  width: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {category.nombre}
              </Typography>
              
              {/* Indicador de toque */}
              <Box
                sx={{
                  width: "30%",
                  height: "3px",
                  background: "rgba(255,255,255,0.8)",
                  borderRadius: "2px",
                  mt: 1,
                  opacity: 0.7,
                }}
              />
            </Box>

            {/* Efecto de brillo */}
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "linear-gradient(45deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%)",
                zIndex: 2,
                pointerEvents: "none",
              }}
            />
          </Box>
        ))}
      </Box>

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

      <ProducsSalesDrawer
        setShowProducts={setShowProductsSells}
        showProducts={showProductsSells}
        productos={productos}
      />

      <SalesDrawer
        showSales={showSyncView}
        handleClose={() => handleCloseSyncView()}
        period={periodo}
      />

      {productos.length > 0 && (
        <SpeedDial
          ariaLabel="Offline mode"
          sx={{ position: "fixed", top: 80, right: 16 }}
          icon={<BlurOnIcon />}
          direction="down"
        >
          <SpeedDialAction
            key={"sync"}
            icon={
              ventasSinSincronizar > 0 ? (
                <Badge badgeContent={ventasSinSincronizar} color="secondary">
                  <Sync />
                </Badge>
              ) : (
                <Sync />
              )
            }
            slotProps={{
              tooltip: {
                title: "Sincronizar",
                open: true,
              },
            }}
            onClick={handleShowSyncView}
          />

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

      {/* Buscador flotante */}
      <Box
        ref={searchAnchorRef}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          p: 2,
          zIndex: 1200,
          background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid rgba(0,0,0,0.1)",
          boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
        }}
      >
        <TextField
          inputRef={searchInputRef}
          fullWidth
          variant="outlined"
          placeholder="Buscar productos..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => {
                    setSearchQuery("");
                    setShowSearchResults(false);
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </InputAdornment>
            ),
            sx: {
              bgcolor: "white",
              borderRadius: "12px",
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
              },
            },
          }}
        />
      </Box>

      {/* Popper para resultados de búsqueda */}
      <Popper
        open={showSearchResults && searchResults.length > 0}
        anchorEl={searchAnchorRef.current}
        placement="top"
        transition
        style={{ width: searchAnchorRef.current?.offsetWidth }}
        modifiers={[
          {
            name: "preventOverflow",
            enabled: true,
            options: {
              altAxis: true,
              altBoundary: true,
              tether: true,
              rootBoundary: "viewport",
            },
          },
        ]}
        sx={{ zIndex: 1300 }}
      >
        {({ TransitionProps }) => (
          <Fade {...TransitionProps} timeout={200}>
            <MuiPaper
              elevation={3}
              sx={{
                width: "100%",
                maxHeight: "70vh",
                overflow: "auto",
                borderRadius: "12px 12px 0 0",
                mt: -2,
                bgcolor: "rgba(255,255,255,0.98)",
                backdropFilter: "blur(10px)",
                boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
              }}
            >
              <List sx={{ p: 0 }}>
                {searchResults.map((product) => (
                  <ListItemButton
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    sx={{
                      borderBottom: "1px solid rgba(0,0,0,0.05)",
                      "&:hover": {
                        bgcolor: "rgba(0,0,0,0.04)",
                      },
                    }}
                  >
                    <ListItemText
                      primary={product.nombre}
                      secondary={`$${product.precio} - ${product.existencia} disponibles`}
                      primaryTypographyProps={{
                        sx: {
                          fontWeight: product.nombre.toLowerCase().startsWith(searchQuery.toLowerCase())
                            ? 600
                            : 400,
                        },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </MuiPaper>
          </Fade>
        )}
      </Popper>

      <QuantityDialog
        product={selectedProduct}
        onClose={handleResetProductQuantity}
        onConfirm={handleConfirmQuantity}
      />

      {ConfirmDialogComponent}
    </>
  );
}
