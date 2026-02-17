"use client"; // Asegúrate de que AppProvider sea un Client Component

import { useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState, useTransition } from "react";
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
  user: ISessionUser,
  isNavigating: boolean,
  gotToPath: (path: string) => void
}>(null);


export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ISessionUser>();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // No longer need manual isNavigating state
  // No need to reset navigation manually

  const gotToPath = (path: string) => {
    if (isAuth) {
      console.log('path', path);
      if (pathname !== path) {
        startTransition(() => {
          router.push(path);
        });
      }
    }
  };

  useEffect(() => {
    console.log('session', session);

    if (status === 'authenticated') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setUser((session as any).user);
      setIsAuth(true);
      setLoading(false);
      // Solo redirigir a la página principal si estamos en login o raíz (landing)
      if (navigator.onLine && (pathname === '/login' || pathname === '/')) {
        gotToPath('/home');
      }
    }
  }, [status, pathname, isAuth]);

  return (
    <AppContext.Provider value={{
      loadingContext: loading,
      isAuth,
      user,
      isNavigating: isPending,
      gotToPath
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => {
  const router = useRouter();
  const {
    loadingContext: loading,
    isAuth,
    user,
    isNavigating,
    gotToPath
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

  // gotToPath is now coming from context


  return {
    handleLogout,
    goToLogin,
    gotToPath,
    loadingContext: loading,
    isAuth,
    user,
    isNavigating
  }


}
