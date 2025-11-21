import { planesNegocio } from '@/utils/planesNegocio';

export const subscriptionPlansForUi = [
  {
    key: 'FREEMIUM',
    name: 'Freemium',
    price: '$0',
    period: 'mes',
    description: 'Plan gratuito por 7 días',
    duration: `${planesNegocio.FREEMIUM.duracion} días de validez`,
    features: [
      `${planesNegocio.FREEMIUM.limiteLocales} locales (tiendas/almacenes)`,
      planesNegocio.FREEMIUM.limiteUsuarios > 0 ?`${planesNegocio.FREEMIUM.limiteUsuarios} usuario`: 'Usuario ilimitado',
      planesNegocio.FREEMIUM.limiteProductos > 0 ?`Hasta ${planesNegocio.FREEMIUM.limiteProductos} productos`: 'Productos ilimitados',
      'Funcionalidades básicas',
      'Soporte por email',
      `Validez: ${planesNegocio.FREEMIUM.duracion} días`
    ],
    recommended: false,
    color: 'info'
  }, {
    key: 'BASICO',
    name: 'Básico',
    price: `$${planesNegocio.BASICO.precio}`,
    period: 'mes',
    description: 'Plan básico mensual',
    duration: `${planesNegocio.BASICO.duracion} días de validez`,
    features: [
      `${planesNegocio.BASICO.limiteLocales} locales (tiendas/almacenes)`,
      `${planesNegocio.BASICO.limiteUsuarios} usuario`,
      `Hasta ${planesNegocio.BASICO.limiteProductos} productos`,
      'Capacitación inicial',
      'Acceso a todas las funcionalidades',
      'Soporte en linea',
      `Validez: ${planesNegocio.BASICO.duracion} días`
    ],
    recommended: false,
    color: 'primary'
  },
  {
    key: 'SILVER',
    name: 'Silver',
    price: `$${planesNegocio.SILVER.precio}`,
    period: 'mes',
    description: 'Plan silver con usuarios ilimitados',
    duration: `${planesNegocio.SILVER.duracion} días de validez`,
    features: [
      `Hasta ${planesNegocio.SILVER.limiteLocales} locales (tiendas/almacenes)`,
      'Usuarios ilimitados',
      `Hasta ${planesNegocio.SILVER.limiteProductos} productos`,
      'Capacitación inicial',
      'Soporte en línea y presencial si es requerido',
      'Acceso a todas las funcionalidades',
      'Soporte prioritario',
      `Validez: ${planesNegocio.SILVER.duracion} días`
    ],
    recommended: true,
    color: 'secondary'
  },
  {
    key: 'PREMIUM',
    name: 'Premium',
    price: `$${planesNegocio.PREMIUM.precio}`,
    period: 'mes',
    description: 'Plan premium con productos ilimitados',
    duration: `${planesNegocio.PREMIUM.duracion} días de validez`,
    features: [
      `Hasta ${planesNegocio.PREMIUM.limiteLocales} locales (tiendas/almacenes)`,
      'Usuarios ilimitados',
      'Productos ilimitados',
      'Capacitación inicial',
      'Soporte en línea y presencial si es requerido',
      'Acceso a todas las funcionalidades',
      'Soporte prioritario',
      'Reportes personalizados para el cliente',
      'Desarrollo de funcionalidades personalizadas',
      'Integración con impresoras',
      `Validez: ${planesNegocio.PREMIUM.duracion} días`
    ],
    recommended: false,
    color: 'warning'
  },
  {
    key: 'CUSTOM',
    name: 'Personalizado',
    price: 'Cotización',
    period: '',
    description: 'Plan personalizado según tus necesidades',
    duration: 'Duración negociable',
    features: [
      'Locales según necesidad (tiendas/almacenes)',
      'Usuarios según necesidad',
      'Productos según necesidad',
      'Funcionalidades personalizadas',
      'Soporte dedicado 24/7',
      'Integración completa',
      'Capacitación incluida',
      'Duración personalizada'
    ],
    recommended: false,
    color: 'success'
  }
];