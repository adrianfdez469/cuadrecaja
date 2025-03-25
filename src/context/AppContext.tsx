"use client"; // Asegúrate de que AppProvider sea un Client Component

import { signIn, useSession } from "next-auth/react";
import { createContext, useContext, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

const AppContext = createContext(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  console.log("AppProvider - Estado de sesión:", status);
  console.log("AppProvider - Sesión:", session);

  return (
    <AppContext.Provider value={{ session, status }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {

  const router = useRouter();
  const {session, status} = useContext(AppContext);
  const [user, setUser] = useState<{id: string, usuario: string, rol: string}>();
  const [isAuth, setIsAuth] = useState(false);

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

  useEffect(() => {
    if(status === 'authenticated') {
      setUser(session.user);
      setIsAuth(true);
      router.push('/');
    }
  }, [status]);

  return {
    handleLogout,
    goToLogin,
    gotToPath,
    isAuth,
    user
  }
}
