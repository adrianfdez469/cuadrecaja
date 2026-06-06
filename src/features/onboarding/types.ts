import type { Step } from "react-joyride";

export type OnboardingTourId =
  | "gestion-inventario-producto"
  | "pos-primera-venta";

export type OnboardingChainId = "primeros-pasos";

/** Eventos que avanzan el tour cuando el usuario completa una acción. */
export type OnboardingEventType =
  | "drawer_opened"
  | "dialog_create_opened"
  | "dialog_demo_ready"
  | "product_created"
  | "product_added_to_cart"
  | "period_opened"
  | "pos_search_narrowed"
  | "pos_quantity_dialog_opened";

export interface OnboardingEvent {
  type: OnboardingEventType;
  productName?: string;
}

export interface OnboardingStepDefinition {
  /** Selector CSS, p. ej. `[data-tour="gi-create-btn"]` */
  target: string;
  title: string;
  content: string;
  placement?: Step["placement"];
  /** Ruta en la que debe mostrarse este paso */
  pathname?: string;
  /** Avanza automáticamente al llegar a esta ruta */
  advanceOnPathname?: string;
  /** Avanza al recibir este evento */
  advanceOnEvent?: OnboardingEventType;
  /** Permite clic en el elemento resaltado */
  spotlightClicks?: boolean;
  /** Sin botones Siguiente / Atrás — solo acción del usuario */
  hideFooter?: boolean;
  /** Sin overlay oscuro (necesario en modales MUI) */
  hideOverlay?: boolean;
  /** Target fijo para portales / modales */
  isFixed?: boolean;
  /** Muestra botón «Comenzar» (solo pasos intro centrados) */
  showStartButton?: boolean;
  /** Muestra botón «Siguiente» sin exigir acción en el objetivo */
  showNextButton?: boolean;
  /** Texto del botón principal (p. ej. «Finalizar» en el cierre del tour) */
  primaryButtonLabel?: string;
  /** Solo si no hay período de caja abierto (tour POS) */
  onlyWhenNoOpenPeriod?: boolean;
}

export interface OnboardingTourDefinition {
  id: OnboardingTourId;
  permission: string;
  steps: OnboardingStepDefinition[];
}

export interface OnboardingChainDefinition {
  id: OnboardingChainId;
  tourIds: OnboardingTourId[];
  /** Solo tiendas; no almacenes */
  localTypes: ("TIENDA" | "ALMACEN")[];
  blocking: boolean;
}
