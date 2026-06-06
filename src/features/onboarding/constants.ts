/** Nombre del producto de demostración (visible y fácil de entender). */
export const PRODUCTO_PRUEBA_NOMBRE = "Refresco de prueba";

export const PRODUCTO_PRUEBA_SUGERENCIAS = {
  nombre: PRODUCTO_PRUEBA_NOMBRE,
  categoria: "Bebidas",
  costo: "5",
  precio: "10",
  cantidadInicial: "10",
} as const;

export const ONBOARDING_STORAGE_KEY = "cuadre-onboarding-v2";

export const ONBOARDING_CHAIN_PRIMEROS_PASOS = "primeros-pasos" as const;

export const TOUR_GESTION_INVENTARIO = "gestion-inventario-producto" as const;
export const TOUR_POS_VENTA = "pos-primera-venta" as const;

/** Dispara en POS el diálogo de apertura de período durante el onboarding */
export const ONBOARDING_PROMPT_POS_PERIOD_EVENT = "cuadre-onboarding-prompt-pos-period";

/** Por encima de modales MUI y capas elevadas del POS durante el tour */
export const ONBOARDING_JOYRIDE_Z_INDEX = 13000;
