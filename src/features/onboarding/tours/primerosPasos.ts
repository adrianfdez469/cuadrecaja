import {
  ONBOARDING_CHAIN_PRIMEROS_PASOS,
  PRODUCTO_PRUEBA_NOMBRE,
  TOUR_GESTION_INVENTARIO,
  TOUR_POS_VENTA,
} from "../constants";
import type { OnboardingChainDefinition, OnboardingTourDefinition } from "../types";

export const tourGestionInventario: OnboardingTourDefinition = {
  id: TOUR_GESTION_INVENTARIO,
  permission: "configuracion.gestion-inventario.acceder",
  steps: [
    {
      target: "body",
      title: "Tu primer producto",
      content:
        "Te guiamos paso a paso para crear un producto y venderlo en el punto de venta. Abre el menú lateral cuando estés listo.",
      placement: "center",
      hideFooter: false,
      showStartButton: true,
      spotlightClicks: false,
    },
    {
      target: '[data-tour="nav-menu-button"]',
      title: "Abre el menú",
      content: "Pulsa aquí para abrir el menú de navegación.",
      placement: "bottom",
      hideFooter: true,
      spotlightClicks: true,
      advanceOnEvent: "drawer_opened",
    },
    {
      target: '[data-tour="nav-gestion-inventario"]',
      title: "Gestión de productos",
      content:
        "Entra en Configuración → Gestión Unificada de Productos. Ahí creas productos con precio y stock para esta tienda.",
      placement: "right",
      hideFooter: true,
      spotlightClicks: true,
      advanceOnPathname: "/configuracion/gestion-inventario",
    },
    {
      target: '[data-tour="gi-create-btn"]',
      title: "Nuevo producto",
      content: "Pulsa para abrir el formulario de alta.",
      pathname: "/configuracion/gestion-inventario",
      placement: "bottom",
      hideFooter: true,
      spotlightClicks: true,
      advanceOnEvent: "dialog_create_opened",
    },
    {
      target: '[data-tour="gi-create-dialog"]',
      title: "Producto de prueba",
      content:
        "Los campos ya vienen con datos de ejemplo. Revísalos y pulsa «Crear producto» cuando estés listo.",
      pathname: "/configuracion/gestion-inventario",
      placement: "center",
      hideFooter: true,
      spotlightClicks: true,
      hideOverlay: true,
      isFixed: true,
      advanceOnEvent: "dialog_demo_ready",
    },
    {
      target: '[data-tour="gi-create-save-btn"]',
      title: "Guardar producto",
      content: "Pulsa aquí para crear el producto en esta tienda.",
      pathname: "/configuracion/gestion-inventario",
      placement: "top",
      hideFooter: true,
      spotlightClicks: true,
      hideOverlay: true,
      isFixed: true,
      advanceOnEvent: "product_created",
    },
    {
      target: '[data-tour="gi-product-table"]',
      title: "Producto listo",
      content: `Si ves «${PRODUCTO_PRUEBA_NOMBRE}» en la lista, el producto ya está en esta tienda. Pulsa continuar para seguir con la guía.`,
      pathname: "/configuracion/gestion-inventario",
      placement: "top",
      hideFooter: false,
      showStartButton: true,
      spotlightClicks: false,
    },
  ],
};

/** Pasos informativos de la barra superior del POS (después del período, si aplica). */
const posToolbarTourSteps: OnboardingTourDefinition["steps"] = [
  {
    target: '[data-tour="pos-toolbar-periodo"]',
    title: "Período de caja",
    content:
      "Indica el período de venta abierto. Todas las ventas del POS se registran dentro de este período.",
    pathname: "/pos",
    placement: "bottom",
    showNextButton: true,
    spotlightClicks: false,
  },
  {
    target: '[data-tour="pos-toolbar-refresh"]',
    title: "Actualizar datos",
    content:
      "Sincroniza productos, precios y existencias con el servidor para vender con información al día.",
    pathname: "/pos",
    placement: "bottom",
    showNextButton: true,
    spotlightClicks: false,
  },
  {
    target: '[data-tour="pos-toolbar-punto-partida"]',
    title: "Punto de partida",
    content:
      "Consulta un resumen del día: ventas, montos y estado del período sin salir del POS.",
    pathname: "/pos",
    placement: "bottom",
    showNextButton: true,
    spotlightClicks: false,
  },
  {
    target: '[data-tour="pos-toolbar-sync"]',
    title: "Sincronizar ventas",
    content:
      "Revisa y envía al servidor las ventas guardadas sin conexión. El icono avisa si hay pendientes.",
    pathname: "/pos",
    placement: "bottom",
    showNextButton: true,
    spotlightClicks: false,
  },
  {
    target: '[data-tour="pos-toolbar-mis-ventas"]',
    title: "Mis ventas",
    content:
      "Abre el listado de tus ventas del período actual para consultarlas o gestionarlas.",
    pathname: "/pos",
    placement: "bottom",
    showNextButton: true,
    spotlightClicks: false,
  },
  {
    target: '[data-tour="pos-toolbar-connection"]',
    title: "Estado de conexión",
    content:
      "Muestra si el dispositivo está en línea. Sin internet puedes seguir vendiendo y sincronizar después.",
    pathname: "/pos",
    placement: "bottom",
    showNextButton: true,
    spotlightClicks: false,
  },
    {
      target: '[data-tour="pos-toolbar-scanner"]',
      title: "Escanear códigos",
      content:
        "Usa la cámara para QR o la pistola de códigos de barras para agregar productos al carrito más rápido.",
      pathname: "/pos",
      placement: "top",
      showNextButton: true,
      spotlightClicks: false,
    },
  {
    target: '[data-tour="pos-category-first"]',
    title: "Categorías de productos",
    content:
      "Cada tarjeta es una categoría (como esta). Al tocarla verás sus productos para añadirlos al carrito sin usar el buscador.",
    pathname: "/pos",
    placement: "bottom",
    showNextButton: true,
    spotlightClicks: false,
  },
];

export const tourPosVenta: OnboardingTourDefinition = {
  id: TOUR_POS_VENTA,
  permission: "operaciones.pos-venta.acceder",
  steps: [
    {
      target: "body",
      title: "Vender en el POS",
      content:
        "En el punto de venta buscarás productos, elegirás cantidades y las añadirás al carrito. Te mostramos la interfaz para que la explores con confianza.",
      placement: "center",
      hideFooter: false,
      showStartButton: true,
      spotlightClicks: false,
    },
    {
      target: '[data-tour="nav-menu-button"]',
      title: "Ir al punto de venta",
      content: "Abre el menú para ir al POS.",
      placement: "bottom",
      hideFooter: true,
      spotlightClicks: true,
      advanceOnEvent: "drawer_opened",
    },
    {
      target: '[data-tour="nav-pos"]',
      title: "Punto de venta",
      content: "Entra al POS para conocer las herramientas de venta.",
      placement: "right",
      hideFooter: true,
      spotlightClicks: true,
      advanceOnPathname: "/pos",
    },
    {
      target: '[data-tour="pos-period-confirm"]',
      title: "Abrir período de caja",
      content:
        "Para vender en el POS necesitas un período abierto. Pulsa «Sí» en el cuadro de confirmación para crearlo.",
      pathname: "/pos",
      placement: "top",
      hideFooter: true,
      spotlightClicks: true,
      hideOverlay: true,
      isFixed: true,
      onlyWhenNoOpenPeriod: true,
      advanceOnEvent: "period_opened",
    },
    ...posToolbarTourSteps,
    {
      target: "body",
      title: "Tu primera venta",
      content:
        "Busca un producto, selecciónalo y añade la cantidad al carrito. Puedes usar el buscador, las categorías o el escáner. Explora la pantalla a tu ritmo.",
      pathname: "/pos",
      placement: "center",
      showNextButton: true,
      spotlightClicks: false,
    },
    {
      target: '[data-tour="pos-search"]',
      title: "Busca y vende",
      content:
        "Cuando completes la guía podrás buscar productos, elegirlos y añadir cantidades al carrito. Pulsa «Completar guía» para usar el POS con total libertad.",
      pathname: "/pos",
      placement: "top",
      hideFooter: false,
      primaryButtonLabel: "Completar guía",
      spotlightClicks: false,
      hideOverlay: true,
      isFixed: true,
    },
  ],
};

export const ONBOARDING_TOURS: OnboardingTourDefinition[] = [
  tourGestionInventario,
  tourPosVenta,
];

export const ONBOARDING_CHAINS: OnboardingChainDefinition[] = [
  {
    id: ONBOARDING_CHAIN_PRIMEROS_PASOS,
    tourIds: [TOUR_GESTION_INVENTARIO, TOUR_POS_VENTA],
    localTypes: ["TIENDA"],
    blocking: true,
  },
];

export function getTourById(id: string): OnboardingTourDefinition | undefined {
  return ONBOARDING_TOURS.find((t) => t.id === id);
}

export function getChainById(id: string): OnboardingChainDefinition | undefined {
  return ONBOARDING_CHAINS.find((c) => c.id === id);
}
