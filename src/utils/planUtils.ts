import type { IPlan } from '@/schemas/plan';

export const buildPlanFeatures = (plan: IPlan): string[] => {
  const fmt = (val: number) => (val === -1 ? '∞' : String(val));
  const features: string[] = [];
  features.push(`${fmt(plan.limiteLocales)} locales (tiendas/almacenes)`);
  features.push(plan.limiteUsuarios === -1 ? 'Usuarios ilimitados' : `${plan.limiteUsuarios} usuario${plan.limiteUsuarios !== 1 ? 's' : ''}`);
  features.push(plan.limiteProductos === -1 ? 'Productos ilimitados' : `Hasta ${plan.limiteProductos} productos`);
  if (plan.precio === 0) {
    features.push('Funcionalidades básicas', 'Soporte por email');
  } else if (plan.precio === -1) {
    features.push('Funcionalidades personalizadas', 'Soporte dedicado 24/7', 'Capacitación incluida');
  } else {
    features.push('Capacitación inicial', 'Acceso a todas las funcionalidades', 'Soporte en línea');
  }
  features.push(plan.duracion === -1 ? 'Duración personalizada' : `Validez: ${plan.duracion} días`);
  return features;
};
