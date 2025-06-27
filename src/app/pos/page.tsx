"use client";
"use client";

import { useState, useEffect, useRef } from "react";
import {
  Typography,
  CircularProgress,
  Box,
  Fab,
  Badge,
  SpeedDial,
  SpeedDialAction,
  TextField,
  Popper,
  Fade,
  Paper as MuiPaper,
  List,
  ListItemText,
  InputAdornment,
  IconButton,
  ListItemButton,
  Alert,
  Button,
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
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
export default function POSInterface() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ICategory>(null);
  const [products, setProducts] = useState<IProductoTienda[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [periodo, setPeriodo] = useState<ICierrePeriodo>();
  const [noTiendaActual, setNoTiendaActual] = useState(false);
  const { user, loadingContext, gotToPath } = useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { productos, sales, addSale, markSynced, markSyncing } = useSalesStore();
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
  const { isOnline } = useNetworkStatus();
  
  // Estado para prevenir múltiples sincronizaciones simultáneas (no para pagos)
  const [syncingIdentifiers, setSyncingIdentifiers] = useState<Set<string>>(new Set());

  // Sincronización automática cuando regresa la conexión
  useEffect(() => {
    const syncPendingSales = async () => {
      const salesNotSynced = sales.filter((sale) => 
        sale.syncState === "not_synced" && !syncingIdentifiers.has(sale.identifier)
      );
      
      if (salesNotSynced.length === 0) return;

      console.log(`🔄 Sincronizando automáticamente ${salesNotSynced.length} ventas pendientes...`);
      showMessage(`Sincronizando ${salesNotSynced.length} ventas...`, "info");

      // Marcar como "sincronizando" para evitar duplicados
      const newSyncingIds = new Set(syncingIdentifiers);
      salesNotSynced.forEach(sale => newSyncingIds.add(sale.identifier));
      setSyncingIdentifiers(newSyncingIds);

      let syncedCount = 0;
      let errorCount = 0;

      for (const sale of salesNotSynced) {
        try {
          console.log(`🔄 Sincronizando venta: ${sale.identifier}`);
          markSyncing(sale.identifier); // Marcar como sincronizando
          const ventaDb = await createSell(
            sale.tiendaId,
            sale.cierreId,
            sale.usuarioId,
            sale.total,
            sale.totalcash,
            sale.totaltransfer,
            sale.productos,
            sale.identifier
          );
          markSynced(sale.identifier, ventaDb.id);
          syncedCount++;
        } catch (error) {
          console.error(`❌ Error al sincronizar venta ${sale.identifier}:`, error);
          errorCount++;
        } finally {
          // Remover del set de sincronización
          setSyncingIdentifiers(prev => {
            const newSet = new Set(prev);
            newSet.delete(sale.identifier);
            return newSet;
          });
        }
      }

      if (syncedCount > 0) {
        showMessage(`✅ ${syncedCount} ventas sincronizadas correctamente`, "success");
      }
      
      if (errorCount > 0) {
        showMessage(`⚠️ ${errorCount} ventas no pudieron sincronizarse`, "warning");
      }
    };

    // Solo sincronizar si:
    // 1. Acabamos de recuperar la conexión (isOnline es true)
    // 2. Hay ventas pendientes de sincronizar
    // 3. El periodo está cargado
    if (isOnline && periodo && sales.some(sale => sale.syncState === "not_synced")) {
      // Pequeño delay para asegurar que la conexión esté estable
      const timeoutId = setTimeout(() => {
        syncPendingSales();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, sales, periodo, showMessage, markSynced, syncingIdentifiers]);

  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        // Validar que el usuario tenga una tienda actual
        if (!user.tiendaActual || !user.tiendaActual.id) {
          setNoTiendaActual(true);
          setLoading(false);
          return;
        }
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
        const identifier = crypto.randomUUID();
        
        console.log('🔍 [handleMakePay] Preparando datos de venta:', {
          tiendaId,
          cierreId,
          usuarioId: user.id,
          total,
          totalCash,
          totalTransfer,
          identifier
        });

        const data = cart.map((prod) => {
          const productoEnTienda = products.find(p => p.productoTiendaId === prod.productoTiendaId);
          if (!productoEnTienda) {
            throw new Error(`Producto no encontrado en la tienda: ${prod.name}`);
          }
          return {
            cantidad: prod.quantity,
            productoTiendaId: prod.productoTiendaId,
            productId: productoEnTienda.id,
            name: prod.name,
          };
        });

        console.log('🔍 [handleMakePay] Productos en carrito:', data);

        const cash = total - totalTransfer;
        
        // 1. INMEDIATAMENTE: Vaciar carrito, cerrar modal y drawer
        clearCart();
        setPaymentDialog(false);
        setOpenCart(false);
        
        // 2. Agregar la venta al store local
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

        // 3. Actualizar inventario local
        const newProds = products.map((p) => {
          const cartProd = cart.find((cartItem) => cartItem.productoTiendaId === p.productoTiendaId);
          if (cartProd) {
            return { ...p, existencia: p.existencia - cartProd.quantity }
          } else {
            return p;
          }
        });
        setProducts(newProds);

        // 4. Mostrar notificación inicial (solo una)
        showMessage("💳 Procesando venta...", "info");

        // 5. Intentar sincronizar con el backend si estamos online
        if (isOnline) {
          try {
            console.log('🔍 [handleMakePay] Enviando venta al backend...');
            markSyncing(identifier); // Marcar como sincronizando
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
            console.log('🔍 [handleMakePay] Respuesta del backend:', ventaDb);
            markSynced(identifier, ventaDb.id);
            showMessage("✅ Venta procesada y sincronizada exitosamente", "success");
          } catch (syncError) {
            console.log('🔍 [handleMakePay] Error de sincronización:', syncError);
            showMessage("📱 Venta guardada localmente. Se sincronizará automáticamente.", "info");
          }
        } else {
          showMessage("📱 Venta guardada localmente. Se sincronizará cuando haya conexión.", "info");
        }
      }
    } catch (error) {
      console.log(error);
      showMessage("❌ Error al procesar el pago", "error");
      // En caso de error, también limpiar el carrito para evitar estados inconsistentes
      clearCart();
      setPaymentDialog(false);
      setOpenCart(false);
      throw error;
    }
  };
  const handleShowSyncView = () => {
    setShowSyncView(true);
  };
  const handleCloseSyncView = () => {
    setShowSyncView(false);
  };
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const filtered = products.filter((product) =>
      product.nombre.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(filtered.slice(0, 10)); // Limitar a 10 resultados
    setShowSearchResults(true);
  };
  const handleProductSelect = (product: IProductoTienda) => {
    setSelectedProduct(product);
    setShowSearchResults(false);
    setSearchQuery("");
  };
  const handleResetProductQuantity = () => {
    setSelectedProduct(null);
  };
  const handleConfirmQuantity = () => {
    setSelectedProduct(null);
  };
  if (loadingContext || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }
  if (noTiendaActual) {
    return (
      <Box p={2}>
        <Typography variant="h4" gutterBottom>
          Punto de Venta (POS)
        </Typography>
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1" gutterBottom>
            Para usar el punto de venta, necesitas tener una tienda seleccionada como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la configuración.
          </Typography>
          <Box mt={2}>
            <Button
              variant="contained"
              color="primary"
              onClick={() => gotToPath("/configuracion/tiendas")}
              sx={{ mr: 2 }}
            >
              Ir a Configuración de Tiendas
            </Button>
            <Button
              variant="outlined"
              onClick={() => gotToPath("/")}
            >
              Volver al Inicio
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <>
      {/* Barra superior con información del sistema - posicionada debajo del menú */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          bgcolor: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0,0,0,0.1)",
          px: 2,
          py: 1,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          mb: 1,
        }}
      >
        {/* Información del lado izquierdo */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
          }}
        >
          {/* Información del corte */}
          {periodo && periodo.fechaInicio && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                bgcolor: "primary.main",
                color: "white",
                px: 2,
                py: 0.5,
                borderRadius: "20px",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "rgba(255,255,255,0.8)",
                }}
              />
              Período: {new Date(periodo.fechaInicio).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </Box>
          )}

          {/* Indicador unificado de ventas pendientes/sincronizando */}
          {(sales.filter(sale => sale.syncState === "not_synced" || sale.syncState === "syncing").length > 0) && (
            <Box
              sx={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                // Color de fondo dinámico según el estado
                bgcolor: sales.filter(sale => sale.syncState === "syncing").length > 0 
                  ? "primary.light" // Azul cuando está sincronizando
                  : "rgba(255, 152, 0, 0.2)", // Warning claro cuando está offline/pendiente
                // Color del texto dinámico
                color: sales.filter(sale => sale.syncState === "syncing").length > 0 
                  ? "primary.contrastText" 
                  : "warning.main",
                // Borde solo cuando está pendiente (offline)
                border: sales.filter(sale => sale.syncState === "syncing").length > 0 
                  ? "none" 
                  : "1px solid",
                borderColor: "warning.main",
                px: 1.5,
                py: 0.5,
                borderRadius: "16px",
                fontSize: "0.75rem",
                fontWeight: 600,
                overflow: "hidden",
                // Efecto visual solo cuando está sincronizando
                "&::before": sales.filter(sale => sale.syncState === "syncing").length > 0 ? {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: "-100%",
                  width: "100%",
                  height: "100%",
                  background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                  animation: "syncProgress 2s infinite",
                } : {},
                "@keyframes syncProgress": {
                  "0%": { left: "-100%" },
                  "100%": { left: "100%" },
                },
              }}
            >
              {/* Spinner solo cuando está sincronizando */}
              {sales.filter(sale => sale.syncState === "syncing").length > 0 && (
                <CircularProgress 
                  size={12} 
                  sx={{ 
                    color: "primary.contrastText",
                    zIndex: 1 // Para que esté encima del gradiente
                  }} 
                />
              )}
              
              {/* Texto dinámico según el estado */}
              <Box sx={{ zIndex: 1 }}>
                {sales.filter(sale => sale.syncState === "syncing").length > 0 
                  ? `${sales.filter(sale => sale.syncState === "not_synced" || sale.syncState === "syncing").length} sincronizando`
                  : `${sales.filter(sale => sale.syncState === "not_synced").length} pendientes`
                }
              </Box>
            </Box>
          )}
        </Box>

        {/* Estado de conexión del lado derecho - Solo se muestra si no hay ventas pendientes ni sincronizando */}
        {sales.filter(sale => sale.syncState === "not_synced" || sale.syncState === "syncing").length === 0 && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              bgcolor: isOnline ? "success.main" : "warning.main",
              color: "white",
              px: 1.5,
              py: 0.5,
              borderRadius: "16px",
              fontSize: "0.75rem",
              fontWeight: 600,
              transition: "all 0.3s ease",
            }}
          >
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: "rgba(255,255,255,0.9)",
                animation: isOnline ? "none" : "pulse 2s infinite",
                "@keyframes pulse": {
                  "0%": { opacity: 1 },
                  "50%": { opacity: 0.5 },
                  "100%": { opacity: 1 },
                },
              }}
            />
            {isOnline ? "Conectado" : "Desconectado"}
          </Box>
        )}
      </Box>

      {/* Contenido principal */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(2, 1fr)",
            sm: "repeat(3, 1fr)",
            md: "repeat(4, 1fr)",
          },
          gap: { xs: 0.5, sm: 1.5, md: 2 },
          p: { xs: 0.5, sm: 2 },
          width: "100%",
          maxWidth: "1400px",
          margin: "0 auto",
          pb: { xs: "80px", sm: "90px" },
          minHeight: "90vh",
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
              sales.filter((s) => !s.synced).length > 0 ? (
                <Badge badgeContent={sales.filter((s) => !s.synced).length} color="secondary">
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
          sx={{ position: "fixed", bottom: 100, right: 16 }}
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