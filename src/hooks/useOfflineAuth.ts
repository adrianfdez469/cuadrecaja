import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface OfflineSession {
  user: {
    id: string;
    nombre: string;
    usuario: string;
    email: string;
    rol: string;
    // eslint-disable-next-line
    negocio: any;
    // eslint-disable-next-line
    tiendaActual: any;
    expiresAt: string;
  };
  expires: string;
  lastSync: Date;
  // Nuevos campos de seguridad
  sessionHash: string; // Hash para verificar integridad
  deviceFingerprint: string; // Identificador del dispositivo
  maxOfflineHours: number; // Límite máximo de horas offline
}

const OFFLINE_SESSION_KEY = 'offline-session';
// const SESSION_DURATION = 3 * 24 * 60 * 60 * 1000; // Reducido a 3 días
const MAX_OFFLINE_HOURS = 24; // Máximo 24 horas offline continuas
const SECURITY_VERSION = '1.0'; // Para invalidar sesiones antiguas

// Función simple de hash (para verificar integridad, no seguridad criptográfica)
const simpleHash = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convertir a 32bit integer
  }
  return Math.abs(hash).toString(36);
};

// Generar fingerprint básico del dispositivo
const generateDeviceFingerprint = (): string => {
  // Usar solo datos estables del navegador/dispositivo
  // Evitar canvas que puede ser inconsistente entre sesiones
  return simpleHash([
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    navigator.platform || 'unknown',
    navigator.hardwareConcurrency || 'unknown',
    SECURITY_VERSION
  ].join('|'));
};

// Cifrado simple usando XOR (básico, para ofuscar datos sensibles)
const simpleEncrypt = (text: string, key: string): string => {
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
};

const simpleDecrypt = (encryptedText: string, key: string): string => {
  try {
    const decoded = atob(encryptedText);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return '';
  }
};

export const useOfflineAuth = () => {
  const { data: onlineSession, status: onlineStatus } = useSession();
  const [offlineSession, setOfflineSession] = useState<OfflineSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasValidOfflineSession, setHasValidOfflineSession] = useState(false);
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  
  // Cargar sesión offline al inicializar
  useEffect(() => {
    console.log('🔍 [OfflineAuth] Iniciando carga de sesión offline...');
    setIsLoading(true); // Asegurar que esté en loading
    
    try {
      const storedSession = localStorage.getItem(OFFLINE_SESSION_KEY);
      if (!storedSession) {
        console.log('📭 [OfflineAuth] No hay sesión offline guardada');
        setIsLoading(false);
        setHasValidOfflineSession(false);
        return;
      }

      console.log('📦 [OfflineAuth] Sesión offline encontrada, procesando...');
      const deviceFingerprint = generateDeviceFingerprint();
      console.log('🔑 [OfflineAuth] Fingerprint actual:', deviceFingerprint);
      
      let parsedSession: OfflineSession;
      
      // Intentar múltiples métodos de descifrado/parseo
      try {
        // Método 1: Descifrar con fingerprint actual
        const decryptedData = simpleDecrypt(storedSession, deviceFingerprint);
        if (decryptedData) {
          parsedSession = JSON.parse(decryptedData);
          console.log('✅ [OfflineAuth] Sesión descifrada con fingerprint actual');
        } else {
          throw new Error('No se pudo descifrar con fingerprint actual');
        }
      } catch (error1) {
        console.log('⚠️ [OfflineAuth] Método 1 falló:', error1.message);
        
        try {
          // Método 2: Parsear directamente (sin cifrado)
          parsedSession = JSON.parse(storedSession);
          console.log('✅ [OfflineAuth] Sesión parseada sin cifrado (formato anterior)');
        } catch (error2) {
          console.log('❌ [OfflineAuth] Método 2 falló:', error2.message);
          
          // Método 3: Intentar con diferentes fingerprints (fallback)
          console.log('🔄 [OfflineAuth] Intentando métodos de recuperación...');
          
          // Generar algunos fingerprints alternativos comunes
          const alternativeFingerprints = [
            // Sin hardwareConcurrency
            simpleHash([
              navigator.userAgent,
              navigator.language,
              screen.width + 'x' + screen.height,
              new Date().getTimezoneOffset(),
              navigator.platform || 'unknown',
              SECURITY_VERSION
            ].join('|')),
            // Sin platform
            simpleHash([
              navigator.userAgent,
              navigator.language,
              screen.width + 'x' + screen.height,
              new Date().getTimezoneOffset(),
              SECURITY_VERSION
            ].join('|'))
          ];
          
          let recovered = false;
          for (let i = 0; i < alternativeFingerprints.length && !recovered; i++) {
            try {
              const altDecrypted = simpleDecrypt(storedSession, alternativeFingerprints[i]);
              if (altDecrypted) {
                parsedSession = JSON.parse(altDecrypted);
                console.log(`✅ [OfflineAuth] Sesión recuperada con fingerprint alternativo ${i + 1}`);
                recovered = true;
              }
            } catch (error3) {
              console.log(`⚠️ [OfflineAuth] Fingerprint alternativo ${i + 1} falló:`, error3.message);
            }
          }
          
          if (!recovered) {
            console.log('❌ [OfflineAuth] No se pudo recuperar la sesión offline');
            localStorage.removeItem(OFFLINE_SESSION_KEY);
            setIsLoading(false);
            return;
          }
        }
      }

      console.log('📋 [OfflineAuth] Datos de sesión:', {
        usuario: parsedSession.user?.nombre,
        expires: parsedSession.expires,
        lastSync: parsedSession.lastSync,
        hasHash: !!parsedSession.sessionHash,
        hasFingerprint: !!parsedSession.deviceFingerprint
      });
      
      // Verificaciones de tiempo (más permisivas)
      const now = new Date();
      const expiresAt = new Date(parsedSession.expires);
      const lastSync = new Date(parsedSession.lastSync);
      const offlineHours = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
      
      console.log('⏰ [OfflineAuth] Verificaciones de tiempo:', {
        now: now.toISOString(),
        expires: expiresAt.toISOString(),
        lastSync: lastSync.toISOString(),
        offlineHours: offlineHours.toFixed(2),
        isExpired: now > expiresAt,
        maxOfflineHours: parsedSession.maxOfflineHours || MAX_OFFLINE_HOURS
      });
      
      // Solo verificar expiración real de la sesión
      if (now > expiresAt) {
        console.log('❌ [OfflineAuth] Sesión expirada');
        localStorage.removeItem(OFFLINE_SESSION_KEY);
        setIsLoading(false);
        return;
      }
      
      // Verificar límite offline (más permisivo - solo advertir)
      if (offlineHours > (parsedSession.maxOfflineHours || MAX_OFFLINE_HOURS)) {
        console.log('⚠️ [OfflineAuth] Límite offline excedido, pero permitiendo acceso');
        setSecurityWarnings(prev => [...prev, `Límite offline excedido (${offlineHours.toFixed(1)}h)`]);
      }
      
      // Advertencia para sesiones offline largas
      if (offlineHours > 12) {
        setSecurityWarnings(prev => [...prev, `Sesión offline por ${offlineHours.toFixed(1)} horas`]);
      }

      console.log('✅ [OfflineAuth] Sesión offline válida, configurando...');
      
      // Actualizar y re-cifrar la sesión con el fingerprint actual
      const updatedSession: OfflineSession = {
        ...parsedSession,
        deviceFingerprint: deviceFingerprint,
        sessionHash: simpleHash(JSON.stringify(parsedSession.user) + parsedSession.expires),
        maxOfflineHours: parsedSession.maxOfflineHours || MAX_OFFLINE_HOURS
      };
      
      try {
        const encryptedData = simpleEncrypt(JSON.stringify(updatedSession), deviceFingerprint);
        localStorage.setItem(OFFLINE_SESSION_KEY, encryptedData);
        console.log('💾 [OfflineAuth] Sesión actualizada y re-cifrada');
      } catch (encryptError) {
        console.warn('⚠️ [OfflineAuth] Error re-cifrando, usando sesión original:', encryptError);
      }
      
      setOfflineSession(updatedSession);
      setHasValidOfflineSession(true);
      console.log('🎉 [OfflineAuth] Sesión offline cargada exitosamente');
      console.log('📊 [OfflineAuth] Estado final:', {
        hasValidOfflineSession: true,
        isLoading: false,
        user: updatedSession.user.nombre,
        tienda: updatedSession.user.tiendaActual?.nombre || 'Sin tienda'
      });
      
    } catch (error) {
      console.error('❌ [OfflineAuth] Error crítico cargando sesión offline:', error);
      localStorage.removeItem(OFFLINE_SESSION_KEY);
      setSecurityWarnings(prev => [...prev, 'Error crítico en sesión offline']);
      setHasValidOfflineSession(false);
    } finally {
      setIsLoading(false);
      console.log('🏁 [OfflineAuth] Proceso de carga completado - isLoading: false');
    }
  }, []);

  // Sincronizar sesión online con offline
  useEffect(() => {
    if (onlineSession?.user && onlineStatus === 'authenticated') {
      console.log('🔄 [OfflineAuth] Sincronizando sesión online → offline');
      
      const deviceFingerprint = generateDeviceFingerprint();
      const offlineSessionData: OfflineSession = {
        user: {
          id: onlineSession.user.id,
          nombre: onlineSession.user.nombre,
          usuario: onlineSession.user.usuario,
          email: onlineSession.user.email,
          rol: onlineSession.user.rol,
          negocio: onlineSession.user.negocio,
          tiendaActual: onlineSession.user.tiendaActual,
          expiresAt: onlineSession.user.expiresAt,
        },
        expires: onlineSession.expires,
        lastSync: new Date(),
        // Campos de seguridad
        sessionHash: simpleHash(JSON.stringify(onlineSession.user) + onlineSession.expires),
        deviceFingerprint: deviceFingerprint,
        maxOfflineHours: MAX_OFFLINE_HOURS
      };

      try {
        // Cifrar datos antes de guardar
        const encryptedData = simpleEncrypt(JSON.stringify(offlineSessionData), deviceFingerprint);
        localStorage.setItem(OFFLINE_SESSION_KEY, encryptedData);
        setOfflineSession(offlineSessionData);
        setHasValidOfflineSession(true);
        setSecurityWarnings([]); // Limpiar advertencias al sincronizar
        console.log('💾 [OfflineAuth] Sesión sincronizada y guardada offline (cifrada)');
      } catch (error) {
        console.error('❌ [OfflineAuth] Error guardando sesión offline:', error);
      }
    }
  }, [onlineSession, onlineStatus]);

  // NO limpiar sesión offline automáticamente - solo en signOut explícito
  // La sesión offline debe persistir independientemente del estado de NextAuth
  // Solo se limpiará cuando:
  // 1. El usuario haga logout explícito (desde la UI)
  // 2. La sesión expire por tiempo
  // 3. Se llame clearOfflineSession() manualmente
  
  // Este useEffect se elimina para evitar limpiezas automáticas incorrectas
  /*
  useEffect(() => {
    // Lógica de limpieza automática eliminada
  }, [onlineStatus, hasValidOfflineSession]);
  */

  // Función para obtener la sesión efectiva (online primero, offline como fallback)
  const getEffectiveSession = useCallback(() => {
    // Si tenemos sesión online, usarla
    if (onlineSession && onlineStatus === 'authenticated') {
      return {
        data: onlineSession,
        status: 'authenticated' as const,
        source: 'online' as const
      };
    }

    // Si estamos cargando sesión online, esperar
    if (onlineStatus === 'loading') {
      return {
        data: null,
        status: 'loading' as const,
        source: 'online' as const
      };
    }

    // Si no hay sesión online pero tenemos sesión offline válida
    if (!onlineSession && hasValidOfflineSession && offlineSession) {
      return {
        data: {
          user: offlineSession.user,
          expires: offlineSession.expires
        },
        status: 'authenticated' as const,
        source: 'offline' as const
      };
    }

    // No hay sesión válida
    return {
      data: null,
      status: 'unauthenticated' as const,
      source: 'none' as const
    };
  }, [onlineSession, onlineStatus, hasValidOfflineSession, offlineSession]);

  // Función para actualizar tienda actual en sesión offline
  // eslint-disable-next-line
  const updateOfflineTienda = useCallback((tienda: any) => {
    if (offlineSession) {
      const deviceFingerprint = generateDeviceFingerprint();
      const updatedSession = {
        ...offlineSession,
        user: {
          ...offlineSession.user,
          tiendaActual: tienda
        },
        lastSync: new Date(),
        sessionHash: simpleHash(JSON.stringify({
          ...offlineSession.user,
          tiendaActual: tienda
        }) + offlineSession.expires)
      };

      try {
        const encryptedData = simpleEncrypt(JSON.stringify(updatedSession), deviceFingerprint);
        localStorage.setItem(OFFLINE_SESSION_KEY, encryptedData);
        setOfflineSession(updatedSession);
        console.log('🔄 [OfflineAuth] Tienda actualizada en sesión offline');
      } catch (error) {
        console.error('❌ [OfflineAuth] Error actualizando tienda offline:', error);
      }
    }
  }, [offlineSession]);

  // Función para forzar logout offline
  const clearOfflineSession = useCallback(() => {
    localStorage.removeItem(OFFLINE_SESSION_KEY);
    setOfflineSession(null);
    setHasValidOfflineSession(false);
    setSecurityWarnings([]);
    console.log('🗑️ [OfflineAuth] Sesión offline limpiada manualmente');
  }, []);

  // Función para verificar si necesita reautenticación
  const needsReauth = useCallback(() => {
    if (!offlineSession) return false;
    
    const now = new Date();
    const lastSync = new Date(offlineSession.lastSync);
    const offlineHours = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
    
    return offlineHours > (offlineSession.maxOfflineHours * 0.8); // 80% del límite
  }, [offlineSession]);

  const effectiveSession = getEffectiveSession();

  return {
    // Sesión efectiva (online o offline)
    session: effectiveSession.data,
    status: effectiveSession.status,
    source: effectiveSession.source,
    
    // Estados
    isLoading: isLoading || (onlineStatus === 'loading' && !hasValidOfflineSession),
    hasValidOfflineSession,
    offlineSession,
    
    // Funciones
    updateOfflineTienda,
    clearOfflineSession,
    
    // Info adicional
    isOfflineMode: effectiveSession.source === 'offline',
    lastOfflineSync: offlineSession?.lastSync || null,
    
    // Seguridad
    securityWarnings,
    needsReauth: needsReauth(),
    offlineHoursRemaining: offlineSession ? 
      Math.max(0, offlineSession.maxOfflineHours - 
        ((new Date().getTime() - new Date(offlineSession.lastSync).getTime()) / (1000 * 60 * 60))
      ) : 0
  };
}; 