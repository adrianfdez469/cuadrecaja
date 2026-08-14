"use client"; // Asegúrate de que AppProvider sea un Client Component

import { useSession } from "next-auth/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

  const gotToPath = useCallback(
    (path: string) => {
      if (isAuth) {
        if (pathname !== path) {
          startTransition(() => {
            router.push(path);
          });
        }
      }
    },
    [isAuth, pathname, router],
  );

  // Serializes concurrent currency loads: only the newest one is allowed to
  // write. Two of them used to overlap routinely, and the loser could land
  // last and leave stale rates behind.
  const monedasRequestRef = useRef(0);

  const loadMonedas = useCallback(
    async (
      negocioId: string,
      negocioMonedaBase: string,
      negocioMonedaFuerte: string,
    ) => {
      const requestId = ++monedasRequestRef.current;
      try {
        const [monedasResp, tasasResp] = await Promise.all([
          getMonedasNegocio(negocioId),
          getTasasCambio(negocioId),
        ]);
        if (requestId !== monedasRequestRef.current) return;
        setMonedasNegocio(monedasResp.filter((m) => m.activo));
        setTasasVigentes(tasasResp.vigentes);
        setMonedaBase(tasasResp.monedaBase || negocioMonedaBase);
        setMonedaFuerte(negocioMonedaFuerte);
      } catch {
        if (requestId !== monedasRequestRef.current) return;
        setMonedaBase(negocioMonedaBase);
        setMonedaFuerte(negocioMonedaFuerte);
      }
    },
    [],
  );

  const refreshMonedas = useCallback(async () => {
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
  }, [user, loadMonedas]);

  // Session state. Deliberately NOT keyed on `pathname`: this used to re-run on
  // every navigation, so simply walking from /home to /pos refetched the
  // business currencies and exchange rates. It stays keyed on the whole
  // `session` object because switching store or business calls next-auth's
  // `update()`, and that new session is how the change reaches the app.
  useEffect(() => {
    if (status !== "authenticated") return;
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
  }, [status, session, loadMonedas]);

  // Post-login redirect, split out from the effect above so that landing on a
  // route never re-triggers the session work.
  useEffect(() => {
    if (!isAuth) return;
    // Solo redirigir a la página principal si estamos en login o raíz (landing)
    if (navigator.onLine && (pathname === "/login" || pathname === "/")) {
      gotToPath("/home");
    }
  }, [isAuth, pathname, gotToPath]);

  // Memoized: an object literal here is a new identity on every render of this
  // provider, and it re-rendered every consumer in the app — in the POS that
  // meant every product card, twice over.
  const value = useMemo(
    () => ({
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
    }),
    [
      loading,
      isAuth,
      user,
      isPending,
      gotToPath,
      monedasNegocio,
      tasasVigentes,
      monedaBase,
      monedaFuerte,
      refreshMonedas,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
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
