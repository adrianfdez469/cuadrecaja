import React from 'react';
import { Chip, Typography, Box } from '@mui/material';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { es } from 'date-fns/locale';

// Formateador de moneda
export const formatCurrency = (value: number | string, currency = 'COP'): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '$0.00';
  
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numValue);
};

// Formateador de números
export const formatNumber = (value: number | string, decimals = 0): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0';
  
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(numValue);
};

// Formateador de fechas
export const formatDate = (value: Date | string, formatStr = 'dd/MM/yyyy'): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  
  if (!isValid(date)) return 'Fecha inválida';
  
  return format(date, formatStr, { locale: es });
};

// Formateador de fecha y hora
export const formatDateTime = (value: Date | string): string => {
  return formatDate(value, 'dd/MM/yyyy HH:mm');
};

// Formateador de fecha relativa
export const formatRelativeDate = (value: Date | string): string => {
  const date = typeof value === 'string' ? new Date(value) : value;
  
  if (!isValid(date)) return 'Fecha inválida';
  
  return formatDistanceToNow(date, { 
    addSuffix: true, 
    locale: es 
  });
};

// Formateador de porcentajes
export const formatPercentage = (value: number | string, decimals = 1): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numValue)) return '0%';
  
  return `${numValue.toFixed(decimals)}%`;
};

// Formateador de estado con chip
export const formatStatus = (
  value: string, 
  statusConfig: Record<string, { label: string; color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' }>
) => {
  const config = statusConfig[value] || { label: value, color: 'default' as const };
  
  return (
    <Chip
      label={config.label}
      color={config.color}
      size="small"
      variant="filled"
    />
  );
};

// Formateador de booleanos
export const formatBoolean = (value: boolean, trueLabel = 'Sí', falseLabel = 'No') => {
  return (
    <Chip
      label={value ? trueLabel : falseLabel}
      color={value ? 'success' : 'default'}
      size="small"
      variant="outlined"
    />
  );
};

// Formateador de texto truncado
export const formatTruncatedText = (value: string, maxLength = 50) => {
  if (!value) return '';
  
  if (value.length <= maxLength) return value;
  
  return (
    <Typography
      variant="body2"
      title={value}
      sx={{
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: maxLength * 8, // Aproximación en pixels
      }}
    >
      {value}
    </Typography>
  );
};

// Formateador de arrays como lista
export const formatArray = (value: any[], separator = ', ', maxItems = 3) => {
  if (!Array.isArray(value) || value.length === 0) return '';
  
  const displayItems = value.slice(0, maxItems);
  const remainingCount = value.length - maxItems;
  
  return (
    <Box>
      <Typography variant="body2">
        {displayItems.join(separator)}
        {remainingCount > 0 && ` (+${remainingCount} más)`}
      </Typography>
    </Box>
  );
};

// Formateador de stock con indicador de color
export const formatStock = (value: number, minStock = 10) => {
  const getColor = () => {
    if (value <= 0) return 'error';
    if (value <= minStock) return 'warning';
    return 'success';
  };
  
  return (
    <Typography
      variant="body2"
      color={getColor()}
      fontWeight={value <= minStock ? 'bold' : 'normal'}
    >
      {formatNumber(value)}
    </Typography>
  );
};

// Formateador de categoría con color
export const formatCategory = (category: { nombre: string; color?: string }) => {
  if (!category) return '';
  
  return (
    <Box display="flex" alignItems="center" gap={1}>
      {category.color && (
        <Box
          sx={{
            width: 16,
            height: 16,
            borderRadius: '50%',
            backgroundColor: category.color,
            border: '1px solid rgba(0, 0, 0, 0.1)',
          }}
        />
      )}
      <Typography variant="body2">
        {category.nombre}
      </Typography>
    </Box>
  );
};

// Formateador de acciones inline
export const formatActions = (actions: Array<{
  label: string;
  onClick: () => void;
  color?: 'primary' | 'secondary' | 'error' | 'warning';
  disabled?: boolean;
}>) => {
  return (
    <Box display="flex" gap={0.5}>
      {actions.map((action, index) => (
        <Chip
          key={index}
          label={action.label}
          onClick={action.onClick}
          color={action.color || 'primary'}
          size="small"
          variant="outlined"
          disabled={action.disabled}
          clickable
        />
      ))}
    </Box>
  );
};

// Utilidad para crear formateadores personalizados
export const createCustomFormatter = <T,>(
  formatter: (value: T, row?: any) => React.ReactNode
) => formatter;

// Configuraciones predefinidas para estados comunes
export const STATUS_CONFIGS = {
  user: {
    ACTIVO: { label: 'Activo', color: 'success' as const },
    INACTIVO: { label: 'Inactivo', color: 'default' as const },
    BLOQUEADO: { label: 'Bloqueado', color: 'error' as const },
  },
  order: {
    PENDIENTE: { label: 'Pendiente', color: 'warning' as const },
    PROCESANDO: { label: 'Procesando', color: 'info' as const },
    COMPLETADO: { label: 'Completado', color: 'success' as const },
    CANCELADO: { label: 'Cancelado', color: 'error' as const },
  },
  payment: {
    EFECTIVO: { label: 'Efectivo', color: 'success' as const },
    TARJETA: { label: 'Tarjeta', color: 'primary' as const },
    TRANSFERENCIA: { label: 'Transferencia', color: 'info' as const },
  },
  stock: {
    ENTRADA: { label: 'Entrada', color: 'success' as const },
    SALIDA: { label: 'Salida', color: 'error' as const },
    AJUSTE: { label: 'Ajuste', color: 'warning' as const },
    VENTA: { label: 'Venta', color: 'info' as const },
  }
}; 