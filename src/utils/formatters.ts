/**
 * Utilidades para formatear fechas y monedas de manera consistente
 */

// Configuración de localización para España/Cuba
const LOCALE = 'es-ES';
const CURRENCY_SYMBOL = '$';
const SECONDARY_CURRENCY = 'CUP';

/**
 * Formatea una fecha en formato corto (dd/mm/aaaa)
 */
export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Formatea una fecha en formato largo (día de mes de año)
 */
export const formatDateLong = (date: string | Date): string => {
  return new Date(date).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
};

/**
 * Formatea una hora en formato 24h (HH:mm:ss)
 */
export const formatTime = (date: string | Date): string => {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Formatea una hora en formato corto (HH:mm)
 */
export const formatTimeShort = (date: string | Date): string => {
  return new Date(date).toLocaleTimeString(LOCALE, {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Formatea fecha y hora completa
 */
export const formatDateTime = (date: string | Date): string => {
  return `${formatDate(date)} • ${formatTimeShort(date)}`;
};

/**
 * Formatea una cantidad de dinero con símbolo de moneda
 */
export const formatCurrency = (amount: number): string => {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString(LOCALE, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`;
};

/**
 * Formatea una cantidad de dinero con CUP
 */
export const formatCurrencyCUP = (amount: number): string => {
  return `${amount.toLocaleString(LOCALE, { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })} ${SECONDARY_CURRENCY}`;
};

/**
 * Formatea una cantidad de dinero sin decimales
 */
export const formatCurrencyInteger = (amount: number): string => {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString(LOCALE)}`;
};

/**
 * Formatea un número entero con separadores de miles
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString(LOCALE);
};

/**
 * Formatea un número decimal con precisión específica
 */
export const formatDecimal = (num: number, decimals: number = 2): string => {
  return num.toLocaleString(LOCALE, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  });
};

/**
 * Formatea un porcentaje
 */
export const formatPercentage = (num: number, decimals: number = 1): string => {
  return `${num.toLocaleString(LOCALE, { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })}%`;
};

/**
 * Verifica si una fecha es hoy
 */
export const isToday = (date: string | Date): boolean => {
  const today = new Date().toDateString();
  const checkDate = new Date(date).toDateString();
  return today === checkDate;
};

/**
 * Obtiene el texto relativo de una fecha (hoy, ayer, etc.)
 */
export const getRelativeDate = (date: string | Date): string => {
  const today = new Date();
  const checkDate = new Date(date);
  const diffTime = today.getTime() - checkDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  if (diffDays < 7) return `Hace ${diffDays} días`;
  
  return formatDate(date);
}; 