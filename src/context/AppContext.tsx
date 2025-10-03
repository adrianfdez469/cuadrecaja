"use client"; // Asegúrate de que AppProvider sea un Client Component

import { useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { ILocal } from "@/types/ILocal";
import { INegocio } from "@/types/INegocio";

interface ISessionUser {
  id: string; 
  usuario: string; 
  rol: string;
  nombre: string;
  // tiendaActual: ILocal; 
  // tiendas: ILocal[]; 
  localActual: ILocal;
  locales: ILocal[];
  negocio: INegocio;
  permisos: string;
}

const AppContext = createContext<{
  loadingContext: boolean,
  isAuth: boolean,
  user: ISessionUser
}>(null);


export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const router = useRouter();
  const pathname = usePathname();
  
  const [user, setUser] = useState<ISessionUser>();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('session', session);
    
    if(status === 'authenticated') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser((session as any).user);
      setIsAuth(true);
      setLoading(false);
      // Solo redirigir a la página principal si estamos en login o landing
      if (navigator.onLine && (pathname === '/login' || pathname === '/landing')) {
        router.push('/');
      }
    }
  }, [status, pathname]);

  return (
    <AppContext.Provider value={{ 
      loadingContext: loading,
      isAuth,
      user
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const router = useRouter();
  const pathname = usePathname();
  const {
    loadingContext: loading,
    isAuth,
    user
  } = useContext(AppContext);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" }); // Redirige a la página de login
  };

  const goToLogin = async () => {
    // Redirigir al login si estamos online
    if (navigator.onLine) {
      await router.push('/login');
    }
  }

  const gotToPath = async (path: string) => {
    if(isAuth) {
      console.log('path', path);
      
      await router.push(path);
    }
  };

  
  return {
    handleLogout,
    goToLogin,
    gotToPath,
    loadingContext: loading,
    isAuth,
    user
  }

  
}
