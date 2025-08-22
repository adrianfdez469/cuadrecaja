"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  useTheme,
  useMediaQuery,
} from "@mui/material";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import Sync from "@mui/icons-material/Sync";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import BlurOnIcon from "@mui/icons-material/BlurOn";

import { useCartStore } from "@/store/cartStore";
import axios from "axios";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ProductModal } from "./components/ProductModal";
import { ICategory } from "@/types/ICategoria";
import { IProductoTiendaV2 } from "@/types/IProducto";
import CartDrawer from "@/components/cartDrawer/CartDrawer";
import PaymentModal from "./components/PaymentModal";
import { fetchLastPeriod, openPeriod } from "@/services/cierrePeriodService";
import { ICierrePeriodo } from "@/types/ICierre";
import useConfirmDialog from "@/components/confirmDialog";
import { createSell } from "@/services/sellService";
import { useSalesStore } from "@/store/salesStore";

import { SalesDrawer } from "./components/SalesDrawer";
import { UserSalesDrawer } from "./components/UserSalesDrawer";

import { QuantityDialog } from "./components/QuantityDialog";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

import ProductProcessorData from '@/components/ProductProcessorData/ProductProcessorData';
import { formatDate } from "@/utils/formatters";

import { IProcessedData } from "@/types/IProcessedData";
import { ITransferDestination } from "@/types/ITransferDestination";
import { fetchTransferDestinations } from "@/services/transferDestinationsService";
import { CartContent } from "@/components/cartDrawer/components/cartContent";
import { ProductProcessorDataRef } from "@/components/ProductProcessorData/ProductProcessorData";
import audioService from "@/utils/audioService";

export default function POSInterface() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ICategory>(null);
  const [productosTienda, setProductosTienda] = useState<IProductoTiendaV2[]>([]);
  const [showProducts, setShowProducts] = useState(false);
  const [openCart, setOpenCart] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [periodo, setPeriodo] = useState<ICierrePeriodo>();
  const [noLocalActual, setNoLocalActual] = useState(false);
  const { user, loadingContext, gotToPath } = useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { productos, sales, addSale, markSynced, markSyncing, checkSyncTimeouts, markSyncError } = useSalesStore();
  const [showUserSales, setShowUserSales] = useState(false);
  const [showSyncView, setShowSyncView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<IProductoTiendaV2[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchAnchorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedProduct, setSelectedProduct] = useState<IProductoTiendaV2 | null>(null);
  const {
    items: cart,
    total,
    clearCart,
    removeFromCart,
    updateQuantity,
  } = useCartStore();
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkStatus();
  const [transferDestinations, setTransferDestinations] = useState<ITransferDestination[]>([]);
  const [intentToSearch, setIntentToSearch] = useState(false);
  const [openSpeedDial, setOpenSpeedDial] = useState(false);

  // Referencia al scanner para poder reabrirlo
  const scannerRef = useRef<ProductProcessorDataRef>(null);

  // Estado para prevenir múltiples sincronizaciones simultáneas (no para pagos)
  const [syncingIdentifiers, setSyncingIdentifiers] = useState<Set<string>>(new Set());

  // Estado para el scanner
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Estado para rastrear el origen del producto seleccionado
  const [productOrigin, setProductOrigin] = useState<'camera' | 'search' | 'hardware' | null>(null);

  const [isCartPinned, setIsCartPinned] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  // Calcular ancho del carrito según la pantalla
  const getCartWidth = () => {
    if (isMobile) return '100%';
    if (isTablet) return '40vw';
    return '35vw';
  };

  const getMainContentWidth = () => {
    if (!isCartPinned) return '100%';
    if (isMobile) return '100%';
    if (isTablet) return 'calc(100% - 40vw)';
    return 'calc(100% - 35vw)';
  };

  // Función para reabrir el scanner solo si el producto vino de escaneo de cámara
  const reopenScannerIfNeeded = () => {
    if (productOrigin === 'camera' && scannerRef.current) {
      // Pequeño delay para asegurar que el modal se haya cerrado
      setTimeout(() => {
        scannerRef.current?.openScanner();
      }, 100);
    }
    // Limpiar el origen después de usar
    setProductOrigin(null);
  };

  // Función para manejar escaneo de hardware (pistola)
  const handleHardwareScan = (data: IProcessedData) => {
    if (data?.code) {
      const product = findProductByCode(data.code);
      if (product) {
        // Agregar directamente al carrito con cantidad 1
        const { addToCart } = useCartStore.getState();
        addToCart({
          id: product.id,
          name: product.producto.nombre,
          price: product.precio,
          productoTiendaId: product.id
        }, 1);

        // Actualizar inventario local
        
        // incrementarCantidades(product.id, -1);
        
        // const newProds = productosTienda.map((p) => {
        //   if (p.id === product.id) {
        //     return { ...p, existencia: p.existencia - 1 }
        //   } else {
        //     return p;
        //   }
        // });
        // setProductosTienda(newProds);

        // Mostrar notificación
        showMessage(`✅ ${product.producto.nombre} agregado al carrito`, "success");
        setScannerError(null);
        audioService.playSuccessSound();
        // NO reabrir escáner para escaneo de hardware
      } else {
        setScannerError('Producto no encontrado para el código escaneado');
        audioService.playErrorSound();
      }
    }
  };


  // Crear un Map/índice al cargar productos una sola vez
  const productCodeMap = useMemo(() => {
    const map = new Map<string, IProductoTiendaV2[]>();
    productosTienda.forEach(product => {
      product.producto.codigosProducto?.forEach(code => {
        if (!map.has(code.codigo)) map.set(code.codigo, []);
        map.get(code.codigo).push(product);
      });
    });
    return map;
  }, [productosTienda]);

  // Busca producto por código (en cualquier código asociado)
  function findProductByCode(code: string) {
    const products = productCodeMap.get(code) || [];

    if (products.length > 1) {
      return products.sort((a, b) => {
        // TODO: organizar primero los productos sin proveedor
        if (a.proveedorId === null) {
          return -1;
        } else if (b.proveedorId === null) {
          return 1;
        } else {
          return a.existencia - b.existencia;
        }
      })[0];
    } else if (products.length === 1) {
      return products[0];
    } else {
      return null;
    }
  }

  function handleProductScan(code: string) {
    const product = findProductByCode(code);
    if (product) {
      setSelectedProduct(product);
      setShowProducts(false); // Cierra modal de categorías si está abierto
      // El modal de cantidad se abre automáticamente por el estado selectedProduct
      setScannerError(null);
      setProductOrigin('camera'); // Marcar como escaneo de cámara
    } else {
      setScannerError('Producto no encontrado para el código escaneado');
      audioService.playErrorSound();
    }
  }

  const syncPendingSales = async () => {
    console.log('🔄 Sincronización automática');

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
          sale.identifier,
          sale.transferDestinationId,
          sale.createdAt, // 🆕 Usar timestamp de la venta
          sale.wasOffline, // 🆕 Usar estado offline de la venta
          sale.syncAttempts // 🆕 Enviar intentos de sincronización
        );
        markSynced(sale.identifier, ventaDb.id);
        syncedCount++;
      }
      catch (error) {
        console.error(`❌ Error al sincronizar venta ${sale.identifier}:`, error);

        // Manejo mejorado de errores
        if (error.message?.includes('TIMEOUT_ERROR')) {
          console.warn(`⚠️ Timeout en venta ${sale.identifier} - se reintentará más tarde`);
        } else if (error.message?.includes('NETWORK_ERROR')) {
          console.warn(`⚠️ Error de red en venta ${sale.identifier} - se reintentará cuando haya conexión`);
        } else if (error.message?.includes('SERVER_ERROR')) {
          console.warn(`⚠️ Error del servidor en venta ${sale.identifier} - se reintentará más tarde`);
        } else if (error.message?.includes('CLIENT_ERROR')) {
          console.error(`❌ Error de datos en venta ${sale.identifier}:`, error.message);
        } else if (error.message?.includes('Existencia insuficiente')) {
          console.error(`❌ Error crítico: Existencia insuficiente en venta ${sale.identifier}:`, error.message);
          // Marcar como error permanente para evitar reintentos
          markSyncError(sale.identifier);
        } else if (error.response?.status === 400 &&
          error.response?.data?.error?.includes("fuera del período actual")) {
          console.error(`❌ Error crítico: Venta ${sale.identifier} fuera del período actual - no se puede sincronizar`);
          // Marcar como error permanente para evitar reintentos
          markSyncError(sale.identifier);
        }

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

    if (errorCount > 0) {
      showMessage(`⚠️ ${errorCount} ventas no pudieron sincronizarse`, "warning");
    }

    if (syncedCount > 0) {
      showMessage(`✅ ${syncedCount} ventas sincronizadas correctamente`, "success");

      if (isOnline) {
        fetchProductosAndCategories(true);
      }
    }

  };

  const fetchProductosAndCategories = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await axios.get<IProductoTiendaV2[]>(
        `/api/productos_tienda/${user.localActual.id}/productos_venta`,
        {
          params: {
            incluseCategories: true,
          },
        }
      );
      const prods = response.data
        // Agregar el nombre del proveedor al producto
        .map(prod => ({
          ...prod,
          producto: {
            ...prod.producto,
            nombre: prod.proveedor ? `${prod.producto.nombre} - ${prod.proveedor.nombre}` : prod.producto.nombre
          }
        }))
        // Filtrar productos con precio positivo
        .filter((prod) => prod.precio > 0)
        // Filtrar productos con existencia positiva
        .filter((p) => {
          if (p.existencia <= 0) {
            // Si el producto tiene unidades por fracción, se debe verificar que el producto padre tenga existencia 
            if (p.producto.fraccionDeId !== null) {
              const pPadre = response.data.find(
                (padre) => padre.productoId === p.producto.fraccionDeId
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
        return a.producto.nombre.localeCompare(b.producto.nombre);
      });
      setProductosTienda(productosTienda);
      const categorias = Object.values(
        prods.reduce((acum, prod) => {
          acum[prod.producto.categoria.id] = prod.producto.categoria;
          return acum;
        }, {}) as ICategory[]
      ).sort((a: ICategory, b: ICategory) => {
        return a.nombre.localeCompare(b.nombre);
      });
      setCategories(categorias);
    } catch (error) {
      console.error("Error al obtener productos", error);
      if (!silent) showMessage("Error al obtener productos", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const incrementarCantidades = (id: string, cantidad: number) => {
    const productIndex = productosTienda.findIndex(p => p.id === id);
    if (productIndex !== -1) {
      const newProds = [...productosTienda];
      newProds[productIndex] = {
        ...newProds[productIndex],
        existencia: newProds[productIndex].existencia + cantidad
      };
      setProductosTienda(newProds);
    }

    // const productosTiendaEditados = productosTienda.map(p => {
    //   if (p.id === id) {
    //     return { ...p, existencia: p.existencia + cantidad };
    //   }
    //   return p;
    // });
    // setProductosTienda(productosTiendaEditados);
  }



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
    totalTransfer: number,
    transferDestinationId?: string
  ) => {
    try {
      if (total <= totalCash + totalTransfer) {
        const tiendaId = user.localActual.id;
        const cierreId = periodo.id;
        const identifier = crypto.randomUUID();

        console.log('🔍 [handleMakePay] Preparando datos de venta:', {
          tiendaId,
          cierreId,
          usuarioId: user.id,
          total,
          totalCash,
          totalTransfer,
          identifier,
          ...(totalTransfer > 0 && { transferDestinationId })
        });

        const data = cart.map((prod) => {
          const productoEnTienda = productosTienda.find(p => p.id === prod.productoTiendaId);
          if (!productoEnTienda) {
            throw new Error(`Producto no encontrado en la tienda: ${prod.name}`);
          }
          return {
            cantidad: prod.quantity,
            productoTiendaId: prod.productoTiendaId,
            productId: productoEnTienda.productoId,
            name: prod.name,
            price: prod.price,
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
          // 🆕 NUEVOS CAMPOS
          createdAt: Date.now(), // Timestamp exacto de creación
          wasOffline: !isOnline, // Si se creó sin conexión
          syncAttempts: 0, // Inicializar contador
          ...(totalTransfer > 0 && { transferDestinationId })
        });

        // 3. Actualizar inventario local
        const newProds = productosTienda.map((p) => {
          const cartProd = cart.find((cartItem) => cartItem.productoTiendaId === p.id);
          if (cartProd) {
            return { ...p, existencia: p.existencia - cartProd.quantity }
          } else {
            return p;
          }
        });
        setProductosTienda(newProds);

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
              identifier,
              transferDestinationId,
              Date.now(), // 🆕 Timestamp actual
              !isOnline, // 🆕 Estado offline
              1 // 🆕 Primer intento exitoso
            );
            console.log('🔍 [handleMakePay] Respuesta del backend:', ventaDb);
            markSynced(identifier, ventaDb.id);
            showMessage("✅ Venta procesada y sincronizada exitosamente", "success");
          } catch (syncError) {
            console.log('🔍 [handleMakePay] Error de sincronización:', syncError);

            // Manejo mejorado de errores de sincronización
            if (syncError.message?.includes('TIMEOUT_ERROR')) {
              showMessage("📱 Venta guardada localmente. Timeout en sincronización - se reintentará automáticamente.", "warning");
            } else if (syncError.message?.includes('NETWORK_ERROR')) {
              showMessage("📱 Venta guardada localmente. Error de red - se sincronizará cuando haya conexión.", "warning");
            } else if (syncError.message?.includes('SERVER_ERROR')) {
              showMessage("📱 Venta guardada localmente. Error del servidor - se reintentará automáticamente.", "warning");
            } else if (syncError.message?.includes('CLIENT_ERROR')) {
              showMessage("📱 Venta guardada localmente. Error en los datos - contacte al administrador.", "error");
            } else if (syncError.message?.includes('Existencia insuficiente')) {
              showMessage("❌ Error: No hay suficiente stock para completar la venta. Verifique el inventario.", "error");
              // Marcar como error permanente para evitar reintentos
              markSyncError(identifier);
            } else if (syncError.response?.status === 400 &&
              syncError.response?.data?.error?.includes("fuera del período actual")) {
              showMessage("❌ Error crítico: La venta no se puede sincronizar porque pertenece a un período anterior. Contacte al administrador.", "error");
              // Marcar como error permanente para evitar reintentos
              markSyncError(identifier);
            } else {
              showMessage("📱 Venta guardada localmente. Se sincronizará automáticamente.", "info");
            }
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
  const handleUpdateQuantity = (id: string, quantity: number) => {
    const oldQuantity = cart.find(item => item.productoTiendaId === id)?.quantity || 0;
    if (oldQuantity < quantity) {
      const productoTienda = productosTienda.find(p => p.id === id);
      // Si el producto tiene unidades por fracción, se usa ese valor.
      // Si si no son productos con fracción se debe verificar que ese producto no esté ya en el carrito,
      // si no está en el carrito la cantidad maxima seria igual a la existencia del producto.
      // si está en el carrito la cantidad maxima seria igual a la existencia del producto menos la cantidad de productos en el carrito.

      let maxQuantity = 0;

      const cartQuantity = cart.find(item => item.productoTiendaId === productoTienda.id)?.quantity || 0;

      if (cartQuantity > 0) {
        maxQuantity = productoTienda.producto.unidadesPorFraccion
          ? productoTienda.producto.unidadesPorFraccion - 1
          : productoTienda.existencia;
      }
      if (quantity > maxQuantity) {
        return;
      }
    }

    updateQuantity(id, quantity);
  };

  const handleShowSyncView = () => {
    setShowSyncView(true);
  };

  const handleShowUserSales = () => {
    setShowUserSales(true);
    setOpenSpeedDial(false);
  };

  const handleCloseSyncView = () => {
    setShowSyncView(false);
    setOpenSpeedDial(false);
  };
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim() === "") {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    const filtered = productosTienda.filter((product) =>
      product.producto.nombre.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(filtered.slice(0, 10)); // Limitar a 10 resultados
    setShowSearchResults(true);
  };

  const handleProductSelect = (product: IProductoTiendaV2) => {
    setSelectedProduct(product);
    setProductOrigin('search'); // Marcar como selección manual
    setShowSearchResults(false);
    setSearchQuery("");
  };

  const handleResetProductQuantity = () => {
    setSelectedProduct(null);
    setProductOrigin(null); // Limpiar origen al cancelar
  };

  const handleConfirmQuantity = () => {
    setSelectedProduct(null);
    setOpenCart(true);
  };

  const handleSearchFocus = () => {
    if (searchQuery.length > 0) {
      setShowSearchResults(true);
    }
    setIntentToSearch(true);
  };

  const handleSearchMouseDown = () => {
    // Establecer la intención de búsqueda ANTES del evento de foco
    // para que el escáner no robe el foco
    setIntentToSearch(true);
  };

  const handleSearchBlur = () => {
    // Delay para permitir que los clicks en los resultados funcionen
    setTimeout(() => {
      setIntentToSearch(false);
      setShowSearchResults(false);
    }, 150);
  };

  // Sincronización automática cuando regresa la conexión
  useEffect(() => {
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

  // Verificación periódica de timeouts de sincronización
  useEffect(() => {
    const timeoutCheckInterval = setInterval(() => {
      checkSyncTimeouts();
    }, 10000); // Verificar cada 10 segundos

    return () => clearInterval(timeoutCheckInterval);
  }, [checkSyncTimeouts]);

  // useEffect de carga de datos iniciales
  useEffect(() => {
    (async () => {
      if (!loadingContext) {
        // Validar que el usuario tenga una tienda actual
        if (!user.localActual || !user.localActual.id) {
          setNoLocalActual(true);
          setLoading(false);
          return;
        }
        try {

          const data = await fetchTransferDestinations(user.localActual.id);;
          setTransferDestinations(data);

          const lastPeriod = await fetchLastPeriod(user.localActual.id);
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
                openPeriod(user.localActual.id).then((newPeriod) => {
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

  // Activar audio context cuando se carga la página
  useEffect(() => {
    audioService.resumeAudioContext();
  }, []);

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


  if (loadingContext || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }
  if (noLocalActual) {
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
    <Box p={0} display={'flex'} flexDirection={'row'} sx={{ height: '100vh', overflow: 'hidden' }}>
      <Box sx={{
        flex: isCartPinned ? '1' : 'none',
        width: getMainContentWidth(),
        overflow: 'auto',
        height: '100vh',
        p: 0
      }}>


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
                Período: {formatDate(periodo.fechaInicio)}
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

        {/* --- SCANNERS ABOVE CATEGORIES (ONE LINE, FULL WIDTH) --- */}
        <Box sx={{ mb: 1, width: '100%' }}>
          <ProductProcessorData
            ref={scannerRef}
            onProcessedData={(data: IProcessedData) => {
              if (data?.code) handleProductScan(data.code);
            }}
            onHardwareScan={handleHardwareScan}
            keepFocus={intentToSearch || paymentDialog || showSyncView || openSpeedDial ? false : true}
          />
          {scannerError && (
            <Alert severity="warning" onClose={() => setScannerError(null)} sx={{ mt: 1 }}>{scannerError}</Alert>
          )}
        </Box>

        {/* Contenido principal */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: isCartPinned ? {
              xs: "repeat(2, 1fr)",
              sm: "repeat(2, 1fr)",
              md: "repeat(3, 1fr)",
              lg: "repeat(4, 1fr)",
            } : {
              xs: "repeat(2, 1fr)",
              sm: "repeat(3, 1fr)",
              md: "repeat(4, 1fr)",
              lg: "repeat(5, 1fr)",
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
                    fontSize: isCartPinned ?
                      { xs: "0.7rem", sm: "0.8rem", md: "1rem", lg: "1.25rem" } :
                      { xs: "1.25rem", sm: "1.5rem" },
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
            productosTienda={productosTienda.filter(
              (p) => p.producto.categoria.id === selectedCategory.id
            )}
            category={selectedCategory}
            closeModal={() => setShowProducts(false)}
            openCart={() => setOpenCart(true)}
          />
        )}

        {/* Carrito de compras */}
        <CartDrawer
          cart={cart}
          onClose={() => setOpenCart(false)}
          open={!isCartPinned && openCart}
          onOkButtonClick={async () => setPaymentDialog(true)}
          total={total}
          clear={clearCart}
          removeItem={removeFromCart}
          updateQuantity={handleUpdateQuantity}
          isCartPinned={isCartPinned}
          setIsCartPinned={setIsCartPinned}
        />

        {/* Modal de pago */}
        <PaymentModal
          open={paymentDialog}
          onClose={() => setPaymentDialog(false)}
          total={total}
          makePay={(total: number, totalchash: number, totaltransfer: number, transferDestinationId?: string) =>
            handleMakePay(total, totalchash, totaltransfer, transferDestinationId)
          }
          transferDestinations={transferDestinations}
        />

        {/* Drawer de ventas del usuario */}
        <UserSalesDrawer
          showUserSales={showUserSales}
          setShowUserSales={setShowUserSales}
        />

        {/* Drawer de ventas y sincronización  */}
        <SalesDrawer
          showSales={showSyncView}
          handleClose={() => handleCloseSyncView()}
          period={periodo}
          reloadProdsAndCategories={() => fetchProductosAndCategories(true)}
          incrementarCantidades={incrementarCantidades}
        />

        {/* Botón de sincronización */}
        {productos.length > 0 && (
          <SpeedDial
            ariaLabel="Offline mode"
            sx={{ position: "fixed", top: 80, right: 16 }}
            icon={<BlurOnIcon />}
            direction="down"
            open={openSpeedDial}
            onClick={() => setOpenSpeedDial(!openSpeedDial)}
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
              key={"user-sales"}
              icon={<CancelPresentationIcon />}
              slotProps={{
                tooltip: {
                  title: "Mis ventas",
                  open: true,
                },
              }}
              onClick={handleShowUserSales}
            />
          </SpeedDial>
        )}

        {/* Botón de carrito */}
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
            // onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
            onFocus={() => handleSearchFocus()}
            onBlur={() => handleSearchBlur()}
            onMouseDown={() => handleSearchMouseDown()}
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
                      setIntentToSearch(false); // Permitir que el escáner recupere el foco
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
                      onMouseDown={(e) => {
                        // Prevenir que el onBlur del input se ejecute antes del onClick
                        e.preventDefault();
                      }}
                      onClick={() => {
                        handleProductSelect(product);
                        // Asegurar que el foco regrese al escáner después de seleccionar
                        setIntentToSearch(false);
                      }}
                      sx={{
                        borderBottom: "1px solid rgba(0,0,0,0.05)",
                        "&:hover": {
                          bgcolor: "rgba(0,0,0,0.04)",
                        },
                      }}
                    >
                      <ListItemText
                        primary={product.producto.nombre}
                        secondary={`$${product.precio} - ${product.existencia} disponibles`}
                        primaryTypographyProps={{
                          sx: {
                            fontWeight: product.producto.nombre.toLowerCase().startsWith(searchQuery.toLowerCase())
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

        {/* Dialog de cantidad */}
        <QuantityDialog
          productoTienda={selectedProduct}
          onClose={handleResetProductQuantity}
          onConfirm={handleConfirmQuantity}
          onAddToCart={reopenScannerIfNeeded}
        />
        {ConfirmDialogComponent}
      </Box>

      {isCartPinned &&
        <Box sx={{
          width: getCartWidth(),
          maxWidth: getCartWidth(),
          minWidth: '360px',
          height: '100vh',
          overflow: 'hidden',
          borderLeft: '1px solid rgba(0,0,0,0.1)',
          backgroundColor: 'background.paper'
        }}>
          <CartContent
            cart={cart}
            total={total}
            clear={clearCart}
            updateQuantity={handleUpdateQuantity}
            onClose={() => setOpenCart(false)}
            removeItem={removeFromCart}
            onOkButtonClick={async () => setPaymentDialog(true)}
            isCartPinned={isCartPinned}
            setIsCartPinned={setIsCartPinned}
          />
        </Box>
      }
    </Box>
  );
}