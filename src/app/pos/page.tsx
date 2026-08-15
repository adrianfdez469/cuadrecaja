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

import { flushCartToStorage, useCartStore } from "@/store/cartStore";
import { getCatalogoPos } from "@/services/costoPrecioServices";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { CategoryPillsBar } from "./components/CategoryPillsBar";
import { PosProductGrid } from "./components/PosProductGrid";
import { CheckoutLockOverlay } from "./components/CheckoutLockOverlay";
import { CurrencyDisplayToggle } from "./components/CurrencyDisplayToggle";
import type { IPosCategoria } from "@/schemas/producto";
import { IProductoTiendaPos } from "@/schemas/producto";
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
import { buildProductIndex, withBasePrices } from "./utils/buildProductIndex";
import { isPermanentSyncError } from "./utils/syncErrors";
import { useDiscountRulesStore } from "@/store/discountRulesStore";
import { useCashBalanceStore } from "@/store/cashBalanceStore";
import { readCatalog, writeCatalog } from "@/lib/catalogCache";
import { MAX_SYNC_ATTEMPTS } from "@/constants/pos";
import { packsToOpen, unitsFromPacks } from "@/lib/fractionStock";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  useOnScreenKeyboard,
  VISUAL_VIEWPORT_HEIGHT_VAR,
} from "@/hooks/useOnScreenKeyboard";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { POS_SEARCH_DEBOUNCE_MS } from "@/constants/pos";
import { useBlockBackNavigation } from "@/hooks/useBlockBackNavigation";
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
  const [categories, setCategories] = useState<IPosCategoria[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [productosTienda, setProductosTienda] = useState<IProductoTiendaPos[]>(
    [],
  );
  const [openCart, setOpenCart] = useState(false);
  const [periodo, setPeriodo] = useState<ICierrePeriodo>();
  const [noLocalActual, setNoLocalActual] = useState(false);
  const { user, loadingContext, gotToPath, tasasVigentes, monedaBase } =
    useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const { addSale, markSynced, markSyncing, checkSyncTimeouts, markSyncError } =
    useSalesStore();
  // A number, not the array: this drives the sync effect, and subscribing to
  // `sales` re-ran it on every mark the sync itself performed.
  const pendingSalesCount = useSalesStore(
    (state) =>
      state.sales.filter((sale) => sale.syncState === "not_synced").length,
  );
  const [showUserSales, setShowUserSales] = useState(false);
  const [showSyncView, setShowSyncView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // The field stays fully controlled by `searchQuery` — typing must never
  // wait on anything. Only the expensive half (filtering the catalog and
  // rebuilding the grid) reads the trailing value.
  const debouncedSearchQuery = useDebouncedValue(
    searchQuery,
    POS_SEARCH_DEBOUNCE_MS,
  );
  const searchInputRef = useRef<HTMLInputElement>(null);
  const posScrollRef = useRef<HTMLDivElement>(null);
  /**
   * The same node as `posScrollRef`, held in state as well.
   *
   * The virtualized grid needs the scrolling element itself, and a ref cannot
   * deliver it: refs attach bottom-up, so the child renders while the parent's
   * ref is still null, and nothing re-renders afterwards to tell it otherwise.
   * The result was a grid that measured a zero-height scroller and drew no
   * rows at all.
   */
  const [posScrollEl, setPosScrollEl] = useState<HTMLDivElement | null>(null);
  const posScrollCallbackRef = useCallback((el: HTMLDivElement | null) => {
    posScrollRef.current = el;
    setPosScrollEl(el);
  }, []);
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
      if (!entry) return;
      // Con guarda de igualdad: entrar y salir del modo búsqueda cambia el
      // alto de esta barra, y cada `setState` de aquí re-renderiza el POS
      // entero y con él el `pb` del contenedor de scroll — una segunda pasada
      // de layout de todo el catálogo, encadenada tras la del propio cambio.
      const height = entry.contentRect.height;
      setBottomBarHeight((prev) =>
        Math.abs(prev - height) < 0.5 ? prev : height,
      );
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
    // borderBoxSize, no contentRect: estas barras tienen padding propio y
    // bordes, y contentRect los excluye — desplazarlas por ese valor dejaría
    // una franja asomando. Y no `offsetHeight`: leerlo dentro del callback del
    // observer fuerza un layout síncrono en plena fase de entrega, que es
    // justo el patrón que produce "ResizeObserver loop completed with
    // undelivered notifications". `borderBoxSize` ya viene medido.
    const observer = new ResizeObserver(([entry]) => {
      const height =
        entry?.borderBoxSize?.[0]?.blockSize ??
        el.getBoundingClientRect().height;
      setHeaderHeight((prev) =>
        Math.abs(prev - height) < 0.5 ? prev : height,
      );
    });
    observer.observe(el);
    headerObserverRef.current = observer;
  }, []);
  const [selectedProduct, setSelectedProduct] =
    useState<IProductoTiendaPos | null>(null);
  // Individual selectors, never the whole store. Subscribing to the state
  // object meant every cart mutation re-rendered this 1700-line component and
  // the entire product grid under it — the single biggest source of the lag
  // the cashiers were feeling on `+`. `items` and `total` are gone entirely:
  // the cart panel and drawer read them for themselves, and the sale flow
  // reads the basket with `getState()` at the moment it charges.
  const carts = useCartStore((state) => state.carts);
  const activeCartId = useCartStore((state) => state.activeCartId);
  const clearCart = useCartStore((state) => state.clearCart);
  const removeFromCart = useCartStore((state) => state.removeFromCart);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const createCart = useCartStore((state) => state.createCart);
  const setActiveCart = useCartStore((state) => state.setActiveCart);
  const renameCart = useCartStore((state) => state.renameCart);
  const removeActiveCart = useCartStore((state) => state.removeActiveCart);
  const [loading, setLoading] = useState(true);
  /**
   * The catalog has been resolved at least once for the current store —
   * whether from the cache, from the network, or by failing.
   *
   * Separate from `loading`, which only covers the period and the store's
   * initial data. Conflating the two made the POS paint a fully formed but
   * empty grid, "No hay productos disponibles" and all, in the gap between
   * one load finishing and the other starting.
   */
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  /** Which store the loaded catalog belongs to, to catch a store switch. */
  const catalogTiendaRef = useRef<string | null>(null);
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

  // Guard against overlapping syncs of the same sale (not for payments). A ref
  // and not state: it never reaches the UI, and as state it forced a new Set
  // identity on every mutation, which re-triggered the sync effect that
  // depended on it — a loop that reprogrammed its own timer mid-round.
  const syncingIdentifiersRef = useRef<Set<string>>(new Set());

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

  const { keyboardOpen, measured } = useOnScreenKeyboard();

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
  const pinToVisibleArea = searchMode && keyboardOpen && measured;

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
    const map = new Map<string, IProductoTiendaPos[]>();
    productosTienda.forEach((product) => {
      product.producto.codigosProducto?.forEach((code) => {
        if (!map.has(code.codigo)) map.set(code.codigo, []);
        map.get(code.codigo).push(product);
      });
    });
    return map;
  }, [productosTienda]);

  // Busca producto por código (en cualquier código asociado)
  const findProductByCode = useCallback(
    (code: string) => {
      const products = productCodeMap.get(code) || [];

      if (products.length > 1) {
        // Sorted on a copy: the array is the one held by `productCodeMap`, and
        // sorting in place would mutate the memoized index.
        return [...products].sort((a, b) => {
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
    },
    [productCodeMap],
  );

  const handleProductScan = useCallback(
    (code: string) => {
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
    },
    [findProductByCode, puedeAsociarCodigo],
  );

  const syncPendingSales = async () => {
    if (shouldDeferPosBackgroundOperations(periodo)) return;

    // Read from the store, not from the render: this runs inside a timeout,
    // and the list of pending sales may well have moved since.
    const salesNotSynced = useSalesStore
      .getState()
      .sales.filter(
        (sale) =>
          sale.syncState === "not_synced" &&
          !syncingIdentifiersRef.current.has(sale.identifier),
      );

    if (salesNotSynced.length === 0) return;

    const suppressToasts = shouldDeferPosBackgroundOperations(periodo);
    if (!suppressToasts) {
      showMessage(`Sincronizando ${salesNotSynced.length} ventas...`, "info");
    }

    // Marcar como "sincronizando" para evitar duplicados
    salesNotSynced.forEach((sale) =>
      syncingIdentifiersRef.current.add(sale.identifier),
    );

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
              ...(sale.tipTotal && sale.tipTotal > 0
                ? { tipTotal: sale.tipTotal, tipDetail: sale.tipDetail ?? [] }
                : {}),
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
        } else if (isPermanentSyncError(error)) {
          // Any other 4xx the server will keep rejecting. Without this, an
          // unclassified rejection retried forever: `checkSyncTimeouts` puts
          // the sale back to `not_synced` after 60s, and each attempt can cost
          // up to ~94s of hanging requests through the axios retry.
          console.error(
            `❌ Error permanente en venta ${sale.identifier} (HTTP ${error.response?.status}) - no se reintentará`,
          );
          markSyncError(sale.identifier);
        } else if (sale.syncAttempts >= MAX_SYNC_ATTEMPTS) {
          // Last resort for errors that look transient but never clear.
          console.error(
            `❌ Venta ${sale.identifier} agotó ${MAX_SYNC_ATTEMPTS} intentos - no se reintentará`,
          );
          markSyncError(sale.identifier);
        }

        errorCount++;
      } finally {
        // Remover del set de sincronización
        syncingIdentifiersRef.current.delete(sale.identifier);
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

      // Never while a sale is being charged: rebuilding the catalog swaps
      // every product object, and the checkout is the one moment the cashier
      // cannot afford a stutter.
      if (isOnline && cartStep !== "checkout") {
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

  /**
   * Publishes a catalog to the view, whatever it came from.
   *
   * Shared by the network load and by the cached rehydration, so the two can
   * never drift on what the rest of the POS gets to see.
   */
  const applyCatalog = useCallback(
    (productos: IProductoTiendaPos[], categorias: IPosCategoria[]) => {
      setProductosTienda(productos);
      setCategories(categorias);
      // What each basket line belongs to, so the cart can price its own
      // discounts locally instead of asking the server on every change.
      useDiscountRulesStore.getState().setProductMeta(
        Object.fromEntries(
          productos.map((p) => [
            p.id,
            {
              productoId: p.productoId,
              categoriaId: p.producto.categoria.id,
            },
          ]),
        ),
      );
    },
    [],
  );

  const fetchProductosAndCategories = async (silent: boolean = false) => {
    try {
      if (!silent) setLoading(true);
      // Catálogo proyectado: sin costos, sin descripciones y con el proveedor
      // reducido a su nombre. Para una tienda de 2000 productos eso es la
      // mayor parte de los bytes que antes viajaban por la red y había que
      // parsear en el teléfono antes de pintar la primera tarjeta.
      const rawProductos = await getCatalogoPos(user.localActual.id);
      // Existencia por productoId, resuelta una vez. El filtro de abajo hacía
      // un `find` sobre `rawProductos` por cada producto sin existencia: con
      // un catálogo de 800 eso son cientos de miles de iteraciones en cada
      // carga, y esta función corre también tras cada sincronización.
      const existenciaByProductoId = new Map<string, number>();
      for (const p of rawProductos) {
        existenciaByProductoId.set(p.productoId, p.existencia);
      }

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
        // El filtro de `precio > 0` ya lo aplica el servidor.
        // Filtrar productos con existencia positiva
        .filter((p) => {
          if (p.existencia <= 0) {
            // Si el producto tiene unidades por fracción, se debe verificar que el producto padre tenga existencia
            if (p.producto.fraccionDeId !== null) {
              const existenciaPadre = existenciaByProductoId.get(
                p.producto.fraccionDeId,
              );
              if (existenciaPadre !== undefined && existenciaPadre > 0) {
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
      const categorias = Object.values(
        prods.reduce((acum, prod) => {
          acum[prod.producto.categoria.id] = prod.producto.categoria;
          return acum;
        }, {}) as IPosCategoria[],
      ).sort((a: IPosCategoria, b: IPosCategoria) => {
        return a.nombre.localeCompare(b.nombre);
      });
      applyCatalog(productosTienda, categorias);
      // Stored already processed: rehydrating on the next open then costs one
      // IndexedDB read instead of a download plus the whole transform.
      void writeCatalog(user.localActual.id, productosTienda, categorias);
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

  const handleCartIcon = useCallback(() => {
    setOpenCart(true);
  }, []);

  const handleCloseCart = useCallback(() => {
    setOpenCart(false);
  }, []);
  const handleMakePay = async (
    total: number,
    totalCash: number,
    totalTransfer: number,
    transferDestinationId?: string,
    discountCodes?: string[],
    multimoneda?: IMultimonedaExtras,
  ) => {
    try {
      // Read at the moment of the sale rather than from the last render: this
      // is the basket that is actually being charged, and nothing that happens
      // between renders should be able to leave it behind.
      const cart = useCartStore.getState().items;
      // Closes the persistence window before the riskiest moment of the flow:
      // if the app dies while the sale is in flight, the basket is on disk.
      flushCartToStorage();
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
            ...(multimoneda.tipTotal != null && multimoneda.tipTotal > 0
              ? {
                  tipTotal: multimoneda.tipTotal,
                  tipDetail: multimoneda.tipDetail ?? [],
                }
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
            // Es un producto fracción: se abren tantos padres como haga falta,
            // con la misma cuenta que hace el backend al registrar la venta.
            const paquetes = packsToOpen(
              cartProd.quantity,
              productoEnTienda.existencia,
              productoEnTienda.producto.unidadesPorFraccion,
            );
            if (paquetes > 0) {
              desagregaciones.push({
                padreProductoId: productoEnTienda.producto.fraccionDeId,
                cantidad: paquetes,
                hijoId: productoEnTienda.id,
                unidadesPorFraccion: unitsFromPacks(
                  paquetes,
                  productoEnTienda.producto.unidadesPorFraccion,
                ),
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
            // Restar los padres abiertos
            nuevaExistencia -= desagregacionPadre.cantidad;
          }

          // Verificar si este producto es hijo de alguna desagregación
          const desagregacionHijo = desagregaciones.find(
            (d) => d.hijoId === p.id,
          );
          if (desagregacionHijo) {
            // Sumar las unidades que salieron de los padres abiertos
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

        // The sale moved cash, so the cached drawer balance is stale. Dropped
        // rather than refetched: the next checkout will pull a fresh one, and
        // doing it here would put a request back on the sale's own path.
        useCashBalanceStore.getState().invalidate(tiendaId, cierreId);

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
      useCartStore.getState().items.find((item) => item.productoTiendaId === id)
        ?.quantity || 0;
    if (oldQuantity < quantity) {
      const productoTienda = productosTienda.find((p) => p.id === id);
      if (!productoTienda) return;

      // El tope es lo que realmente se puede vender: la existencia del
      // producto y, si es fracción, lo que haya dentro de los padres sin
      // abrir (la venta los desagrega sola). Ya no se limita a una caja.
      const { disponible } = calcularDisponibilidadReal(
        productoTienda,
        productosTienda,
      );

      if (quantity > disponible) {
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
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Everything the grid reads per product — normalized name, real
  // availability, whether it is a fraction — resolved once per catalog load
  // instead of once per card per render.
  const productIndex = useMemo(
    () => buildProductIndex(productosTienda),
    [productosTienda],
  );

  // Split from the index above because the two change on different clocks: a
  // rate refresh must reprice the catalog without rebuilding it, and a stock
  // movement must rebuild it without touching the rates.
  const productCards = useMemo(
    () => withBasePrices(productIndex, tasasVigentes, monedaBase),
    [productIndex, tasasVigentes, monedaBase],
  );

  // Category and search combine as AND: with a category marked, the
  // search box filters within it rather than across the whole catalog.
  const filteredProducts = useMemo(() => {
    // Normalizing the term once, outside the predicate, instead of once per
    // product: `normalizeSearch` runs an NFD normalization plus two regex
    // passes, and the term is the same for the whole catalog.
    const term = normalizeSearch(debouncedSearchQuery);
    return productCards.filter(
      (card) =>
        (selectedCategoryId === null ||
          card.categoriaId === selectedCategoryId) &&
        card.normalizedName.includes(term),
    );
  }, [productCards, selectedCategoryId, debouncedSearchQuery]);

  const selectedCategoryName = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId)?.nombre,
    [categories, selectedCategoryId],
  );

  const emptyMessage = useMemo(
    () =>
      debouncedSearchQuery.trim() !== ""
        ? selectedCategoryName
          ? `No se encontraron productos para "${debouncedSearchQuery}" en «${selectedCategoryName}». Toca «Todas» para buscar en todo el catálogo.`
          : `No se encontraron productos para "${debouncedSearchQuery}"`
        : selectedCategoryName
          ? "No hay productos en esta categoría"
          : "No hay productos disponibles",
    [debouncedSearchQuery, selectedCategoryName],
  );

  // Reset scroll position on filter change: the old per-category modal
  // always opened fresh, so keeping scrollTop across a pill/search change
  // would land the cashier mid-list in a usually shorter result.
  useEffect(() => {
    const el = posScrollRef.current;
    if (!el) return;
    // Deferred to the next frame: reading `scrollHeight` forces a synchronous
    // layout, and running it inline here would do so right after the most
    // expensive render of the view — the grid rebuilding for a new filter.
    const raf = requestAnimationFrame(() => {
      // Mientras se busca la lista es `column-reverse`: el primer resultado
      // está en el extremo *físico* de abajo (pegado al buscador), así que
      // "volver al principio" es el scrollTop máximo, que el navegador
      // recorta solo.
      el.scrollTop = searchMode ? el.scrollHeight : 0;
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedCategoryId, debouncedSearchQuery, searchMode]);

  const handleResetProductQuantity = () => {
    setSelectedProduct(null);
    setProductOrigin(null); // Limpiar origen al cancelar
  };

  const handleConfirmQuantity = () => {
    setSelectedProduct(null);
    setOpenCart(true);
  };

  const handleSearchFocus = useCallback(() => {
    setIntentToSearch(true);
  }, []);

  const handleSearchMouseDown = useCallback(() => {
    // Establecer la intención de búsqueda ANTES del evento de foco
    // para que el escáner no robe el foco
    setIntentToSearch(true);
  }, []);

  const handleCreateCart = useCallback(() => {
    createCart();
  }, [createCart]);

  const handleStartEditingCart = useCallback((id: string, name: string) => {
    setEditingCartId(id);
    setEditingCartName(name);
  }, []);

  const handleStopEditingCart = useCallback(() => {
    if (editingCartId) {
      const cart = carts.find((c) => c.id === editingCartId);
      const newName = (editingCartName || "").trim() || cart?.name || "";
      renameCart(editingCartId, newName);
    }
    setEditingCartId(null);
  }, [editingCartId, editingCartName, carts, renameCart]);

  const handleDismissScannerError = useCallback(() => {
    setScannerError(null);
  }, []);

  // Salir del campo termina la búsqueda, con una excepción: tocar la
  // cantidad de un producto abre su editor inline y le pasa el foco, y
  // ahí seguimos buscando — cerrar el modo en ese blur reexpandiría la
  // barra superior justo mientras el cajero escribe la cantidad. El
  // chequeo va en un timeout porque en el momento del blur el foco
  // todavía no se movió a su destino.
  const handleSearchBlur = useCallback(() => {
    setTimeout(() => {
      const active = document.activeElement;
      if (active && posScrollRef.current?.contains(active)) return;
      setIntentToSearch(false);
    }, 0);
  }, []);

  // Sincronización automática cuando regresa la conexión.
  // Keyed on `pendingSalesCount`, a plain number, rather than on the `sales`
  // array and the syncing Set: those changed identity on every mark inside the
  // sync itself, so the effect re-armed its own 2s timer round after round.
  useEffect(() => {
    if (shouldDeferPosBackgroundOperations(periodo)) return;
    // Solo sincronizar si:
    // 1. Acabamos de recuperar la conexión (isOnline es true)
    // 2. Hay ventas pendientes de sincronizar
    // 3. El periodo está abierto
    if (isOnline && periodo && !periodo.fechaFin && pendingSalesCount > 0) {
      // Pequeño delay para asegurar que la conexión esté estable
      const timeoutId = setTimeout(() => {
        syncPendingSales();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline, pendingSalesCount, periodo]);

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
          // In parallel: these two are independent, and running them one
          // after the other kept the POS on its loading spinner for a whole
          // extra round-trip before the cashier could do anything.
          const [data, lastPeriod] = await Promise.all([
            fetchTransferDestinations(user.localActual.id),
            fetchLastPeriod(user.localActual.id),
          ]);
          setTransferDestinations(data);

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

  // Cache first, network second. The POS used to hold a spinner until the
  // whole catalog arrived, on every single open; now the last known catalog
  // paints immediately and the refresh lands behind it, so a cashier can start
  // selling before — or without — the network answering.
  useEffect(() => {
    if (!periodo) return;
    const tiendaId = user?.localActual?.id;
    if (!tiendaId) return;

    // Switching store invalidates whatever is on screen: hold the loading
    // state until the new store's catalog arrives, rather than showing the
    // previous one's products for a moment.
    if (catalogTiendaRef.current !== tiendaId) {
      catalogTiendaRef.current = tiendaId;
      setCatalogLoaded(false);
    }

    let cancelled = false;

    (async () => {
      const cached = await readCatalog(tiendaId);
      if (cancelled) return;

      const hasCache = Boolean(cached && cached.productos.length > 0);
      if (hasCache) {
        applyCatalog(cached.productos, cached.categorias);
        // Usable right now: let the grid paint from the cache while the
        // refresh below lands behind it.
        setCatalogLoaded(true);
      }

      // Silent when the screen is already usable: a spinner over a working
      // catalog would undo the whole point.
      await fetchProductosAndCategories(hasCache);
      // Marked resolved even on failure — `fetchProductosAndCategories`
      // reports its own error, and a permanent spinner would be worse than an
      // honest empty catalog.
      if (!cancelled) setCatalogLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo, user?.localActual?.id]);

  // Discount rules travel with the catalog: fetched once when the period
  // opens, then evaluated locally on every cart change. `getActiveDiscountRules`
  // swallows its own failures — no rules means no discount, which beats
  // blocking a sale over a promotion.
  useEffect(() => {
    const tiendaId = user?.localActual?.id;
    if (!periodo || !tiendaId) return;
    void useDiscountRulesStore.getState().loadRules(tiendaId);
    // Warmed here rather than when the checkout mounts, so the cash-drawer
    // aggregation is already done by the time the cashier presses "cobrar".
    if (periodo.id) {
      void useCashBalanceStore.getState().ensure(tiendaId, periodo.id);
    }
  }, [periodo, user?.localActual?.id]);

  const handleCodigoAsociado = (
    producto: IProductoTiendaPos,
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

  // `periodo && !catalogLoaded` is what closes the gap the cashier used to
  // see: the initial load finishing turned the spinner off while the catalog
  // had not even been asked for yet, so the POS appeared complete and empty
  // for a moment before the products dropped in. With no period there is
  // nothing to wait for — that path opens its own dialog.
  if (loadingContext || loading || (periodo && !catalogLoaded)) {
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
          // Leída de la variable CSS que publica useOnScreenKeyboard, no de
          // estado de React: la altura cambia en cada frame mientras el
          // teclado se abre, y pasarla por estado re-renderizaba el POS entero
          // una vez por frame. El fallback cubre el instante previo a la
          // primera medición.
          height: `var(${VISUAL_VIEWPORT_HEIGHT_VAR}, 100dvh)`,
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
          {/* Sin `transition` sobre `mt`: animar un margen es animar el
              layout, y aquí abajo cuelga el catálogo entero — eran ~12 frames
              de re-maquetado de todas las tarjetas justo mientras el teclado
              intentaba abrirse. El colapso ahora es instantáneo. */}
          <Box
            ref={posHeaderRef}
            sx={{ mt: searchMode ? `-${headerHeight}px` : 0 }}
          >
            {/* El `backdrop-filter` que había aquí desenfocaba un fondo ya
                opaco al 95%: coste de GPU sin efecto visible, y encima sobre
                un subárbol que se desplaza al buscar. */}
            <Box
              sx={{
                bgcolor: "rgba(255, 255, 255, 0.95)",
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
                <CurrencyDisplayToggle />
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
        {/* El `column-reverse` del modo búsqueda vive ahora dentro de
            PosProductGrid, no aquí: mientras estuvo en este contenedor, la
            grilla tenía que devolver un fragmento para que las tarjetas
            fueran hijas directas, y alternar entre `<Box>` y fragmento hacía
            que React desmontara y volviera a montar el catálogo entero en el
            DOM cada vez que se tocaba el buscador. */}
        <Box
          ref={posScrollCallbackRef}
          sx={{
            flex: 1,
            minWidth: 0,
            overflow: "auto",
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
            emptyMessage={emptyMessage}
            // Debounced, not raw: the highlight marks which of the *rendered*
            // results is a prefix match, so it has to be driven by the same
            // term that produced them.
            searchQuery={debouncedSearchQuery}
            bottomUp={searchMode}
            scrollElement={posScrollEl}
          />
        </Box>

        {/* Carrito de compras (overlay, solo mobile) */}
        <CartDrawer
          onClose={handleCloseCart}
          open={!showCartPanel && openCart}
          makePay={handleMakePay}
          transferDestinations={transferDestinations}
          cierreId={periodo?.id ?? ""}
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
          onCreateCart={handleCreateCart}
          onRemoveActiveCart={removeActiveCart}
          onRenameCart={renameCart}
          editingCartId={editingCartId}
          onStartEditingCart={handleStartEditingCart}
          editingCartName={editingCartName}
          onEditingCartNameChange={setEditingCartName}
          onStopEditingCart={handleStopEditingCart}
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
          onDismissScannerError={handleDismissScannerError}
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
                  .disponible
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
