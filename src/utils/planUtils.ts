import type { IPlan } from "@/schemas/plan";

const fmt = (val: number) => (val === -1 ? "∞" : String(val));

/**
 * What the plan lets you have: locals, people, products.
 *
 * These three are what a buyer actually compares between plans — everything
 * else `buildPlanFeatures` adds is the same in all of them. The landing shows
 * only these, so it needs them without slicing the longer list by index.
 */
export const buildPlanLimits = (plan: IPlan): string[] => [
  `${fmt(plan.limiteLocales)} locales (tiendas/almacenes)`,
  plan.limiteUsuarios === -1
    ? "Usuarios ilimitados"
    : `${plan.limiteUsuarios} usuario${plan.limiteUsuarios !== 1 ? "s" : ""}`,
  plan.limiteProductos === -1
    ? "Productos ilimitados"
    : `Hasta ${plan.limiteProductos} productos`,
];

export const buildPlanFeatures = (plan: IPlan): string[] => {
  const features: string[] = [...buildPlanLimits(plan)];
  if (plan.precio === 0) {
    features.push("Funcionalidades básicas", "Soporte por email");
  } else if (plan.precio === -1) {
    features.push(
      "Funcionalidades personalizadas",
      "Soporte dedicado 24/7",
      "Capacitación incluida",
    );
  } else {
    features.push(
      "Capacitación inicial",
      "Acceso a todas las funcionalidades",
      "Soporte en línea",
    );
  }
  features.push(
    plan.duracion === -1
      ? "Duración personalizada"
      : `Validez: ${plan.duracion} días`,
  );
  return features;
};
