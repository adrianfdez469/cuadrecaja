"use client"; // Asegúrate de que AppProvider sea un Client Component

import { useSession } from "next-auth/react";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";
import { signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import { ILocal } from "@/schemas/tienda";
import { INegocio } from "@/schemas/negocio";
import type { INegocioMoneda } from "@/schemas/moneda";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import { getMonedasNegocio } from "@/services/monedaService";
import { getTasasCambio } from "@/services/tasaCambioService";

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
  loadingContext: boolean;
  isAuth: boolean;
  user: ISessionUser;
  isNavigating: boolean;
  gotToPath: (path: string) => void;
  monedasNegocio: INegocioMoneda[];
  tasasVigentes: ITasaSnapshot;
  monedaBase: string;
  monedaFuerte: string;
  refreshMonedas: () => Promise<void>;
}>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<ISessionUser>();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [monedasNegocio, setMonedasNegocio] = useState<INegocioMoneda[]>([]);
  const [tasasVigentes, setTasasVigentes] = useState<ITasaSnapshot>({});
  const [monedaBase, setMonedaBase] = useState("CUP");
  const [monedaFuerte, setMonedaFuerte] = useState("CUP");

  // No longer need manual isNavigating state
  // No need to reset navigation manually

  const gotToPath = (path: string) => {
    if (isAuth) {
      if (pathname !== path) {
        startTransition(() => {
          router.push(path);
        });
      }
    }
  };

  const loadMonedas = async (
    negocioId: string,
    negocioMonedaBase: string,
    negocioMonedaFuerte: string,
  ) => {
    try {
      const [monedasResp, tasasResp] = await Promise.all([
        getMonedasNegocio(negocioId),
        getTasasCambio(negocioId),
      ]);
      setMonedasNegocio(monedasResp.filter((m) => m.activo));
      setTasasVigentes(tasasResp.vigentes);
      setMonedaBase(tasasResp.monedaBase || negocioMonedaBase);
      setMonedaFuerte(negocioMonedaFuerte);
    } catch {
      setMonedaBase(negocioMonedaBase);
      setMonedaFuerte(negocioMonedaFuerte);
    }
  };

  const refreshMonedas = async () => {
    const currentUser = user;
    if (currentUser?.negocio?.id) {
      await loadMonedas(
        currentUser.negocio.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (currentUser.negocio as any).monedaBase ?? "CUP",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (currentUser.negocio as any).monedaFuerte ?? "CUP",
      );
    }
  };

  useEffect(() => {
    if (status === "authenticated") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sessionUser = (session as any).user;
      setUser(sessionUser);
      setIsAuth(true);
      // Setear moneda base desde sesión antes de renderizar — evita mostrar "CUP" mientras carga el API
      setMonedaBase(sessionUser.negocio?.monedaBase ?? "CUP");
      setMonedaFuerte(sessionUser.negocio?.monedaFuerte ?? "CUP");
      setLoading(false);
      // Cargar configuración multimoneda (puede sobreescribir monedaBase con valor del API)
      if (sessionUser?.negocio?.id) {
        loadMonedas(
          sessionUser.negocio.id,
          sessionUser.negocio.monedaBase ?? "CUP",
          sessionUser.negocio.monedaFuerte ?? "CUP",
        );
      }
      // Solo redirigir a la página principal si estamos en login o raíz (landing)
      if (navigator.onLine && (pathname === "/login" || pathname === "/")) {
        gotToPath("/home");
      }
    }
  }, [status, pathname, isAuth, session]);

  return (
    <AppContext.Provider
      value={{
        loadingContext: loading,
        isAuth,
        user,
        isNavigating: isPending,
        gotToPath,
        monedasNegocio,
        tasasVigentes,
        monedaBase,
        monedaFuerte,
        refreshMonedas,
      }}
    >
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
    gotToPath,
    monedasNegocio,
    tasasVigentes,
    monedaBase,
    monedaFuerte,
    refreshMonedas,
  } = useContext(AppContext);

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" }); // Redirige a la página de login
  };

  const goToLogin = async () => {
    // Redirigir al login si estamos online
    if (navigator.onLine) {
      await router.push("/login");
    }
  };

  // gotToPath is now coming from context

  return {
    handleLogout,
    goToLogin,
    gotToPath,
    loadingContext: loading,
    isAuth,
    user,
    isNavigating,
    monedasNegocio,
    tasasVigentes,
    monedaBase,
    monedaFuerte,
    refreshMonedas,
  };
};
