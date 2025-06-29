"use client"; // Asegúrate de que AppProvider sea un Client Component

import { createContext, useContext, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ILocal } from "@/types/ILocal";
import { INegocio } from "@/types/INegocio";
import { useOfflineAuth } from "@/hooks/useOfflineAuth";
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface ISessionUser {
  id: string; 
  usuario: string; 
  rol: string;
  nombre: string;
  tiendaActual: ILocal; 
  tiendas: ILocal[]; 
  negocio: INegocio;
}

const AppContext = createContext<{
  loadingContext: boolean,
  isAuth: boolean,
  user: ISessionUser,
  isOfflineMode: boolean,
  sessionSource: 'online' | 'offline' | 'none'
}>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { 
    session, 
    status, 
    source: sessionSource, 
    isOfflineMode,
    isLoading: offlineAuthLoading
  } = useOfflineAuth();

  const router = useRouter();
  
  const [user, setUser] = useState<ISessionUser>();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('📱 [AppContext] Sesión actualizada:', {
      hasSession: !!session,
      status,
      source: sessionSource,
      isOfflineMode,
      offlineAuthLoading,
      currentPath: typeof window !== 'undefined' ? window.location.pathname : 'N/A'
    });
    
    if (status === 'authenticated' && session?.user) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser((session as any).user);
      setIsAuth(true);
      setLoading(false);
      
      // NUNCA redirigir automáticamente si:
      // 1. Estamos offline
      // 2. El usuario accedió directamente a una ruta específica (no es la raíz)
      // 3. La sesión es offline
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/';
      const isDirectAccess = currentPath !== '/' && currentPath !== '/login';
      
      if (navigator.onLine && sessionSource === 'online' && !isDirectAccess && !isOfflineMode) {
        console.log('📱 [AppContext] Redirigiendo a raíz desde login online');
        router.push('/');
      } else {
        console.log('📱 [AppContext] NO redirigiendo - Razones:', {
          isOnline: navigator.onLine,
          sessionSource,
          isDirectAccess,
          isOfflineMode,
          currentPath
        });
      }
    } else if (status === 'unauthenticated') {
      setUser(undefined);
      setIsAuth(false);
      setLoading(false);
    } else if (status === 'loading') {
      setLoading(true);
    }
  }, [session, status, sessionSource, isOfflineMode, offlineAuthLoading, router]);

  // Manejar el loading teniendo en cuenta la autenticación offline
  const effectiveLoading = loading || offlineAuthLoading;

  return (
    <AppContext.Provider value={{ 
      loadingContext: effectiveLoading,
      isAuth,
      user,
      isOfflineMode,
      sessionSource
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const router = useRouter();
  const { isOnline } = useNetworkStatus();
  const {
    loadingContext: loading,
    isAuth,
    user,
    isOfflineMode,
    sessionSource
  } = useContext(AppContext);

  const handleLogout = async () => {
    console.log('📱 [AppContext] Logout iniciado - Modo offline:', isOfflineMode);
    
    // TODO: Implementar limpieza de sesión offline
    // Por ahora, el logout se manejará desde el componente que tenga acceso al hook
    
    if (isOfflineMode) {
      console.log('📱 [AppContext] Logout en modo offline - solo limpieza local');
      await router.push('/login');
    } else {
      // Logout normal con servidor
      console.log('📱 [AppContext] Logout online - limpiando servidor');
      await signOut({ callbackUrl: "/login" });
    }
  };

  const goToLogin = async () => {
    // Siempre permitir ir al login, independientemente del estado de conexión
    if (!isOnline) {
      window.location.href = '/login';
    } else {
      await router.push('/login');
    }
  }

  const gotToPath = async (path: string) => {
    if (isAuth) {
      console.log('📱 [AppContext] Navegando a:', path, 'Modo offline:', isOfflineMode, 'Online:', isOnline);
      
      if (!isOnline) {
        // Si estamos offline, usar navegación del lado del cliente
        console.log('📱 [AppContext] Navegación offline detectada, usando window.location:', path);
        window.location.href = path;
      } else {
        // Si estamos online, usar navegación normal de Next.js
        await router.push(path);
      }
    }
  };

  return {
    handleLogout,
    goToLogin,
    gotToPath,
    loadingContext: loading,
    isAuth,
    user,
    isOfflineMode,
    sessionSource
  }
}
