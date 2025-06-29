import { useState, useEffect, useCallback } from 'react';
import { IProductoTienda } from '@/types/IProducto';
import { ICategory } from '@/types/ICategoria';
import { ICierrePeriodo } from '@/types/ICierre';

interface OfflineData {
  productos: IProductoTienda[];
  categorias: ICategory[];
  periodo: ICierrePeriodo | null;
  tiendaId: string | null;
  usuarioId: string | null;
  lastSync: Date | null;
  version: number;
}

const STORAGE_KEY = 'pos-offline-data';
const CURRENT_VERSION = 1;

const defaultData: OfflineData = {
  productos: [],
  categorias: [],
  periodo: null,
  tiendaId: null,
  usuarioId: null,
  lastSync: null,
  version: CURRENT_VERSION
};

export const useOfflineStorage = () => {
  const [offlineData, setOfflineData] = useState<OfflineData>(defaultData);
  const [isLoading, setIsLoading] = useState(true);
  const [hasOfflineData, setHasOfflineData] = useState(false);

  // Cargar datos del localStorage al inicializar
  useEffect(() => {
    try {
      const storedData = localStorage.getItem(STORAGE_KEY);
      if (storedData) {
        const parsedData = JSON.parse(storedData);
        
        // Verificar versión y migrar si es necesario
        if (parsedData.version !== CURRENT_VERSION) {
          console.log('🔄 [OfflineStorage] Migrando datos de versión', parsedData.version, 'a', CURRENT_VERSION);
          // Aquí se pueden agregar migraciones futuras
          parsedData.version = CURRENT_VERSION;
        }

        // Convertir fechas
        if (parsedData.lastSync) {
          parsedData.lastSync = new Date(parsedData.lastSync);
        }
        if (parsedData.periodo?.fechaInicio) {
          parsedData.periodo.fechaInicio = new Date(parsedData.periodo.fechaInicio);
        }
        if (parsedData.periodo?.fechaFin) {
          parsedData.periodo.fechaFin = new Date(parsedData.periodo.fechaFin);
        }

        setOfflineData(parsedData);
        setHasOfflineData(parsedData.productos.length > 0 || parsedData.categorias.length > 0);
        console.log('✅ [OfflineStorage] Datos offline cargados:', {
          productos: parsedData.productos.length,
          categorias: parsedData.categorias.length,
          periodo: parsedData.periodo?.id,
          lastSync: parsedData.lastSync
        });
      }
    } catch (error) {
      console.error('❌ [OfflineStorage] Error cargando datos offline:', error);
      // En caso de error, limpiar datos corruptos
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Guardar datos en localStorage
  const saveToStorage = useCallback((data: OfflineData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      console.log('💾 [OfflineStorage] Datos guardados offline');
    } catch (error) {
      console.error('❌ [OfflineStorage] Error guardando datos offline:', error);
      
      // Si el error es por espacio, intentar limpiar datos antiguos
      if (error.name === 'QuotaExceededError') {
        try {
          // Mantener solo los datos esenciales
          const essentialData = {
            ...data,
            productos: data.productos.slice(0, 500), // Limitar a 500 productos más recientes
          };
          localStorage.setItem(STORAGE_KEY, JSON.stringify(essentialData));
          console.log('⚠️ [OfflineStorage] Datos guardados con límite por espacio');
        } catch (secondError) {
          console.error('❌ [OfflineStorage] Error crítico guardando datos:', secondError);
        }
      }
    }
  }, []);

  // Actualizar productos offline
  const updateProductos = useCallback((productos: IProductoTienda[], tiendaId: string, usuarioId: string) => {
    const newData = {
      ...offlineData,
      productos,
      tiendaId,
      usuarioId,
      lastSync: new Date(),
      version: CURRENT_VERSION
    };
    
    setOfflineData(newData);
    setHasOfflineData(productos.length > 0 || newData.categorias.length > 0);
    saveToStorage(newData);
  }, [offlineData, saveToStorage]);

  // Actualizar categorías offline
  const updateCategorias = useCallback((categorias: ICategory[]) => {
    const newData = {
      ...offlineData,
      categorias,
      lastSync: new Date(),
      version: CURRENT_VERSION
    };
    
    setOfflineData(newData);
    setHasOfflineData(newData.productos.length > 0 || categorias.length > 0);
    saveToStorage(newData);
  }, [offlineData, saveToStorage]);

  // Actualizar período offline
  const updatePeriodo = useCallback((periodo: ICierrePeriodo | null) => {
    const newData = {
      ...offlineData,
      periodo,
      lastSync: new Date(),
      version: CURRENT_VERSION
    };
    
    setOfflineData(newData);
    saveToStorage(newData);
  }, [offlineData, saveToStorage]);

  // Actualizar existencia de producto localmente
  const updateProductoExistencia = useCallback((productoTiendaId: string, nuevaExistencia: number) => {
    const newData = {
      ...offlineData,
      productos: offlineData.productos.map(p => 
        p.productoTiendaId === productoTiendaId 
          ? { ...p, existencia: nuevaExistencia }
          : p
      ),
      version: CURRENT_VERSION
    };
    
    setOfflineData(newData);
    saveToStorage(newData);
  }, [offlineData, saveToStorage]);

  // Sincronizar todos los datos
  const syncAllData = useCallback((
    productos: IProductoTienda[], 
    categorias: ICategory[], 
    periodo: ICierrePeriodo | null,
    tiendaId: string,
    usuarioId: string
  ) => {
    const newData = {
      productos,
      categorias,
      periodo,
      tiendaId,
      usuarioId,
      lastSync: new Date(),
      version: CURRENT_VERSION
    };
    
    setOfflineData(newData);
    setHasOfflineData(productos.length > 0 || categorias.length > 0);
    saveToStorage(newData);
    
    console.log('🔄 [OfflineStorage] Sincronización completa:', {
      productos: productos.length,
      categorias: categorias.length,
      periodo: periodo?.id,
      tiendaId,
      usuarioId
    });
  }, [saveToStorage]);

  // Limpiar datos offline
  const clearOfflineData = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setOfflineData(defaultData);
    setHasOfflineData(false);
    console.log('🗑️ [OfflineStorage] Datos offline limpiados');
  }, []);

  // Verificar si los datos están actualizados
  const isDataStale = useCallback((maxAgeHours: number = 24) => {
    if (!offlineData.lastSync) return true;
    
    const now = new Date();
    const ageInHours = (now.getTime() - offlineData.lastSync.getTime()) / (1000 * 60 * 60);
    
    return ageInHours > maxAgeHours;
  }, [offlineData.lastSync]);

  // Obtener estadísticas de datos offline
  const getStorageStats = useCallback(() => {
    const dataSize = JSON.stringify(offlineData).length;
    const maxSize = 5 * 1024 * 1024; // 5MB aproximado
    
    return {
      dataSize,
      maxSize,
      usagePercentage: (dataSize / maxSize) * 100,
      productos: offlineData.productos.length,
      categorias: offlineData.categorias.length,
      lastSync: offlineData.lastSync,
      isStale: isDataStale()
    };
  }, [offlineData, isDataStale]);

  return {
    // Datos
    productos: offlineData.productos,
    categorias: offlineData.categorias,
    periodo: offlineData.periodo,
    tiendaId: offlineData.tiendaId,
    usuarioId: offlineData.usuarioId,
    lastSync: offlineData.lastSync,
    
    // Estados
    isLoading,
    hasOfflineData,
    
    // Métodos
    updateProductos,
    updateCategorias,
    updatePeriodo,
    updateProductoExistencia,
    syncAllData,
    clearOfflineData,
    isDataStale,
    getStorageStats
  };
}; 