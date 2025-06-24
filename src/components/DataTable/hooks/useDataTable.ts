import { useState, useCallback, useMemo } from 'react';

export interface UseDataTableOptions<T> {
  data: T[];
  initialPageSize?: number;
  initialSortBy?: string;
  initialSortDirection?: 'asc' | 'desc';
  searchFields?: (keyof T)[];
}

export interface UseDataTableReturn<T> {
  // Estados
  page: number;
  pageSize: number;
  searchTerm: string;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  loading: boolean;
  error: string | null;
  
  // Datos procesados
  filteredData: T[];
  sortedData: T[];
  paginatedData: T[];
  totalRows: number;
  
  // Acciones
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setSearchTerm: (term: string) => void;
  setSortBy: (field: string) => void;
  setSortDirection: (direction: 'asc' | 'desc') => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  handleSort: (field: string) => void;
  handlePageChange: (event: unknown, newPage: number) => void;
  handlePageSizeChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  resetFilters: () => void;
  refresh: () => void;
}

export function useDataTable<T extends Record<string, any>>({
  data,
  initialPageSize = 10,
  initialSortBy = '',
  initialSortDirection = 'asc',
  searchFields = []
}: UseDataTableOptions<T>): UseDataTableReturn<T> {
  
  // Estados
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState(initialSortBy);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(initialSortDirection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Datos filtrados por búsqueda
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    const searchLower = searchTerm.toLowerCase();
    return data.filter(row => {
      // Si se especifican campos de búsqueda, usar solo esos
      if (searchFields.length > 0) {
        return searchFields.some(field => {
          const value = row[field];
          return value && value.toString().toLowerCase().includes(searchLower);
        });
      }
      
      // Si no se especifican, buscar en todos los campos
      return Object.values(row).some(value => 
        value && value.toString().toLowerCase().includes(searchLower)
      );
    });
  }, [data, searchTerm, searchFields]);

  // Datos ordenados
  const sortedData = useMemo(() => {
    if (!sortBy) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      // Manejo de valores nulos/undefined
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;
      
      // Comparación de números
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // Comparación de fechas
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortDirection === 'asc' 
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }
      
      // Comparación de strings (por defecto)
      const aStr = aValue.toString().toLowerCase();
      const bStr = bValue.toString().toLowerCase();
      
      if (aStr < bStr) return sortDirection === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortBy, sortDirection]);

  // Datos paginados
  const paginatedData = useMemo(() => {
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  // Handlers
  const handleSort = useCallback((field: string) => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
    setPage(0); // Reset a la primera página al ordenar
  }, [sortBy, sortDirection]);

  const handlePageChange = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = parseInt(event.target.value, 10);
    setPageSize(newSize);
    setPage(0); // Reset a la primera página al cambiar el tamaño
  }, []);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setSortBy(initialSortBy);
    setSortDirection(initialSortDirection);
    setPage(0);
  }, [initialSortBy, initialSortDirection]);

  const refresh = useCallback(() => {
    // Este método puede ser extendido para recargar datos desde una API
    setError(null);
    setPage(0);
  }, []);

  // Funciones de actualización con reset de página
  const setSearchTermWithReset = useCallback((term: string) => {
    setSearchTerm(term);
    setPage(0);
  }, []);

  const setPageSizeWithReset = useCallback((size: number) => {
    setPageSize(size);
    setPage(0);
  }, []);

  return {
    // Estados
    page,
    pageSize,
    searchTerm,
    sortBy,
    sortDirection,
    loading,
    error,
    
    // Datos procesados
    filteredData,
    sortedData,
    paginatedData,
    totalRows: sortedData.length,
    
    // Acciones
    setPage,
    setPageSize: setPageSizeWithReset,
    setSearchTerm: setSearchTermWithReset,
    setSortBy,
    setSortDirection,
    setLoading,
    setError,
    handleSort,
    handlePageChange,
    handlePageSizeChange,
    resetFilters,
    refresh
  };
} 