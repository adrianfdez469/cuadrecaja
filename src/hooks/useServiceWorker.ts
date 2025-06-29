import { useEffect, useState, useCallback } from 'react';
import { useNetworkStatus } from './useNetworkStatus';

interface ServiceWorkerMessage {
  type: string;
  saleId?: string;
  response?: unknown;
  data?: {
    inProgress?: boolean;
    [key: string]: unknown;
  };
}

interface OfflineSale {
  id: string;
  url: string;
  method: string;
  body: string;
  headers: Record<string, string>;
  timestamp: number;
  attempts: number;
}

export const useServiceWorker = () => {
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<OfflineSale[]>([]);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const { isOnline } = useNetworkStatus();

  // Registrar service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          // Intentar registrar el service worker personalizado primero
          let registration;
          
          try {
            registration = await navigator.serviceWorker.register('/sw-custom.js', {
              scope: '/',
            });
            console.log('🚀 [SW Hook] Service Worker personalizado registrado:', registration.scope);
          } catch (customError) {
            console.log('⚠️ [SW Hook] SW personalizado falló, usando next-pwa:', customError);
            // Fallback al SW de next-pwa
            registration = await navigator.serviceWorker.register('/sw.js', {
              scope: '/',
            });
            console.log('🚀 [SW Hook] Service Worker next-pwa registrado:', registration.scope);
          }

          // Escuchar actualizaciones del SW
          registration.addEventListener('updatefound', () => {
            console.log('🔄 [SW Hook] Nueva versión del SW encontrada');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('✅ [SW Hook] Nueva versión del SW instalada');
                  // Aquí podrías mostrar una notificación al usuario para recargar
                }
              });
            }
          });

          setIsServiceWorkerReady(true);
          
        } catch (error) {
          console.error('❌ [SW Hook] Error registrando Service Worker:', error);
        }
      };

      registerSW();
    }
  }, []);

  // Escuchar mensajes del service worker
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent<ServiceWorkerMessage>) => {
      const { data } = event;
      
      console.log('📨 [SW Hook] Mensaje recibido del SW:', data);
      
      switch (data.type) {
        case 'SALE_SYNCED':
          console.log('✅ [SW Hook] Venta sincronizada:', data.saleId);
          updateOfflineQueue();
          break;
          
        case 'SYNC_PROGRESS':
          setSyncInProgress(data.data?.inProgress || false);
          break;
          
        default:
          console.log('📨 [SW Hook] Mensaje no manejado:', data.type);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    
    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  // Actualizar queue offline desde localStorage
  const updateOfflineQueue = useCallback(() => {
    try {
      const queueData = localStorage.getItem('offline-sales-queue');
      if (queueData) {
        const queue = JSON.parse(queueData) as OfflineSale[];
        setOfflineQueue(queue);
        console.log(`📊 [SW Hook] Queue actualizada: ${queue.length} ventas pendientes`);
      } else {
        setOfflineQueue([]);
      }
    } catch (error) {
      console.error('❌ [SW Hook] Error leyendo queue offline:', error);
      setOfflineQueue([]);
    }
  }, []);

  // Actualizar queue cuando cambie el estado de conexión
  useEffect(() => {
    updateOfflineQueue();
  }, [isOnline, updateOfflineQueue]);

  // Sincronizar ventas manualmente
  const syncOfflineSales = useCallback(async () => {
    if (!isServiceWorkerReady || !isOnline) {
      console.log('⚠️ [SW Hook] No se puede sincronizar: SW no listo o sin conexión');
      return false;
    }

    try {
      setSyncInProgress(true);
      
      // Enviar mensaje al service worker para sincronizar
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_SALES'
        });
        console.log('📤 [SW Hook] Solicitud de sincronización enviada al SW');
        
        // Esperar un poco y actualizar el queue
        setTimeout(() => {
          updateOfflineQueue();
          setSyncInProgress(false);
        }, 2000);
        
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('❌ [SW Hook] Error en sincronización manual:', error);
      setSyncInProgress(false);
      return false;
    }
  }, [isServiceWorkerReady, isOnline, updateOfflineQueue]);

  // Limpiar datos offline
  const clearOfflineData = useCallback(() => {
    if (!isServiceWorkerReady) return;

    try {
      // Limpiar localStorage
      localStorage.removeItem('offline-sales-queue');
      
      // Notificar al service worker
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'CLEAR_OFFLINE_DATA'
        });
      }
      
      setOfflineQueue([]);
      console.log('🗑️ [SW Hook] Datos offline limpiados');
      
    } catch (error) {
      console.error('❌ [SW Hook] Error limpiando datos offline:', error);
    }
  }, [isServiceWorkerReady]);

  // Verificar si hay datos offline
  const hasOfflineData = useCallback(() => {
    return offlineQueue.length > 0;
  }, [offlineQueue]);

  // Obtener estadísticas offline
  const getOfflineStats = useCallback(() => {
    const pendingSales = offlineQueue.length;
    const oldestSale = offlineQueue.length > 0 
      ? Math.min(...offlineQueue.map(sale => sale.timestamp))
      : null;
    
    return {
      pendingSales,
      oldestSaleTimestamp: oldestSale,
      syncInProgress,
      isServiceWorkerReady,
    };
  }, [offlineQueue, syncInProgress, isServiceWorkerReady]);

  // Registrar para background sync (si está disponible)
  const registerBackgroundSync = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('sync' in window.ServiceWorkerRegistration.prototype)) {
      console.log('⚠️ [SW Hook] Background Sync no disponible');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      // Type assertion para background sync
      const syncRegistration = registration as ServiceWorkerRegistration & {
        sync?: {
          register: (tag: string) => Promise<void>;
        };
      };
      if (syncRegistration.sync) {
        await syncRegistration.sync.register('background-sync-sales');
        console.log('✅ [SW Hook] Background sync registrado');
        return true;
      } else {
        console.log('⚠️ [SW Hook] Background Sync no soportado');
        return false;
      }
    } catch (error) {
      console.error('❌ [SW Hook] Error registrando background sync:', error);
      return false;
    }
  }, []);

  // Auto-sync cuando regresa la conexión
  useEffect(() => {
    if (isOnline && hasOfflineData() && isServiceWorkerReady) {
      console.log('🔄 [SW Hook] Conexión restaurada, iniciando auto-sync');
      
      // Registrar background sync
      registerBackgroundSync();
      
      // Sincronizar inmediatamente
      const timeoutId = setTimeout(() => {
        syncOfflineSales();
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [isOnline, isServiceWorkerReady, hasOfflineData, syncOfflineSales, registerBackgroundSync]);

  return {
    // Estado
    isServiceWorkerReady,
    offlineQueue,
    syncInProgress,
    hasOfflineData: hasOfflineData(),
    
    // Funciones
    syncOfflineSales,
    clearOfflineData,
    updateOfflineQueue,
    getOfflineStats,
    registerBackgroundSync,
    
    // Estadísticas
    stats: getOfflineStats(),
  };
}; 