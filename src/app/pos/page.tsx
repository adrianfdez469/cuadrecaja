"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Typography,
  CircularProgress,
  Box,
  IconButton,
  Alert,
  Button,
  useTheme,
  useMediaQuery,
  Tooltip,
} from "@mui/material";

import { useCartStore } from "@/store/cartStore";
import { getProductosVenta } from "@/services/costoPrecioServices";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { CategoryPillsBar } from "./components/CategoryPillsBar";
import { PosProductGrid } from "./components/PosProductGrid";
import { CheckoutLockOverlay } from "./components/CheckoutLockOverlay";
import { ICategory } from "@/schemas/categoria";
import { IProductoTiendaV2 } from "@/schemas/producto";
import CartDrawer from "@/components/cartDrawer/CartDrawer";
import { fetchLastPeriod, openPeriod } from "@/services/cierrePeriodService";
import { ICierrePeriodo } from "@/schemas/cierre";
import type { IMultimonedaExtras } from "@/schemas/pago";
import useConfirmDialog from "@/components/confirmDialog";
import { createSell } from "@/services/sellService";
import { useSalesStore } from "@/store/salesStore";

import { SalesDrawer } from "./components/SalesDrawer";
import { UserSalesDrawer } from "./components/UserSalesDrawer";

import { QuantityDialog } from "./components/QuantityDialog";
import { PosBottomBar } from "./components/PosBottomBar";
import { calcularDisponibilidadReal } from "./utils/calcularDisponibilidadReal";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { useOnScreenKeyboard } from "@/hooks/useOnScreenKeyboard";
import { useBlockBackNavigation } from "@/hooks/useBlockBackNavigation";
import { useCartTotal } from "@/hooks/useCartTotal";
import { convertToBase } from "@/lib/currency";

import { IProcessedData } from "@/schemas/processedData";
import { ITransferDestination } from "@/schemas/transferDestination";
import { fetchTransferDestinations } from "@/services/transferDestinationsService";
import {
  CartContent,
  type CartStep,
} from "@/components/cartDrawer/components/cartContent";
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
import UndoIcon from "@mui/icons-material/Undo";
import { DevolucionVentaDialog } from "@/components/GestionInventario/movimientos/DevolucionVentaDialog";
import { AsociarCodigoDialog } from "@/app/pos/components/AsociarCodigoDialog";
import { usePermisos } from "@/utils/permisos_front";
import { useHardwareScanner } from "@/hooks/useHardwareScanner";
import { processClientDataFromQR } from "@/utils/scanner";
import { useOnboardingStore } from "@/features/onboarding/store/onboardingStore";
import {
  ONBOARDING_PROMPT_POS_PERIOD_EVENT,
  TOUR_POS_VENTA,
} from "@/features/onboarding/constants";
import {
  shouldDeferPosPeriodPrompt,
  shouldDeferPosBackgroundOperations,
} from "@/features/onboarding/utils/posOnboardingPeriod";
import {
  isPosTopToolbarTourTarget,
  scrollPosTourTargetIntoView,
} from "@/features/onboarding/utils/onboardingNavigation";
import { getTourById } from "@/features/onboarding/tours/primerosPasos";
import { usePrintOnSale } from "@/features/printing/hooks/usePrintOnSale";
import {
  usePrintContext,
  usePrinter,
} from "@/features/printing/hooks/usePrinter";
import { PrintQueueIndicator } from "@/features/printing/components/PrintQueueIndicator";
import { PrinterSetupSheet } from "@/features/printing/components/PrinterSetupSheet";
import { Sale } from "@/store/salesStore";

export default function POSInterface() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [productosTienda, setProductosTienda] = useState<IProductoTiendaV2[]>(
    [],
  );
  const [openCart, setOpenCart] = useState(false);
  const [periodo, setPeriodo] = useState<ICierrePeriodo>();
  const [noLocalActual, setNoLocalActual] = useState(false);
  const { user, loadingContext, gotToPath, tasasVigentes, monedaBase } =
    useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const {
    sales,
    addSale,
    markSynced,
    markSyncing,
    checkSyncTimeouts,
    markSyncError,
  } = useSalesStore();
  const [showUserSales, setShowUserSales] = useState(false);
  const [showSyncView, setShowSyncView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const posScrollRef = useRef<HTMLDivElement>(null);
  // Espacio que la grilla debe reservar abajo para no quedar tapada por
  // PosBottomBar (position:fixed en mobile). Medido en vivo en vez de un
  // número fijo: la altura real de la barra varía según cuántos carritos
  // hay y si se muestra el error del scanner, y un valor fijo dejaba un
  // hueco visible cuando la barra real era más baja que el estimado.
  const [bottomBarHeight, setBottomBarHeight] = useState(150);
  const bottomBarObserverRef = useRef<ResizeObserver | null>(null);
  // Callback ref, no useRef+useEffect: mientras carga, este componente
  // devuelve un spinner y PosBottomBar todavía no existe en el DOM, así
  // que un useEffect de montaje ([]) mediría un ref todavía nulo y nunca
  // volvería a intentarlo. El callback ref se dispara cuando el nodo
  // realmente aparece (o desaparece), sin depender del timing del render.
  const posBottomBarRef = useCallback((el: HTMLDivElement | null) => {
    bottomBarObserverRef.current?.disconnect();
    bottomBarObserverRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBottomBarHeight(entry.contentRect.height);
    });
    observer.observe(el);
    bottomBarObserverRef.current = observer;
  }, []);
  // Cuánto hay que desplazar la cabecera (herramientas + categorías) para
  // sacarla de vista al buscar. Medida en vivo por la misma razón que
  // bottomBarHeight: su alto depende de qué botones tenga el usuario según
  // sus permisos y de cuántas categorías tenga el negocio.
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerObserverRef = useRef<ResizeObserver | null>(null);
  const posHeaderRef = useCallback((el: HTMLDivElement | null) => {
    headerObserverRef.current?.disconnect();
    headerObserverRef.current = null;
    if (!el) return;
    // offsetHeight, no contentRect: estas barras tienen padding propio y
    // bordes, y contentRect los excluye — desplazarlas por ese valor
    // dejaría una franja asomando.
    const observer = new ResizeObserver(() => setHeaderHeight(el.offsetHeight));
    observer.observe(el);
    headerObserverRef.current = observer;
  }, []);
  const [selectedProduct, setSelectedProduct] =
    useState<IProductoTiendaV2 | null>(null);
  const {
    items: cart,
    clearCart,
    removeFromCart,
    updateQuantity,
    carts,
    activeCartId,
    createCart,
    setActiveCart,
    renameCart,
    removeActiveCart,
  } = useCartStore();
  const total = useCartTotal();
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkStatus();
  useBlockBackNavigation();
  const [transferDestinations, setTransferDestinations] = useState<
    ITransferDestination[]
  >([]);
  const [intentToSearch, setIntentToSearch] = useState(false);
  const [resumenDiaOpen, setResumenDiaOpen] = useState(false);
  const [devolucionVentaOpen, setDevolucionVentaOpen] = useState(false);
  // Edición de nombre de carrito (píldora)
  const [editingCartId, setEditingCartId] = useState<string | null>(null);
  const [editingCartName, setEditingCartName] = useState<string>("");
  // Ref del input de edición para forzar foco en móviles
  const editCartInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (editingCartId) {
      // Forzar foco de forma robusta tras renderizar el campo
      const focusLater = () => {
        const el = editCartInputRef.current;
        if (el) {
          try {
            el.focus({ preventScroll: true } as FocusOptions);
          } catch {
            try {
              el.focus();
            } catch {}
          }
          // SelectableTextField selecciona el texto en su propio onFocus.
        }
      };
      const raf = requestAnimationFrame(() => setTimeout(focusLater, 0));
      return () => cancelAnimationFrame(raf);
    }
  }, [editingCartId]);

  // Referencia al scanner para poder reabrirlo
  const scannerRef = useRef<ProductProcessorDataRef>(null);
  const hardwareScanHandlerRef = useRef<(data: IProcessedData) => void>(
    () => {},
  );

  // Estado para prevenir múltiples sincronizaciones simultáneas (no para pagos)
  const [syncingIdentifiers, setSyncingIdentifiers] = useState<Set<string>>(
    new Set(),
  );

  // Estado para el scanner
  const [scannerError, setScannerError] = useState<string | null>(null);

  // Estado para rastrear el origen del producto seleccionado
  const [productOrigin, setProductOrigin] = useState<
    "camera" | "search" | "hardware" | null
  >(null);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const isTablet = useMediaQuery(theme.breakpoints.down("md"));
  // The cart panel needs its own threshold, decoupled from the general
  // "is this a phone" breakpoint (isMobile, 600px): with the panel's
  // minWidth:360px floor (protects the checkout UI's own layout), showing
  // it below ~700px left too little room for the product grid, category
  // pills and search bar. isMobile keeps governing everything else that
  // already used it (text sizes, the hardware scanner, etc.) — this is a
  // narrower, purpose-specific question. Below 700px it falls back to the
  // CartDrawer overlay, same as mobile.
  const showCartPanel = useMediaQuery(theme.breakpoints.up(700));

  // The step of whichever cart is on screen. It lives here, not inside the
  // cart, because the products need both to read it (dimming while a sale is
  // charged) and to write it (touching a product brings the cart back). The
  // mobile drawer only reports into it — it covers the products anyway — but
  // both variants need the hardware scanner out of the way (see
  // scannerEnabled).
  const [cartStep, setCartStep] = useState<CartStep>("cart");
  const checkoutInProgress = cartStep === "checkout";
  const productsLocked = showCartPanel && checkoutInProgress;

  const { keyboardOpen, viewportHeight } = useOnScreenKeyboard();

  // Buscar en el teléfono no oculta nada ni abre ninguna capa: lo único
  // que cambia es que los resultados se apilan hacia arriba, para que el
  // primero quede pegado al campo donde se está escribiendo. Se limita al
  // umbral de 700px de `showCartPanel` — el mismo con el que PosBottomBar
  // decide ser position:fixed — porque arriba de eso no hay teclado en
  // pantalla que justifique invertir nada.
  const searchMode = intentToSearch && !showCartPanel;

  // El teclado abierto es lo único que rompe las coordenadas del layout
  // (ver el comentario del box raíz), así que es lo único que decide si
  // hay que anclar el POS al área visible. Al bajarlo, todo vuelve solo.
  const pinToVisibleArea = searchMode && keyboardOpen && viewportHeight != null;

  // Sin teclado no hay búsqueda. Chrome en Android no dispara `blur` cuando
  // el usuario baja el teclado con el botón del sistema: el campo conserva
  // el foco y el POS se quedaba en modo búsqueda sin forma obvia de salir.
  // El ref evita el falso positivo del arranque, entre el toque en el campo
  // y el momento en que el teclado realmente aparece.
  const keyboardWasOpenRef = useRef(false);
  useEffect(() => {
    if (!searchMode) {
      keyboardWasOpenRef.current = false;
      return;
    }
    if (keyboardOpen) {
      keyboardWasOpenRef.current = true;
      return;
    }
    if (!keyboardWasOpenRef.current) return;
    searchInputRef.current?.blur();
    setIntentToSearch(false);
  }, [searchMode, keyboardOpen]);

  useEffect(() => {
    if (openCart && !showCartPanel) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
    }
  }, [openCart, showCartPanel]);

  useEffect(() => {
    if (showSyncView || resumenDiaOpen) {
      searchInputRef.current?.blur();
      setIntentToSearch(false);
    }
  }, [showSyncView, resumenDiaOpen]);

  const { verificarPermiso } = usePermisos();
  const puedeAsociarCodigo = verificarPermiso(
    "operaciones.pos-venta.asociar_codigo",
  );
  const puedeImprimir = verificarPermiso("operaciones.pos-venta.imprimir");
  const puedeDevolucionVenta = verificarPermiso(
    "operaciones.movimientos.crear.devolucion_venta",
  );
  const { triggerPrint } = usePrintOnSale();
  const printContext = usePrintContext();
  const { prefetchTemplate } = usePrinter(user?.localActual?.id);
  const [printerSetupOpen, setPrinterSetupOpen] = useState(false);

  useEffect(() => {
    if (user?.localActual?.id && puedeImprimir) {
      void prefetchTemplate();
    }
  }, [user?.localActual?.id, puedeImprimir, prefetchTemplate]);

  const posOnboardingBlocksInteraction = useOnboardingStore((s) => {
    if (!s.run || s.activeTourId !== TOUR_POS_VENTA) return false;
    const step = getTourById(TOUR_POS_VENTA)?.steps[s.stepIndex];
    if (!step) return false;
    return !(step.spotlightClicks ?? false);
  });
  const onboardingRun = useOnboardingStore((s) => s.run);
  const onboardingStepIndex = useOnboardingStore((s) => s.stepIndex);
  const activeStepDefinitions = useOnboardingStore(
    (s) => s.activeStepDefinitions,
  );

  const [asociarCodigoOpen, setAsociarCodigoOpen] = useState(false);
  const [codigoNoEncontrado, setCodigoNoEncontrado] = useState<string>("");
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);

  useEffect(() => {
    if (!onboardingRun || !isMobile) return;
    const step = activeStepDefinitions[onboardingStepIndex];
    if (!step) return;

    const { target } = step;
    // pos-category-first now lives in the fixed pills row above the
    // scrollable grid — always visible, no scroll needed to reveal it.
    const needsPosScroll = isPosTopToolbarTourTarget(target);

    if (!needsPosScroll) return;

    scrollPosTourTargetIntoView(posScrollRef.current, target, () => {
      useOnboardingStore.getState().bumpLayoutNonce();
    });
  }, [onboardingRun, onboardingStepIndex, activeStepDefinitions, isMobile]);

  // Calcular ancho del panel del carrito (sm+ solamente; en mobile se usa
  // el Drawer, que no llama a esta función).
  // Con techo: el contenido del carrito (líneas, total, botón de cobrar) no
  // gana nada por encima de ~420px, y cada píxel de más se lo quita a la
  // grilla, que sí lo aprovecha. Sin el tope, una pantalla de 1280px le daba
  // 538px al panel y dejaba las tarjetas en 234px — demasiado estrechas para
  // el stepper y el precio en la misma fila.
  const getCartWidth = () => {
    if (isTablet) return "min(48vw, 420px)";
    return "clamp(360px, 42vw, 420px)";
  };

  const scannerEnabled =
    !editingCartId &&
    !intentToSearch &&
    !asociarCodigoOpen &&
    !selectedProduct &&
    !cameraScannerOpen &&
    // While charging, the physical keyboard belongs to the amount keypad.
    // Its digits reach this global listener too (the keypad's fields are not
    // editable targets), and a burst of them was being flushed as a scanned
    // barcode — a "Código no reconocido" dialog on top of the sale.
    !checkoutInProgress;

  useHardwareScanner({
    enabled: scannerEnabled,
    onScan: (raw) =>
      hardwareScanHandlerRef.current(processClientDataFromQR(raw)),
  });

  // Función para reabrir el scanner solo si el producto vino de escaneo de cámara
  const reopenScannerIfNeeded = () => {
    if (productOrigin === "camera" && scannerRef.current) {
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
        addToCart(
          {
            id: product.id,
            name: product.producto.nombre,
            price: product.precio,
            productoTiendaId: product.id,
            fechaVencimiento: product.fechaVencimiento ?? null,
            monedaPrecioCode: product.monedaPrecioCode ?? null,
            priceBase: convertToBase(
              product.precio,
              product.monedaPrecioCode ?? monedaBase,
              tasasVigentes,
              monedaBase,
            ),
          },
          1,
        );

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
        showMessage(
          `✅ ${product.producto.nombre} agregado al carrito`,
          "success",
        );
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
          setScannerError("Producto no encontrado para el código escaneado");
        }
      }
    }
  };
  hardwareScanHandlerRef.current = handleHardwareScan;

  // Crear un Map/índice al cargar productos una sola vez
  const productCodeMap = useMemo(() => {
    const map = new Map<string, IProductoTiendaV2[]>();
    productosTienda.forEach((product) => {
      product.producto.codigosProducto?.forEach((code) => {
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
      // El modal de cantidad se abre automáticamente por el estado selectedProduct
      setScannerError(null);
      setProductOrigin("camera"); // Marcar como escaneo de cámara
    } else {
      audioService.playErrorSound();
      if (puedeAsociarCodigo) {
        setCodigoNoEncontrado(code);
        setAsociarCodigoOpen(true);
        setScannerError(null);
      } else {
        setScannerError("Producto no encontrado para el código escaneado");
      }
    }
  }

  const syncPendingSales = async () => {
    if (shouldDeferPosBackgroundOperations(periodo)) return;

    const salesNotSynced = sales.filter(
      (sale) =>
        sale.syncState === "not_synced" &&
        !syncingIdentifiers.has(sale.identifier),
    );

    if (salesNotSynced.length === 0) return;

    const suppressToasts = shouldDeferPosBackgroundOperations(periodo);
    if (!suppressToasts) {
      showMessage(`Sincronizando ${salesNotSynced.length} ventas...`, "info");
    }

    // Marcar como "sincronizando" para evitar duplicados
    const newSyncingIds = new Set(syncingIdentifiers);
    salesNotSynced.forEach((sale) => newSyncingIds.add(sale.identifier));
    setSyncingIdentifiers(newSyncingIds);

    let syncedCount = 0;
    let errorCount = 0;

    for (const sale of salesNotSynced) {
      try {
        markSyncing(sale.identifier); // Marcar como sincronizando
        const multimonedaSync = sale.pagosDetalle
          ? {
              monedaCobro: sale.monedaCobro ?? "CUP",
              pagosDetalle: sale.pagosDetalle,
              vueltoDetalle: sale.vueltoDetalle ?? [],
              tasaSnapshot: sale.tasaSnapshot ?? {},
            }
          : undefined;
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
          sale.discountCodes, // 🆕 Reenviar códigos de descuento si existen
          multimonedaSync,
        );
        markSynced(sale.identifier, ventaDb.id);
        syncedCount++;
      } catch (error) {
        console.error(
          `❌ Error al sincronizar venta ${sale.identifier}:`,
          error,
        );

        // Manejo mejorado de errores
        if (error.message?.includes("TIMEOUT_ERROR")) {
          console.warn(
            `⚠️ Timeout en venta ${sale.identifier} - se reintentará más tarde`,
          );
        } else if (error.message?.includes("NETWORK_ERROR")) {
          console.warn(
            `⚠️ Error de red en venta ${sale.identifier} - se reintentará cuando haya conexión`,
          );
        } else if (error.message?.includes("SERVER_ERROR")) {
          console.warn(
            `⚠️ Error del servidor en venta ${sale.identifier} - se reintentará más tarde`,
          );
        } else if (error.message?.includes("CLIENT_ERROR")) {
          console.error(
            `❌ Error de datos en venta ${sale.identifier}:`,
            error.message,
          );
        } else if (error.message?.includes("Existencia insuficiente")) {
          console.error(
            `❌ Error crítico: Existencia insuficiente en venta ${sale.identifier}:`,
            error.message,
          );
          // Marcar como error permanente para evitar reintentos
          markSyncError(sale.identifier);
        } else if (
          error.response?.status === 400 &&
          error.response?.data?.error?.includes("fuera del período actual")
        ) {
          console.error(
            `❌ Error crítico: Venta ${sale.identifier} fuera del período actual - no se puede sincronizar`,
          );
          // Marcar como error permanente para evitar reintentos
          markSyncError(sale.identifier);
        }

        errorCount++;
      } finally {
        // Remover del set de sincronización
        setSyncingIdentifiers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(sale.identifier);
          return newSet;
        });
      }
    }

    if (!suppressToasts && errorCount > 0) {
      showMessage(
        `⚠️ ${errorCount} ventas no pudieron sincronizarse`,
        "warning",
      );
    }

    if (!suppressToasts && syncedCount > 0) {
      showMessage(
        `✅ ${syncedCount} ventas sincronizadas correctamente`,
        "success",
      );

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
      const rawProductos = await getProductosVenta(user.localActual.id, {
        incluseCategories: true,
      });
      const prods = rawProductos
        // Agregar el nombre del proveedor al producto
        .map((prod) => ({
          ...prod,
          producto: {
            ...prod.producto,
            nombre: prod.proveedor
              ? `${prod.producto.nombre} - ${prod.proveedor.nombre}`
              : prod.producto.nombre,
          },
        }))
        // Filtrar productos con precio positivo
        .filter((prod) => prod.precio > 0)
        // Filtrar productos con existencia positiva
        .filter((p) => {
          if (p.existencia <= 0) {
            // Si el producto tiene unidades por fracción, se debe verificar que el producto padre tenga existencia
            if (p.producto.fraccionDeId !== null) {
              const pPadre = rawProductos.find(
                (padre) => padre.productoId === p.producto.fraccionDeId,
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
        }, {}) as ICategory[],
      ).sort((a: ICategory, b: ICategory) => {
        return a.nombre.localeCompare(b.nombre);
      });
      setCategories(categorias);
    } catch (error) {
      console.error("Error al obtener productos", error);
      if (!silent && !shouldDeferPosBackgroundOperations(periodo)) {
        showMessage("Error al obtener productos", "error");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const promptOpenPeriod = (onboardingMode: boolean) => {
    const message =
      "No existe un período abierto. ¿Desea abrir un nuevo período?";

    confirmDialog(
      message,
      () =>
        openPeriod(user.localActual.id).then((newPeriod) => {
          setPeriodo(newPeriod);
          void fetchProductosAndCategories();
          if (onboardingMode) {
            const store = useOnboardingStore.getState();
            store.signalEvent({ type: "period_opened" });
            store.bumpLayoutNonce();
          }
        }),
      () => {
        if (onboardingMode) {
          showMessage(
            "Abre un período con «Sí» para continuar la guía del POS",
            "warning",
          );
        } else {
          showMessage(
            "No puede comenzar a vender si no tiene un período abierto",
            "warning",
          );
          gotToPath("/home");
        }
      },
      onboardingMode
        ? {
            tourAttrs: {
              dialog: "pos-period-dialog",
              confirm: "pos-period-confirm",
              cancel: "pos-period-cancel",
            },
          }
        : undefined,
    );
  };

  const incrementarCantidades = (id: string, cantidad: number) => {
    const productIndex = productosTienda.findIndex((p) => p.id === id);
    if (productIndex !== -1) {
      const newProds = [...productosTienda];
      newProds[productIndex] = {
        ...newProds[productIndex],
        existencia: newProds[productIndex].existencia + cantidad,
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
  };

  const handleCartIcon = () => {
    setOpenCart(true);
  };
  const handleMakePay = async (
    total: number,
    totalCash: number,
    totalTransfer: number,
    transferDestinationId?: string,
    discountCodes?: string[],
    multimoneda?: IMultimonedaExtras,
  ) => {
    try {
      // Comparación en céntimos para tolerar ruido de punto flotante: sin esto,
      // un total fraccionado podía dar `false` por diferencias ~1e-13 y la venta
      // se descartaba en silencio.
      if (
        Math.round(total * 100) <= Math.round((totalCash + totalTransfer) * 100)
      ) {
        const tiendaId = user.localActual.id;
        const cierreId = periodo.id;
        const identifier =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
                const r = (Math.random() * 16) | 0;
                return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
              });

        const data = cart.map((prod) => {
          const productoEnTienda = productosTienda.find(
            (p) => p.id === prod.productoTiendaId,
          );
          if (!productoEnTienda) {
            throw new Error(
              `Producto no encontrado en la tienda: ${prod.name}`,
            );
          }
          return {
            cantidad: prod.quantity,
            productoTiendaId: prod.productoTiendaId,
            productId: productoEnTienda.productoId,
            name: prod.name,
            price: prod.price,
            monedaPrecioCode: prod.monedaPrecioCode ?? null,
          };
        });

        const cash = total - totalTransfer;

        const newSale: Sale = {
          identifier: identifier,
          cierreId: cierreId,
          tiendaId: tiendaId,
          total: total,
          totalcash: cash,
          totaltransfer: totalTransfer,
          productos: data,
          usuarioId: user.id,
          syncState: "not_synced",
          synced: false,
          createdAt: Date.now(),
          wasOffline: !isOnline,
          syncAttempts: 0,
          ...(totalTransfer > 0 && { transferDestinationId }),
          ...(discountCodes && discountCodes.length > 0
            ? { discountCodes }
            : {}),
          ...(multimoneda && {
            monedaCobro: multimoneda.monedaCobro,
            pagosDetalle: multimoneda.pagosDetalle,
            vueltoDetalle: multimoneda.vueltoDetalle,
            tasaSnapshot: multimoneda.tasaSnapshot,
            ...(multimoneda.discountTotal != null &&
            multimoneda.discountTotal > 0
              ? { discountTotal: multimoneda.discountTotal }
              : {}),
          }),
        };

        // 1. INMEDIATAMENTE: Eliminar carrito activo (y su píldora), y cerrar
        // todo lo que pueda seguir abierto del flujo de venta para arrancar
        // limpio en la próxima venta.
        removeActiveCart();
        setOpenCart(false);
        setSelectedProduct(null);
        setSearchQuery("");
        setIntentToSearch(false);
        setProductOrigin(null);
        setCameraScannerOpen(false);

        // 2. Agregar la venta al store local
        addSale(newSale);

        if (puedeImprimir && printContext) {
          triggerPrint({
            sale: newSale,
            tiendaId,
            context: printContext,
          });
        }

        // 3. Actualizar inventario local (incluyendo desagregaciones)
        // Primero, identificar qué productos necesitan desagregación
        const desagregaciones: {
          padreProductoId: string;
          cantidad: number;
          hijoId: string;
          unidadesPorFraccion: number;
        }[] = [];

        cart.forEach((cartProd) => {
          const productoEnTienda = productosTienda.find(
            (p) => p.id === cartProd.productoTiendaId,
          );
          if (productoEnTienda && productoEnTienda.producto.fraccionDeId) {
            // Es un producto fracción
            if (productoEnTienda.existencia < cartProd.quantity) {
              // Necesita desagregación
              desagregaciones.push({
                padreProductoId: productoEnTienda.producto.fraccionDeId,
                cantidad: 1, // Siempre desagrega 1 unidad del padre
                hijoId: productoEnTienda.id,
                unidadesPorFraccion:
                  productoEnTienda.producto.unidadesPorFraccion || 0,
              });
            }
          }
        });

        const newProds = productosTienda.map((p) => {
          let nuevaExistencia = p.existencia;

          // Verificar si este producto es padre de alguna desagregación
          const desagregacionPadre = desagregaciones.find(
            (d) => d.padreProductoId === p.productoId,
          );
          if (desagregacionPadre) {
            // Restar 1 del producto padre
            nuevaExistencia -= desagregacionPadre.cantidad;
          }

          // Verificar si este producto es hijo de alguna desagregación
          const desagregacionHijo = desagregaciones.find(
            (d) => d.hijoId === p.id,
          );
          if (desagregacionHijo) {
            // Sumar las unidades por fracción
            nuevaExistencia += desagregacionHijo.unidadesPorFraccion;
          }

          // Verificar si este producto está en el carrito (venta)
          const cartProd = cart.find(
            (cartItem) => cartItem.productoTiendaId === p.id,
          );
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
              Date.now(),
              !isOnline,
              1,
              discountCodes,
              multimoneda,
            );
            markSynced(identifier, ventaDb.id);
            showMessage(
              "✅ Venta procesada y sincronizada exitosamente",
              "success",
            );
          } catch (syncError) {
            console.error(syncError);

            // Manejo mejorado de errores de sincronización
            if (syncError.message?.includes("TIMEOUT_ERROR")) {
              showMessage(
                "📱 Venta guardada localmente. Timeout en sincronización - se reintentará automáticamente.",
                "warning",
              );
            } else if (syncError.message?.includes("NETWORK_ERROR")) {
              showMessage(
                "📱 Venta guardada localmente. Error de red - se sincronizará cuando haya conexión.",
                "warning",
              );
            } else if (syncError.message?.includes("SERVER_ERROR")) {
              showMessage(
                "📱 Venta guardada localmente. Error del servidor - se reintentará automáticamente.",
                "warning",
              );
            } else if (syncError.message?.includes("CLIENT_ERROR")) {
              showMessage(
                "📱 Venta guardada localmente. Error en los datos - contacte al administrador.",
                "error",
              );
            } else if (syncError.message?.includes("Existencia insuficiente")) {
              showMessage(
                "❌ Error: No hay suficiente stock para completar la venta. Verifique el inventario.",
                "error",
              );
              // Marcar como error permanente para evitar reintentos
              markSyncError(identifier);
            } else if (
              syncError.response?.status === 400 &&
              syncError.response?.data?.error?.includes(
                "fuera del período actual",
              )
            ) {
              showMessage(
                "❌ Error crítico: La venta no se puede sincronizar porque pertenece a un período anterior. Contacte al administrador.",
                "error",
              );
              // Marcar como error permanente para evitar reintentos
              markSyncError(identifier);
            } else {
              showMessage(
                "📱 Venta guardada localmente. Se sincronizará automáticamente.",
                "info",
              );
            }
          }
        } else {
          showMessage(
            "📱 Venta guardada localmente. Se sincronizará cuando haya conexión.",
            "info",
          );
        }
      } else {
        showMessage("❌ El pago no cubre el total de la venta", "error");
      }
    } catch (error) {
      console.error(error);
      showMessage("❌ Error al procesar el pago", "error");
      // En caso de error, también limpiar el carrito para evitar estados inconsistentes
      clearCart();
      setOpenCart(false);
      throw error;
    }
  };
  const handleUpdateQuantity = (id: string, quantity: number) => {
    const oldQuantity =
      cart.find((item) => item.productoTiendaId === id)?.quantity || 0;
    if (oldQuantity < quantity) {
      const productoTienda = productosTienda.find((p) => p.id === id);
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
  };

  const handleCloseSyncView = () => {
    setShowSyncView(false);
  };
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // Category and search combine as AND: with a category marked, the
  // search box filters within it rather than across the whole catalog.
  const filteredProducts = useMemo(() => {
    return productosTienda
      .filter(
        (p) =>
          selectedCategoryId === null ||
          p.producto.categoria.id === selectedCategoryId,
      )
      .filter((p) =>
        normalizeSearch(p.producto.nombre).includes(
          normalizeSearch(searchQuery),
        ),
      );
  }, [productosTienda, selectedCategoryId, searchQuery]);

  const selectedCategoryName = categories.find(
    (c) => c.id === selectedCategoryId,
  )?.nombre;

  const emptyMessage =
    searchQuery.trim() !== ""
      ? selectedCategoryName
        ? `No se encontraron productos para "${searchQuery}" en «${selectedCategoryName}». Toca «Todas» para buscar en todo el catálogo.`
        : `No se encontraron productos para "${searchQuery}"`
      : selectedCategoryName
        ? "No hay productos en esta categoría"
        : "No hay productos disponibles";

  // Reset scroll position on filter change: the old per-category modal
  // always opened fresh, so keeping scrollTop across a pill/search change
  // would land the cashier mid-list in a usually shorter result.
  useEffect(() => {
    const el = posScrollRef.current;
    if (!el) return;
    // Mientras se busca la lista es `column-reverse`: el primer resultado
    // está en el extremo *físico* de abajo (pegado al buscador), así que
    // "volver al principio" es el scrollTop máximo, que el navegador
    // recorta solo.
    el.scrollTop = searchMode ? el.scrollHeight : 0;
  }, [selectedCategoryId, searchQuery, searchMode]);

  const handleResetProductQuantity = () => {
    setSelectedProduct(null);
    setProductOrigin(null); // Limpiar origen al cancelar
  };

  const handleConfirmQuantity = () => {
    setSelectedProduct(null);
    setOpenCart(true);
  };

  const handleSearchFocus = () => {
    setIntentToSearch(true);
  };

  const handleSearchMouseDown = () => {
    // Establecer la intención de búsqueda ANTES del evento de foco
    // para que el escáner no robe el foco
    setIntentToSearch(true);
  };

  // Salir del campo termina la búsqueda, con una excepción: tocar la
  // cantidad de un producto abre su editor inline y le pasa el foco, y
  // ahí seguimos buscando — cerrar el modo en ese blur reexpandiría la
  // barra superior justo mientras el cajero escribe la cantidad. El
  // chequeo va en un timeout porque en el momento del blur el foco
  // todavía no se movió a su destino.
  const handleSearchBlur = () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (active && posScrollRef.current?.contains(active)) return;
      setIntentToSearch(false);
    }, 0);
  };

  // Sincronización automática cuando regresa la conexión
  useEffect(() => {
    if (shouldDeferPosBackgroundOperations(periodo)) return;
    // Solo sincronizar si:
    // 1. Acabamos de recuperar la conexión (isOnline es true)
    // 2. Hay ventas pendientes de sincronizar
    // 3. El periodo está abierto
    if (
      isOnline &&
      periodo &&
      !periodo.fechaFin &&
      sales.some((sale) => sale.syncState === "not_synced")
    ) {
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
          setTransferDestinations(data);

          const lastPeriod = await fetchLastPeriod(user.localActual.id);
          if (!lastPeriod || lastPeriod.fechaFin) {
            if (!shouldDeferPosPeriodPrompt()) {
              promptOpenPeriod(false);
            }
          } else {
            setPeriodo(lastPeriod);
          }
        } catch (error) {
          console.error(error);
          if (!shouldDeferPosPeriodPrompt()) {
            showMessage(
              "Ocurrió un erro intentando cargar le período",
              "error",
            );
          }
        } finally {
          setLoading(false);
        }
      }
    })();
  }, [loadingContext]);

  useEffect(() => {
    const onOnboardingPeriodPrompt = () => {
      if (periodo && !periodo.fechaFin) {
        const store = useOnboardingStore.getState();
        store.signalEvent({ type: "period_opened" });
        store.bumpLayoutNonce();
        return;
      }
      promptOpenPeriod(true);
      useOnboardingStore.getState().bumpLayoutNonce();
    };

    window.addEventListener(
      ONBOARDING_PROMPT_POS_PERIOD_EVENT,
      onOnboardingPeriodPrompt,
    );
    return () => {
      window.removeEventListener(
        ONBOARDING_PROMPT_POS_PERIOD_EVENT,
        onOnboardingPeriodPrompt,
      );
    };
  }, [periodo, user?.localActual?.id]);

  // Activar audio context cuando se carga la página
  useEffect(() => {
    audioService.resumeAudioContext();
  }, []);

  useEffect(() => {
    if (periodo) {
      fetchProductosAndCategories().catch(() => {
        if (!shouldDeferPosBackgroundOperations(periodo)) {
          showMessage(
            "Ocurrió un error intentando cargar las categorías",
            "error",
          );
        }
      });
    }
  }, [periodo]);

  const handleCodigoAsociado = (
    producto: IProductoTiendaV2,
    codigoNuevo: string,
  ) => {
    // Actualizar el estado local para que el nuevo código quede indexado
    setProductosTienda((prev) =>
      prev.map((p) =>
        p.id === producto.id
          ? {
              ...p,
              producto: {
                ...p.producto,
                codigosProducto: [
                  ...(p.producto.codigosProducto || []),
                  {
                    id: codigoNuevo,
                    codigo: codigoNuevo,
                    productoId: p.productoId,
                  },
                ],
              },
            }
          : p,
      ),
    );
    showMessage(
      `✅ Código asociado a "${producto.producto.nombre}"`,
      "success",
    );
    audioService.playSuccessSound();
    // Seleccionar el producto para que el vendedor pueda agregarlo al carrito
    setSelectedProduct(producto);
    setProductOrigin("hardware");
  };

  if (loadingContext || loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
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
            Para usar el punto de venta, necesitas tener una tienda seleccionada
            como tienda actual.
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Si no tienes ninguna tienda creada, primero debes crear una desde la
            configuración.
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
            <Button variant="outlined" onClick={() => gotToPath("/")}>
              Volver al Inicio
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      p={0}
      display={"flex"}
      flexDirection={"row"}
      sx={{
        // 56/64px are the top AppBar's heights (see Layout.tsx).
        height: { xs: "calc(100dvh - 56px)", sm: "calc(100dvh - 64px)" },
        overflow: "hidden",
        // Con el teclado abierto, iOS Safari no encoge el viewport de
        // layout: desplaza el *visual viewport* dentro de él. Todo lo que
        // esté en flujo normal del documento queda entonces corrido hacia
        // arriba respecto de lo que se ve (la AppBar sticky se va fuera de
        // pantalla) y `dvh` sigue midiendo el alto sin teclado, así que
        // este box se extendía por debajo del teclado y los productos
        // quedaban tapados. Solo `position: fixed` sigue al área visible:
        // mientras se busca, este contenedor pasa a estar anclado a ella y
        // toda la maquetación de adentro —barra, píldoras, grilla— vuelve
        // a resolver contra coordenadas reales, sin tocar su estructura.
        ...(pinToVisibleArea && {
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: `${viewportHeight}px`,
          // Por encima de la AppBar (zIndex.drawer - 1), que con el teclado
          // abierto ya está fuera del área visible de todos modos.
          zIndex: 1200,
        }),
      }}
    >
      <Box
        sx={{
          // The cart panel is a real flex sibling (fixed sidebar from
          // sm+), so `flex: 1` guarantees this always takes exactly
          // "whatever space the cart panel doesn't" — correct at any
          // viewport width, including when the cart's own minWidth floor
          // kicks in. On mobile there's no sibling at all, and flex:1 is
          // what makes this fill the whole row.
          flex: 1,
          minWidth: 0,
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          // Anchors CheckoutLockOverlay to this pane, and only this pane —
          // the cart panel next to it stays fully usable while locked.
          position: "relative",
          ...(posOnboardingBlocksInteraction || productsLocked
            ? { pointerEvents: "none", userSelect: "none" }
            : {}),
        }}
      >
        {/* Clicking the scrim only releases the lock — the click never
            reaches a product, so dismissing it can't add anything by
            accident. */}
        <CheckoutLockOverlay
          active={productsLocked}
          onDismiss={() => setCartStep("cart")}
        />
        {/* Al buscar, la cabecera entera (herramientas + categorías) sale de
            vista: escribir el nombre ya filtra mejor que cualquiera de las
            dos, y el alto que dejan libre lo hereda la grilla. Ninguna se
            aplasta a altura 0 — conservan su tamaño y se desplazan con un
            margen negativo, así que al salir de la búsqueda vuelven solas.
            El `overflow: hidden` del padre hace dos cosas necesarias, no
            una: recorta lo desplazado, y crea un contexto de formato de
            bloque sin el cual este margen negativo se colapsaría con el del
            padre y arrastraría todo hacia arriba. */}
        <Box sx={{ flexShrink: 0, overflow: "hidden" }}>
          <Box
            ref={posHeaderRef}
            sx={{
              mt: searchMode ? `-${headerHeight}px` : 0,
              transition: "margin-top 0.2s ease",
            }}
          >
            <Box
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.95)",
                backdropFilter: "blur(10px)",
                borderBottom: "1px solid rgba(0,0,0,0.1)",
                px: 2,
                py: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
              }}
            >
              <Box
                data-tour="pos-toolbar-periodo"
                sx={{ display: "flex", alignItems: "center", minHeight: 32 }}
              >
                <PeriodoBadge periodo={periodo} isMobile={isMobile} />
              </Box>

              <Box
                display="flex"
                flexDirection="row"
                justifyContent="center"
                alignItems="center"
              >
                <RefreshButton onRefresh={handleRefresh} />
                <Tooltip title="Punto de partida">
                  <IconButton
                    size="small"
                    data-tour="pos-toolbar-punto-partida"
                    onClick={() => setResumenDiaOpen(true)}
                  >
                    <FlagIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {puedeDevolucionVenta && (
                  <Tooltip title="Devolución de venta">
                    <IconButton
                      size="small"
                      onClick={() => setDevolucionVentaOpen(true)}
                    >
                      <UndoIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <PosStatusToolBar
                  handleShowSyncView={handleShowSyncView}
                  handleShowUserSales={handleShowUserSales}
                />
                {puedeImprimir && user?.localActual?.id && (
                  <PrintQueueIndicator
                    tiendaId={user.localActual.id}
                    onOpenSetup={() => setPrinterSetupOpen(true)}
                  />
                )}
                <ConnectionStatus isOnline={isOnline} />
              </Box>
            </Box>
            {/* Fila fija de píldoras de categorías */}
            <CategoryPillsBar
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={setSelectedCategoryId}
            />
          </Box>
        </Box>

        {/* Contenido principal: la misma grilla de productos de siempre.
            Mientras se busca en mobile se apila en una sola columna
            invertida, para que el primer resultado quede pegado al
            buscador en vez de al borde de arriba. */}
        <Box
          ref={posScrollRef}
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "auto",
            ...(searchMode && {
              display: "flex",
              flexDirection: "column-reverse",
              gap: 1.5,
              p: 1.5,
            }),
            // Matches PosBottomBar's own 700px threshold for switching
            // between position:fixed (mobile) and normal flow (desktop):
            // below it the footer is fixed and needs this space reserved
            // so it doesn't cover the tail end of the grid. The value
            // itself comes from measuring PosBottomBar live (see
            // bottomBarHeight above) rather than a guessed constant.
            pb: `${bottomBarHeight}px`,
            "@media (min-width:700px)": {
              pb: 0,
            },
          }}
        >
          <PosProductGrid
            products={filteredProducts}
            allProductosTienda={productosTienda}
            emptyMessage={emptyMessage}
            searchQuery={searchQuery}
            bottomUp={searchMode}
          />
        </Box>

        {/* Carrito de compras (overlay, solo mobile) */}
        <CartDrawer
          cart={cart}
          onClose={() => setOpenCart(false)}
          open={!showCartPanel && openCart}
          makePay={handleMakePay}
          transferDestinations={transferDestinations}
          cierreId={periodo?.id ?? ""}
          total={total}
          clear={clearCart}
          removeItem={removeFromCart}
          updateQuantity={handleUpdateQuantity}
          onStepChange={setCartStep}
        />

        {/* Modal de resumen del período */}
        <ResumenDiaModal
          open={resumenDiaOpen}
          onClose={() => setResumenDiaOpen(false)}
          tiendaId={user.localActual.id}
          cierreId={periodo?.id ?? ""}
        />

        {/* Diálogo de devolución de venta */}
        {puedeDevolucionVenta && (
          <DevolucionVentaDialog
            dialogOpen={devolucionVentaOpen}
            closeDialog={() => setDevolucionVentaOpen(false)}
            tiendaId={user.localActual.id}
            onSuccess={() => fetchProductosAndCategories(true)}
          />
        )}

        {/* Drawer de ventas del usuario */}
        <UserSalesDrawer
          showUserSales={showUserSales}
          setShowUserSales={setShowUserSales}
          period={periodo}
          incrementarCantidades={incrementarCantidades}
          transferDestinations={transferDestinations}
          productosTienda={productosTienda}
        />

        {/* Drawer de ventas y sincronización  */}
        <SalesDrawer
          showSales={showSyncView}
          handleClose={() => handleCloseSyncView()}
          period={periodo}
          reloadProdsAndCategories={() => fetchProductosAndCategories(true)}
          incrementarCantidades={incrementarCantidades}
          productosTienda={productosTienda}
        />

        {puedeImprimir && user?.localActual?.id && (
          <PrinterSetupSheet
            open={printerSetupOpen}
            onClose={() => setPrinterSetupOpen(false)}
            tiendaId={user.localActual.id}
          />
        )}

        <ShoppingCartComponent
          openCart={openCart}
          handleCartIcon={handleCartIcon}
          hidden={showCartPanel}
        />

        <PosBottomBar
          rootRef={posBottomBarRef}
          searchMode={searchMode}
          carts={carts}
          activeCartId={activeCartId}
          onSelectCart={setActiveCart}
          onCreateCart={() => createCart()}
          onRemoveActiveCart={removeActiveCart}
          onRenameCart={renameCart}
          editingCartId={editingCartId}
          onStartEditingCart={(id, name) => {
            setEditingCartId(id);
            setEditingCartName(name);
          }}
          editingCartName={editingCartName}
          onEditingCartNameChange={setEditingCartName}
          onStopEditingCart={() => {
            if (editingCartId) {
              const cart = carts.find((c) => c.id === editingCartId);
              const newName =
                (editingCartName || "").trim() || cart?.name || "";
              renameCart(editingCartId, newName);
            }
            setEditingCartId(null);
          }}
          editCartInputRef={editCartInputRef}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={handleSearch}
          onSearchFocus={handleSearchFocus}
          onSearchBlur={handleSearchBlur}
          onSearchMouseDown={handleSearchMouseDown}
          scannerRef={scannerRef}
          onProductScan={handleProductScan}
          onCameraOpenChange={setCameraScannerOpen}
          scannerError={scannerError}
          onDismissScannerError={() => setScannerError(null)}
        />

        {/* Dialog de cantidad */}
        <QuantityDialog
          productoTienda={selectedProduct}
          onClose={handleResetProductQuantity}
          onConfirm={handleConfirmQuantity}
          onAddToCart={reopenScannerIfNeeded}
          maxDisponibleOverride={
            selectedProduct
              ? calcularDisponibilidadReal(selectedProduct, productosTienda)
                  .maxPorTransaccion
              : undefined
          }
        />
        {ConfirmDialogComponent}

        <AsociarCodigoDialog
          open={asociarCodigoOpen}
          codigo={codigoNoEncontrado}
          productosTienda={productosTienda}
          onClose={() => setAsociarCodigoOpen(false)}
          onAsociado={handleCodigoAsociado}
        />
      </Box>

      {showCartPanel && (
        <Box
          sx={{
            // A real flex sibling, not a position:fixed overlay floating
            // above the content on hand-computed coordinates. That's what
            // made the two ever line up "by luck" instead of by
            // construction — the main content's width was a separately
            // maintained calc() string that had to exactly match this
            // panel's width, including its minWidth floor, and drifted.
            // As a flex item, the browser computes both correctly, always.
            flexShrink: 0,
            width: getCartWidth(),
            maxWidth: getCartWidth(),
            minWidth: "360px",
            height: "100%",
            // The shadow alone reads as "something sits near this edge,"
            // not as a hard line — both panels share the same background
            // color, so without an actual border the seam was hard to
            // spot. The border is the delimiter; the shadow adds depth on
            // top of it. It has to live on THIS box, not the inner one
            // below: box-shadow paints outside the border box, and a
            // sibling `overflow: hidden` on the very same box clips its
            // own shadow away.
            borderLeft: "1px solid",
            borderColor: "divider",
            boxShadow: "-8px 0px 24px rgba(0,0,0,0.12)",
            backgroundColor: "background.paper",
          }}
        >
          {/* Only THIS box clips — CartContent's internal scrolling needs
              containment, but it must not clip the outer box's shadow. */}
          <Box sx={{ height: "100%", overflow: "hidden" }}>
            <CartContent
              cart={cart}
              total={total}
              clear={clearCart}
              updateQuantity={handleUpdateQuantity}
              removeItem={removeFromCart}
              makePay={handleMakePay}
              transferDestinations={transferDestinations}
              cierreId={periodo?.id ?? ""}
              variant="panel"
              step={cartStep}
              onStepChange={setCartStep}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
