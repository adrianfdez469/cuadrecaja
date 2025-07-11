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
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

/**
 * Formatea una hora en formato completo (HH:mm:ss)
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
 * Formatea fecha y hora juntas (dd/mm/aaaa • HH:mm)
 */
export const formatDateTime = (date: string | Date): string => {
  const dateStr = formatDate(date);
  const timeStr = formatTimeShort(date);
  return `${dateStr} • ${timeStr}`;
};

/**
 * Verifica si una fecha es hoy
 */
export const isToday = (date: string | Date): boolean => {
  const today = new Date();
  const checkDate = new Date(date);
  return today.toDateString() === checkDate.toDateString();
};

/**
 * Obtiene una fecha relativa (ayer, hoy, mañana, etc.)
 */
export const getRelativeDate = (date: string | Date): string => {
  const today = new Date();
  const checkDate = new Date(date);
  const diffTime = checkDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays === -1) return 'Ayer';
  if (diffDays > 1 && diffDays <= 7) return `En ${diffDays} días`;
  if (diffDays < -1 && diffDays >= -7) return `Hace ${Math.abs(diffDays)} días`;
  
  return formatDate(date);
};

/**
 * Formatea días restantes con texto descriptivo
 */
export const formatDaysRemaining = (days: number): string => {
  if (days <= 0) return 'Expirado';
  if (days === 1) return '1 día restante';
  if (days <= 7) return `${days} días restantes`;
  if (days <= 30) return `${days} días restantes`;
  
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 semana restante';
  if (weeks <= 4) return `${weeks} semanas restantes`;
  
  const months = Math.floor(days / 30);
  if (months === 1) return '1 mes restante';
  return `${months} meses restantes`;
};

/**
 * Obtiene el color para mostrar días restantes
 */
export const getDaysRemainingColor = (days: number): 'error' | 'warning' | 'success' => {
  if (days <= 0) return 'error';
  if (days <= 7) return 'error';
  if (days <= 30) return 'warning';
  return 'success';
};

/**
 * Formatea una moneda con símbolo $ (formato principal)
 */
export const formatCurrency = (amount: number): string => {
  if(amount) {
    return `${CURRENCY_SYMBOL}${amount.toLocaleString(LOCALE, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  } else {
    return `${CURRENCY_SYMBOL}0.00`;
  }
};

/**
 * Formatea una moneda con CUP (formato secundario)
 */
export const formatCurrencyCUP = (amount: number): string => {
  return `${amount.toLocaleString(LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} ${SECONDARY_CURRENCY}`;
};

/**
 * Formatea una moneda sin decimales
 */
export const formatCurrencyInteger = (amount: number): string => {
  return `${CURRENCY_SYMBOL}${amount.toLocaleString(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
};

/**
 * Formatea un número sin símbolo de moneda
 */
export const formatNumber = (amount: number): string => {
  return amount.toLocaleString(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

/**
 * Formatea un número con decimales
 */
export const formatDecimal = (amount: number, decimals: number = 2): string => {
  return amount.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Formatea un porcentaje
 */
export const formatPercentage = (value: number, decimals: number = 1): string => {
  return `${value.toLocaleString(LOCALE, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}%`;
}; 