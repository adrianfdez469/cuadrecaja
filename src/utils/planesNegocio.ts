export const planesNegocio = {
  FREEMIUM: {
    limiteLocales: 20,
    limiteUsuarios: -1,
    limiteProductos: -1,
    precio: 0,
    moneda: 'USD',
    duracion: 7, // días
    descripcion: 'Plan gratuito por 7 días'
  },
  BASICO: {
    limiteLocales: 2,
    limiteUsuarios: 2,
    limiteProductos: 100,
    precio: 10,
    moneda: 'USD',
    duracion: 30, // días
    descripcion: 'Plan básico mensual'
  },
  SILVER: {
    limiteLocales: 5,
    limiteUsuarios: -1, // ilimitados
    limiteProductos: 500,
    precio: 20,
    moneda: 'USD',
    duracion: 30, // días
    descripcion: 'Plan silver con usuarios ilimitados'
  },
  PREMIUM: {
    limiteLocales: 20,
    limiteUsuarios: -1, // ilimitados
    limiteProductos: -1, // ilimitados
    precio: 30,
    moneda: 'USD',
    duracion: 30, // días
    descripcion: 'Plan premium con productos ilimitados'
  },
  CUSTOM: {
    limiteLocales: -1, // se negocia
    limiteUsuarios: -1, // se negocia
    limiteProductos: -1, // se negocia
    precio: -1, // se negocia
    moneda: 'USD',
    duracion: -1, // se negocia
    descripcion: 'Plan personalizado'
  }
};