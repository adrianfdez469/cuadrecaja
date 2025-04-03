"use client"; // Asegúrate de que AppProvider sea un Client Component

import { signIn, useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const AppContext = createContext(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const router = useRouter();
  
  const [user, setUser] = useState<{id: string, usuario: string, rol: string, nombre: string, tiendaActual: any, tiendas: any[] }>();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);

  

  const seleccionarTiendaActual = (tienda: any) => {
    setUser({...user, tiendaActual: tienda});
  } 

  useEffect(() => {
    if(status === 'authenticated') {
      setUser((session as any).user);
      setIsAuth(true);
      setLoading(false);
      router.push('/');
    }
  }, [status]);

  return (
    <AppContext.Provider value={{ 
      seleccionarTiendaActual,
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
  const {
    seleccionarTiendaActual,
    loadingContext: loading,
    isAuth,
    user
  } = useContext(AppContext);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" }); // Redirige a la página de login
  };

  const goToLogin = async () => {
    await router.push('/login');
  }

  const gotToPath = async (path: string) => {
    if(isAuth) {
      await router.push(path);
    }
  };

  
  return {
    handleLogout,
    goToLogin,
    gotToPath,
    seleccionarTiendaActual,
    loadingContext: loading,
    isAuth,
    user
  }

  
}
