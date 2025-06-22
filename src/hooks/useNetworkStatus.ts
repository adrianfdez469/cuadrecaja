import { useState, useEffect, useRef } from 'react';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastStatusChange, setLastStatusChange] = useState<Date | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const graceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Verificar estado inicial
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      // Limpiar timeout si existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      setIsOnline(true);
      setLastStatusChange(new Date());
      
      // Marcar que estuvimos offline por un tiempo para evitar redirecciones inmediatas
      if (wasOffline) {
        // Limpiar timeout anterior si existe
        if (graceTimeoutRef.current) {
          clearTimeout(graceTimeoutRef.current);
        }
        
        graceTimeoutRef.current = setTimeout(() => {
          setWasOffline(false);
        }, 5000); // 5 segundos de gracia (aumentado de 3)
      }
    };

    const handleOffline = () => {
      // Dar un pequeño delay antes de marcar como offline
      // para evitar falsos positivos por interrupciones momentáneas
      timeoutRef.current = setTimeout(() => {
        setIsOnline(false);
        setWasOffline(true);
        setLastStatusChange(new Date());
      }, 1000); // 1 segundo de delay
    };

    // Agregar event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificación periódica adicional (cada 30 segundos)
    const intervalId = setInterval(() => {
      const currentOnlineStatus = navigator.onLine;
      if (currentOnlineStatus !== isOnline) {
        if (currentOnlineStatus) {
          handleOnline();
        } else {
          handleOffline();
        }
      }
    }, 30000);

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (graceTimeoutRef.current) {
        clearTimeout(graceTimeoutRef.current);
      }
      clearInterval(intervalId);
    };
  }, [isOnline, wasOffline]);

  return { 
    isOnline, 
    wasOffline, 
    lastStatusChange,
    // Helper para determinar si es un cambio reciente (útil para banners)
    isRecentStatusChange: lastStatusChange && (Date.now() - lastStatusChange.getTime()) < 5000
  };
}; 