import { useState, useEffect } from 'react';

interface NetworkStatusHook {
  isOnline: boolean;
  wasOffline: boolean;
  lastStatusChange: Date | null;
  connectionQuality: 'good' | 'poor' | 'offline';
  isConnecting: boolean;
}

// ===== SINGLETON PARA ESTADO DE RED =====
// Esto evita múltiples peticiones de favicon desde diferentes componentes

class NetworkStatusManager {
  private static instance: NetworkStatusManager;
  private subscribers: Set<(status: NetworkStatusHook) => void> = new Set();
  private currentStatus: NetworkStatusHook = {
    isOnline: true,
    wasOffline: false,
    lastStatusChange: null,
    connectionQuality: 'good',
    isConnecting: false
  };
  
  private connectivityCheckInterval: NodeJS.Timeout | null = null;
  private timeoutRef: NodeJS.Timeout | null = null;
  private graceTimeoutRef: NodeJS.Timeout | null = null;
  private lastConnectivityCheck: Date | null = null;
  private isCheckingConnectivity = false;
  private cleanup: (() => void) | null = null;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): NetworkStatusManager {
    if (!NetworkStatusManager.instance) {
      NetworkStatusManager.instance = new NetworkStatusManager();
    }
    return NetworkStatusManager.instance;
  }

  public subscribe(callback: (status: NetworkStatusHook) => void): () => void {
    this.subscribers.add(callback);
    // Enviar estado actual inmediatamente
    callback(this.currentStatus);
    
    return () => {
      this.subscribers.delete(callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.currentStatus));
  }

  private updateStatus(updates: Partial<NetworkStatusHook>) {
    this.currentStatus = { ...this.currentStatus, ...updates };
    this.notifySubscribers();
  }

  // Verificación real de conectividad mediante petición HTTP (SINGLETON)
  private async checkRealConnectivity(): Promise<boolean> {
    // Evitar múltiples verificaciones simultáneas
    if (this.isCheckingConnectivity) {
      return this.currentStatus.isOnline;
    }

    // Throttling: no verificar más de una vez cada 10 segundos
    if (this.lastConnectivityCheck) {
      const timeSinceLastCheck = Date.now() - this.lastConnectivityCheck.getTime();
      if (timeSinceLastCheck < 10000) { // 10 segundos
        console.log('🔍 [NetworkStatus] Throttling conectividad check');
        return this.currentStatus.isOnline;
      }
    }

    this.isCheckingConnectivity = true;

    try {
      // Usar una imagen pequeña del mismo dominio para evitar CORS
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout
      
      console.log('🔍 [NetworkStatus] Verificando conectividad real (SINGLETON)');
      const response = await fetch('/favicon.ico?' + Date.now(), {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      this.lastConnectivityCheck = new Date();
      
      if (response.ok) {
        this.updateStatus({ connectionQuality: 'good' });
        return true;
      } else {
        this.updateStatus({ connectionQuality: 'poor' });
        return false;
      }
    } catch (error) {
      console.log('🔍 [NetworkStatus] Verificación de conectividad falló:', (error as Error).name);
      this.lastConnectivityCheck = new Date();
      this.updateStatus({ connectionQuality: 'offline' });
      return false;
    } finally {
      this.isCheckingConnectivity = false;
    }
  }

  // Verificación periódica de conectividad (SINGLETON)
  private scheduleConnectivityCheck() {
    if (this.connectivityCheckInterval) {
      clearInterval(this.connectivityCheckInterval);
    }

    this.connectivityCheckInterval = setInterval(async () => {
      // Solo verificar si navigator.onLine dice que estamos online
      if (navigator.onLine) {
        const reallyOnline = await this.checkRealConnectivity();
        
        // Si navigator.onLine dice online pero la verificación falla
        if (!reallyOnline && this.currentStatus.isOnline) {
          console.log('🔍 [NetworkStatus] Detectada desconexión real pese a navigator.onLine');
          this.updateStatus({
            isOnline: false,
            wasOffline: true,
            lastStatusChange: new Date(),
            connectionQuality: 'offline'
          });
        }
        // Si estábamos offline pero ahora tenemos conectividad real
        else if (reallyOnline && !this.currentStatus.isOnline) {
          console.log('🔍 [NetworkStatus] Conectividad real restaurada');
          this.updateStatus({
            isOnline: true,
            lastStatusChange: new Date(),
            connectionQuality: 'good'
          });
          
          // Período de gracia para evitar redirecciones inmediatas
          if (this.graceTimeoutRef) {
            clearTimeout(this.graceTimeoutRef);
          }
          
          this.graceTimeoutRef = setTimeout(() => {
            this.updateStatus({ wasOffline: false });
          }, 10000); // 10 segundos de gracia
        }
      }
    }, 30000); // Aumentado a 30 segundos para reducir peticiones
  }

  private initialize() {
    // Verificar estado inicial
    const initialStatus = navigator.onLine;
    this.updateStatus({
      isOnline: initialStatus,
      connectionQuality: initialStatus ? 'good' : 'offline'
    });
    
    // Verificación inicial de conectividad real (solo una vez)
    if (initialStatus) {
      this.checkRealConnectivity().then(reallyOnline => {
        if (!reallyOnline) {
          this.updateStatus({
            isOnline: false,
            connectionQuality: 'offline'
          });
        }
      });
    }

    const handleOnline = async () => {
      console.log('🔍 [NetworkStatus] Evento online detectado (SINGLETON)');
      this.updateStatus({ isConnecting: true });
      
      // Limpiar timeout si existe
      if (this.timeoutRef) {
        clearTimeout(this.timeoutRef);
        this.timeoutRef = null;
      }
      
      // Verificar conectividad real antes de marcar como online
      const reallyOnline = await this.checkRealConnectivity();
      
      if (reallyOnline) {
        this.updateStatus({
          isOnline: true,
          lastStatusChange: new Date(),
          connectionQuality: 'good',
          wasOffline: true // Marcar que estuvimos offline
        });
        
        // Limpiar timeout anterior si existe
        if (this.graceTimeoutRef) {
          clearTimeout(this.graceTimeoutRef);
        }
        
        this.graceTimeoutRef = setTimeout(() => {
          this.updateStatus({ wasOffline: false });
        }, 10000); // 10 segundos de gracia
      } else {
        console.log('🔍 [NetworkStatus] Evento online pero sin conectividad real');
        this.updateStatus({ connectionQuality: 'poor' });
      }
      
      this.updateStatus({ isConnecting: false });
    };

    const handleOffline = () => {
      console.log('🔍 [NetworkStatus] Evento offline detectado (SINGLETON)');
      this.updateStatus({ isConnecting: false });
      
      // Dar un pequeño delay antes de marcar como offline
      this.timeoutRef = setTimeout(() => {
        this.updateStatus({
          isOnline: false,
          wasOffline: true,
          lastStatusChange: new Date(),
          connectionQuality: 'offline'
        });
      }, 2000); // 2 segundos de delay
    };

    // Verificación adicional basada en visibilidad de página
    const handleVisibilityChange = () => {
      if (!document.hidden && navigator.onLine) {
        // Cuando la página vuelve a ser visible y supuestamente estamos online,
        // verificar conectividad real (con throttling)
        this.checkRealConnectivity().then(reallyOnline => {
          if (reallyOnline && !this.currentStatus.isOnline) {
            console.log('🔍 [NetworkStatus] Conectividad restaurada al volver a la página (SINGLETON)');
            this.updateStatus({
              isOnline: true,
              lastStatusChange: new Date(),
              connectionQuality: 'good'
            });
          }
        });
      }
    };

    // Agregar event listeners (solo una vez)
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Iniciar verificación periódica (solo una vez)
    this.scheduleConnectivityCheck();

    // Cleanup cuando no hay más suscriptores
    this.cleanup = () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      if (this.timeoutRef) {
        clearTimeout(this.timeoutRef);
      }
      if (this.graceTimeoutRef) {
        clearTimeout(this.graceTimeoutRef);
      }
      if (this.connectivityCheckInterval) {
        clearInterval(this.connectivityCheckInterval);
      }
    };
  }
}

// ===== HOOK OPTIMIZADO =====
export const useNetworkStatus = (): NetworkStatusHook => {
  const [status, setStatus] = useState<NetworkStatusHook>({
    isOnline: true,
    wasOffline: false,
    lastStatusChange: null,
    connectionQuality: 'good',
    isConnecting: false
  });

  useEffect(() => {
    const manager = NetworkStatusManager.getInstance();
    const unsubscribe = manager.subscribe(setStatus);
    
    return unsubscribe;
  }, []);

  return status;
}; 