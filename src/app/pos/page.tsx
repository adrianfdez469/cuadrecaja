"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Typography,
  CircularProgress,
  Box,
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
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  Chip,
  Stack, Grid2 as Grid,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import EditIcon from "@mui/icons-material/Edit";

import { useCartStore } from "@/store/cartStore";
import { getProductosVenta } from "@/services/costoPrecioServices";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { ProductModal } from "./components/ProductModal";
import { ICategory } from "@/schemas/categoria";
import { IProductoTiendaV2 } from "@/schemas/producto";
import CartDrawer from "@/components/cartDrawer/CartDrawer";
import PaymentModal from "./components/PaymentModal";
import { fetchLastPeriod, openPeriod } from "@/services/cierrePeriodService";
import { ICierrePeriodo } from "@/schemas/cierre";
import useConfirmDialog from "@/components/confirmDialog";
import { createSell } from "@/services/sellService";
import { useSalesStore } from "@/store/salesStore";

import { SalesDrawer } from "./components/SalesDrawer";
import { UserSalesDrawer } from "./components/UserSalesDrawer";

import { QuantityDialog } from "./components/QuantityDialog";
import { ProductQuickActions } from "./components/ProductQuickActions";
import { calcularDisponibilidadReal } from "./utils/calcularDisponibilidadReal";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useBlockBackNavigation } from "@/hooks/useBlockBackNavigation";

import ProductProcessorData from '@/components/ProductProcessorData/ProductProcessorData';

import { IProcessedData } from "@/schemas/processedData";
import { ITransferDestination } from "@/schemas/transferDestination";
import { fetchTransferDestinations } from "@/services/transferDestinationsService";
import { CartContent } from "@/components/cartDrawer/components/cartContent";
import { ProductProcessorDataRef } from "@/components/ProductProcessorData/ProductProcessorData";
import audioService from "@/utils/audioService";
import { normalizeSearch } from "@/utils/formatters";
import ShoppingCartComponent from "@/app/pos/components/ShoppingCartComponent";
import PosStatusToolBar from "@/app/pos/components/SyncButton";
import ConnectionStatus from "@/app/pos/components/ConnectionStatus";
import PeriodoBadge from "@/app/pos/components/PeriodoBadge";
import RefreshButton from "@/app/pos/components/RefreshButton";
import ResumenDiaModal from "@/app/pos/components/ResumenDiaModal";
import FlagIcon from "@mui/icons-material/Flag";
import { AsociarCodigoDialog } from "@/app/pos/components/AsociarCodigoDialog";
import { usePermisos } from "@/utils/permisos_front";

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
  const { sales, addSale, markSynced, markSyncing, checkSyncTimeouts, markSyncError } = useSalesStore();
  const [showUserSales, setShowUserSales] = useState(false);
  const [showSyncView, setShowSyncView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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
    carts,
    activeCartId,
    createCart,
    setActiveCart,
    renameCart,
    removeActiveCart,
    items,
  } = useCartStore();
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkStatus();
  useBlockBackNavigation();
  const [transferDestinations, setTransferDestinations] = useState<ITransferDestination[]>([]);
  const [intentToSearch, setIntentToSearch] = useState(false);
  const [openSpeedDial, setOpenSpeedDial] = useState(false);
  const [resumenDiaOpen, setResumenDiaOpen] = useState(false);
  // Edición de nombre de carrito (píldora)
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editingCartName, setEditingCartName] = useState<string>("");
  // Ref del input de edición para forzar foco en móviles
  const editCartInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editingCartId) {
      // Forzar foco de forma robusta tras renderizar el TextField
      const focusLater = () => {
        const el = editCartInputRef.current;
        if (el) {
          try {
            el.focus({ preventScroll: true } as FocusOptions);
          } catch {
            try {
              el.focus();
            } catch {
            }
          }
          // Seleccionar el texto para facilitar la edición
          try {
            el.select();
          } catch {
          }
        }
      };
      const raf = requestAnimationFrame(() => setTimeout(focusLater, 0));
      return () => cancelAnimationFrame(raf);
    }
  }, [editingCartId]);

  // Referencia al scanner para poder reabrirlo
  const scannerRef = useRef<ProductProcessorDataRef>(null);

  // Estado para prevenir múltiples sincronizaciones simultáneas (no para pagos)
  const [syncingIdentifiers, setSyncingIdentifiers] = useState<Set<string>>(new Set());

  // Estado para el scanner
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Estado para rastrear el origen del producto seleccionado
  const [productOrigin, setProductOrigin] = useState<'camera' | 'search' | 'hardware' | null>(null);

  const [isCartPinned, setIsCartPinned] = useState(false);

  const { verificarPermiso } = usePermisos();
  const puedeAsociarCodigo = verificarPermiso("operaciones.pos-venta.asociar_codigo");

  const [asociarCodigoOpen, setAsociarCodigoOpen] = useState(false);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string>("");

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
          productoTiendaId: product.id,
          fechaVencimiento: product.fechaVencimiento ?? null,
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
        audioService.playErrorSound();
        if (puedeAsociarCodigo) {
          setCodigoNoEncontrado(data.code);
          setAsociarCodigoOpen(true);
          setScannerError(null);
        } else {
          setScannerError('Producto no encontrado para el código escaneado');
        }
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

  const getCartQuantity = (productoTiendaId: string) => {
    return items.find(item => item.productoTiendaId === productoTiendaId)?.quantity || 0;
  }

  function getSecondaryTextForSearchedProducts(product: IProductoTiendaV2) {
    const cartQty = getCartQuantity(product.id);
    const { maxPorTransaccion, esFraccion } = calcularDisponibilidadReal(product, productosTienda);

    const disponible = maxPorTransaccion - cartQty;

    if (esFraccion) {
      // Para productos fracción: mostrar existencia real + máximo por venta
      const existenciaReal = Math.max(0, product.existencia || 0);
      return `Stock: ${existenciaReal} | Máx: ${disponible > 0 ? disponible : 0}`;
    } else {
      return `Cant: ${disponible > 0 ? disponible : 0}`;
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
      audioService.playErrorSound();
      if (puedeAsociarCodigo) {
        setCodigoNoEncontrado(code);
        setAsociarCodigoOpen(true);
        setScannerError(null);
      } else {
        setScannerError('Producto no encontrado para el código escaneado');
      }
    }
  }

  const syncPendingSales = async () => {

    const salesNotSynced = sales.filter((sale) =>
      sale.syncState === "not_synced" && !syncingIdentifiers.has(sale.identifier)
    );

    if (salesNotSynced.length === 0) return;

    showMessage(`Sincronizando ${salesNotSynced.length} ventas...`, "info");

    // Marcar como "sincronizando" para evitar duplicados
    const newSyncingIds = new Set(syncingIdentifiers);
    salesNotSynced.forEach(sale => newSyncingIds.add(sale.identifier));
    setSyncingIdentifiers(newSyncingIds);

    let syncedCount = 0;
    let errorCount = 0;

    for (const sale of salesNotSynced) {
      try {
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
          sale.syncAttempts, // 🆕 Enviar intentos de sincronización
          sale.discountCodes // 🆕 Reenviar códigos de descuento si existen
        );
        markSynced(sale.identifier, ventaDb.id);
        syncedCount++;
      } catch (error) {
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

  const handleRefresh = async () => {
    await fetchProductosAndCategories(true);
    const lastPeriod = await fetchLastPeriod(user.localActual.id);
    if (lastPeriod && !lastPeriod.fechaFin) {
      setPeriodo(lastPeriod);
    }
  };

  const fetchProductosAndCategories = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      const rawProductos = await getProductosVenta(user.localActual.id, { incluseCategories: true });
      const prods = rawProductos
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
              const pPadre = rawProductos.find(
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
    transferDestinationId?: string,
    discountCodes?: string[]
  ) => {
    try {
      if (total <= totalCash + totalTransfer) {
        const tiendaId = user.localActual.id;
        const cierreId = periodo.id;
        const identifier = crypto.randomUUID();

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


        const cash = total - totalTransfer;

        // 1. INMEDIATAMENTE: Eliminar carrito activo (y su píldora), cerrar modal y drawer
        removeActiveCart();
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
          ...(totalTransfer > 0 && { transferDestinationId }),
          // Guardar los códigos para sincronización (tipado correcto)
          ...(discountCodes && discountCodes.length > 0 ? { discountCodes } : {})
        });

        // 3. Actualizar inventario local (incluyendo desagregaciones)
        // Primero, identificar qué productos necesitan desagregación
        const desagregaciones: {
          padreProductoId: string;
          cantidad: number;
          hijoId: string;
          unidadesPorFraccion: number
        }[] = [];

        cart.forEach((cartProd) => {
          const productoEnTienda = productosTienda.find(p => p.id === cartProd.productoTiendaId);
          if (productoEnTienda && productoEnTienda.producto.fraccionDeId) {
            // Es un producto fracción
            if (productoEnTienda.existencia < cartProd.quantity) {
              // Necesita desagregación
              desagregaciones.push({
                padreProductoId: productoEnTienda.producto.fraccionDeId,
                cantidad: 1, // Siempre desagrega 1 unidad del padre
                hijoId: productoEnTienda.id,
                unidadesPorFraccion: productoEnTienda.producto.unidadesPorFraccion || 0
              });
            }
          }
        });

        const newProds = productosTienda.map((p) => {
          let nuevaExistencia = p.existencia;

          // Verificar si este producto es padre de alguna desagregación
          const desagregacionPadre = desagregaciones.find(d => d.padreProductoId === p.productoId);
          if (desagregacionPadre) {
            // Restar 1 del producto padre
            nuevaExistencia -= desagregacionPadre.cantidad;
          }

          // Verificar si este producto es hijo de alguna desagregación
          const desagregacionHijo = desagregaciones.find(d => d.hijoId === p.id);
          if (desagregacionHijo) {
            // Sumar las unidades por fracción
            nuevaExistencia += desagregacionHijo.unidadesPorFraccion;
          }

          // Verificar si este producto está en el carrito (venta)
          const cartProd = cart.find((cartItem) => cartItem.productoTiendaId === p.id);
          if (cartProd) {
            // Restar la cantidad vendida
            nuevaExistencia -= cartProd.quantity;
          }

          return { ...p, existencia: nuevaExistencia };
        });
        setProductosTienda(newProds);

        // 4. Mostrar notificación inicial (solo una)
        showMessage("💳 Procesando venta...", "info");

        // 5. Intentar sincronizar con el backend si estamos online
        if (isOnline) {
          try {
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
              1, // 🆕 Primer intento exitoso
              discountCodes
            );
            markSynced(identifier, ventaDb.id);
            showMessage("✅ Venta procesada y sincronizada exitosamente", "success");
          } catch (syncError) {
            console.error(syncError);

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
      console.error(error);
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
      if (!productoTienda) return;

      // Si el producto tiene unidades por fracción, se usa ese valor.
      // Si no son productos con fracción se debe verificar que ese producto no esté ya en el carrito,
      // si no está en el carrito la cantidad maxima seria igual a la existencia del producto.
      // si está en el carrito la cantidad maxima seria igual a la existencia del producto menos la cantidad de productos en el carrito.

      // Calcular el máximo permitido para este producto
      const maxQuantity = productoTienda.producto.unidadesPorFraccion
        ? productoTienda.producto.unidadesPorFraccion - 1
        : productoTienda.existencia;

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
    setShowSearchResults(query.trim() !== "");
  };

  const searchResults = useMemo(() => {
    if (searchQuery.trim() === "") return [];
    return productosTienda
      .filter((p) => normalizeSearch(p.producto.nombre).includes(normalizeSearch(searchQuery)))
      .slice(0, 10);
  }, [productosTienda, searchQuery]);

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

          const data = await fetchTransferDestinations(user.localActual.id);
          ;
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
                gotToPath("/home");
              }
            );
          } else {
            setPeriodo(lastPeriod);
          }
        } catch (error) {
          console.error(error);
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
      fetchProductosAndCategories().catch(() => {
        showMessage(
          "Ocurrió un error intentando cargar las categorías",
          "error"
        );
      });
    }
  }, [periodo]);


  const handleCodigoAsociado = (producto: IProductoTiendaV2, codigoNuevo: string) => {
    // Actualizar el estado local para que el nuevo código quede indexado
    setProductosTienda(prev =>
      prev.map(p =>
        p.id === producto.id
          ? {
              ...p,
              producto: {
                ...p.producto,
                codigosProducto: [
                  ...(p.producto.codigosProducto || []),
                  { id: codigoNuevo, codigo: codigoNuevo, productoId: p.productoId },
                ],
              },
            }
          : p
      )
    );
    showMessage(`✅ Código asociado a "${producto.producto.nombre}"`, "success");
    audioService.playSuccessSound();
    // Seleccionar el producto para que el vendedor pueda agregarlo al carrito
    setSelectedProduct(producto);
    setProductOrigin('hardware');
  };

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
    <Box p={0} display={'flex'} flexDirection={'row'} sx={{ height: { xs: "calc(100vh - 56px)", sm: "calc(100vh - 64px)" }, overflow: 'hidden' }}>
      <Box sx={{
        flex: isCartPinned ? '1' : 'none',
        width: getMainContentWidth(),
        overflow: 'auto',
        height: '100%', // Use parent height
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

          <PeriodoBadge periodo={periodo} isMobile={isMobile} />

          <Box display="flex" flexDirection="row" justifyContent="center" alignItems="center">
            <RefreshButton onRefresh={handleRefresh} />
            <Tooltip title="Punto de partida">
              <IconButton size="small" onClick={() => setResumenDiaOpen(true)}>
                <FlagIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <PosStatusToolBar handleShowSyncView={handleShowSyncView} handleShowUserSales={handleShowUserSales} />
            <ConnectionStatus isOnline={isOnline} />
          </Box>

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
            p: 1,
            width: "100%",
            maxWidth: "1400px",
            pb: "120px",
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
        {selectedCategory && !openCart && (
          <ProductModal
            open={showProducts}
            productosTienda={productosTienda.filter(
              (p) => p.producto.categoria.id === selectedCategory.id
            )}
            allProductosTienda={productosTienda}
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
          makePay={(total: number, totalchash: number, totaltransfer: number, transferDestinationId?: string, discountCodes?: string[]) =>
            handleMakePay(total, totalchash, totaltransfer, transferDestinationId, discountCodes)
          }
          transferDestinations={transferDestinations}
          tiendaId={user.localActual.id}
          products={cart.map((prod) => ({
            productoTiendaId: prod.productoTiendaId,
            cantidad: prod.quantity,
            precio: prod.price
          }))}
        />

        {/* Modal de resumen del período */}
        <ResumenDiaModal
          open={resumenDiaOpen}
          onClose={() => setResumenDiaOpen(false)}
          tiendaId={user.localActual.id}
          cierreId={periodo?.id ?? ""}
        />

        {/* Drawer de ventas del usuario */}
        <UserSalesDrawer
          showUserSales={showUserSales}
          setShowUserSales={setShowUserSales}
          period={periodo}
          incrementarCantidades={incrementarCantidades}
          transferDestinations={transferDestinations}
        />

        {/* Drawer de ventas y sincronización  */}
        <SalesDrawer
          showSales={showSyncView}
          handleClose={() => handleCloseSyncView()}
          period={periodo}
          reloadProdsAndCategories={() => fetchProductosAndCategories(true)}
          incrementarCantidades={incrementarCantidades}
        />

        <ShoppingCartComponent openCart={openCart} handleCartIcon={handleCartIcon} />

        <Box
          ref={searchAnchorRef}
          sx={{
            m: 0,
            position: "fixed",
            bottom: 60,
            left: 0,
            right: 0,
            p: 1,
            zIndex: 1200,
            background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
            backdropFilter: "blur(10px)",
            borderTop: "1px solid rgba(0,0,0,0.1)",
            boxShadow: "0 -2px 1px rgba(0,0,0,0.1)",
          }}
        >
          {/* Píldoras de carritos */}
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
            {carts.map((c) => (
              <Box key={c.id} sx={{ display: 'flex', alignItems: 'center' }}>
                {editingCartId === c.id ? (
                  <TextField
                    size="small"
                    value={editingCartName}
                    autoFocus
                    inputRef={editCartInputRef}
                    onChange={(e) => setEditingCartName(e.target.value)}
                    onBlur={() => {
                      if (editingCartId) {
                        const newName = (editingCartName || '').trim() || c.name;
                        renameCart(editingCartId, newName);
                      }
                      setEditingCartId(null);
                    }}
                    onKeyDown={(e) => {
                      const key = e.key;
                      // Evitar interferencia de IME y de manejadores globales
                      const composing = e?.nativeEvent?.isComposing ?? false;
                      if (!composing && (key === 'Enter' || key === 'NumpadEnter')) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (editingCartId) {
                          const newName = (editingCartName || '').trim() || c.name;
                          renameCart(editingCartId, newName);
                        }
                        setEditingCartId(null);
                      } else if (key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingCartId(null);
                      }
                    }}
                    InputProps={{
                      inputProps: {
                        inputMode: 'text',
                        autoComplete: 'off',
                        autoCorrect: 'off',
                        autoCapitalize: 'off',
                        spellCheck: false,
                      }
                    }}
                    sx={{ minWidth: 140 }}
                  />
                ) : (
                  <Chip
                    tabIndex={-1}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</Box>
                        <IconButton
                          aria-label="Editar nombre"
                          size="small"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setEditingCartId(c.id);
                            setEditingCartName(c.name);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onTouchStart={(e) => {
                            e.stopPropagation();
                          }}
                          onTouchEnd={(e) => {
                            e.stopPropagation();
                          }}
                          onTouchMove={(e) => {
                            e.stopPropagation();
                          }}
                          edge="end"
                          sx={{ p: 0.25 }}
                        >
                          <EditIcon fontSize="inherit" />
                        </IconButton>
                      </Box>
                    }
                    color={c.id === activeCartId ? 'primary' : 'default'}
                    variant={c.id === activeCartId ? 'filled' : 'outlined'}
                    onClick={() => setActiveCart(c.id)}
                    onDelete={() => {
                      if (carts.length <= 1) return; // mantener al menos uno
                      if (c.id !== activeCartId) {
                        setActiveCart(c.id);
                      }
                      removeActiveCart();
                    }}
                    sx={{
                      cursor: 'pointer',
                      '& .MuiChip-label': { maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' },
                    }}
                  />
                )}
              </Box>
            ))}
            <Chip
              label="Nueva cuenta"
              variant="outlined"
              onClick={() => createCart()}
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
        </Box>

        {/* Buscador flotante */
        }
        <Box
          ref={searchAnchorRef}
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            p: 1,
            zIndex: 1200,
            background: "linear-gradient(to top, rgba(255,255,255,1) 0%, rgba(255,255,255,0.9) 100%)",
            backdropFilter: "blur(10px)",
          }}
        >
          <Stack direction="row" spacing={1}>
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
            <Grid size={{ xs: 7, sm: 10 }}>
              <ProductProcessorData
                  ref={scannerRef}
                  onProcessedData={(data: IProcessedData) => {
                    if (data?.code) handleProductScan(data.code);
                  }}
                  onHardwareScan={handleHardwareScan}
                  keepFocus={editingCartId ? false : !(intentToSearch || paymentDialog || showSyncView || openSpeedDial || resumenDiaOpen)}
              />
              {scannerError && (
                  <Alert severity="warning" onClose={() => setScannerError(null)} sx={{ mt: 1 }}>{scannerError}</Alert>
              )}
            </Grid>
          </Stack>
        </Box>

        {/* Popper para resultados de búsqueda */
        }
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
                tether: false,
                rootBoundary: "viewport",
                padding: isMobile ? 8 : 0,
              },
            },
            {
              name: "flip",
              enabled: false, // Desactivar flip para mantener siempre arriba
            },
            {
              name: "offset",
              options: {
                offset: [0, isMobile ? -8 : -8], // Offset adicional en móviles
              },
            },
          ]}
          sx={{ zIndex: 1300 }}
        >
          {({ TransitionProps }) => (
            <Fade {...TransitionProps} timeout={200}>
              <MuiPaper
                elevation={3}
                onMouseDown={(e) => e.preventDefault()}
                sx={{
                  width: "100%",
                  maxHeight: isMobile ? "40vh" : "70vh", // Reducir altura máxima en móviles
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
                    <ListItem
                      key={product.id}
                      disablePadding
                      sx={{
                        borderBottom: "1px solid rgba(0,0,0,0.05)",
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      <Box
                        sx={{
                          flexShrink: 0,
                          pr: 1,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <ProductQuickActions
                          productoTienda={product}
                          allProductosTienda={productosTienda}
                        />
                      </Box>
                      <ListItemButton
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          handleProductSelect(product);
                          setIntentToSearch(false);
                        }}
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          "&:hover": {
                            bgcolor: "rgba(0,0,0,0.04)",
                          },
                        }}
                      >
                        <ListItemText
                          primary={product.producto.nombre}
                          secondary={`$${product.precio} - ${getSecondaryTextForSearchedProducts(product)}`}
                          primaryTypographyProps={{
                            sx: {
                              fontWeight: normalizeSearch(product.producto.nombre)
                                .startsWith(normalizeSearch(searchQuery))
                                ? 600
                                : 400,
                            },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </MuiPaper>
            </Fade>
          )}
        </Popper>

        {/* Dialog de cantidad */
        }
        <QuantityDialog
          productoTienda={selectedProduct}
          onClose={handleResetProductQuantity}
          onConfirm={handleConfirmQuantity}
          onAddToCart={reopenScannerIfNeeded}
          maxDisponibleOverride={selectedProduct ? calcularDisponibilidadReal(selectedProduct, productosTienda).maxPorTransaccion : undefined}
        />
        {
          ConfirmDialogComponent
        }

        <AsociarCodigoDialog
          open={asociarCodigoOpen}
          codigo={codigoNoEncontrado}
          productosTienda={productosTienda}
          onClose={() => setAsociarCodigoOpen(false)}
          onAsociado={handleCodigoAsociado}
        />
      </Box>

      {
        isCartPinned &&
        <Box sx={{
          width: getCartWidth(),
          maxWidth: getCartWidth(),
          minWidth: '360px',
          height: '100%', // Use parent height
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
  )
    ;
}