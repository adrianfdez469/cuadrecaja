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
import { getTiendaOnlineEstado } from "@/services/tiendaOnlineService";

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
  /**
   * The business switch, as a UI hint. `null` = not resolved yet.
   * NEVER a security boundary: the server re-reads it from the database on every
   * request (ADR 0029).
   */
  tiendaOnlineHabilitada: boolean | null;
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
  // `null` until the server answers: without this third state, a direct
  // navigation to a Tienda Online route would flash the denied screen before
  // resolving. See ADR 0029.
  const [tiendaOnlineHabilitada, setTiendaOnlineHabilitada] = useState<
    boolean | null
  >(null);

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

  // Same serialisation as the currencies above: the session effect re-runs
  // whenever the session identity changes (a store or business switch), and only
  // the newest response may write.
  const tiendaOnlineRequestRef = useRef(0);

  const loadTiendaOnlineEstado = useCallback(async () => {
    const requestId = ++tiendaOnlineRequestRef.current;
    try {
      const estado = await getTiendaOnlineEstado();
      if (requestId !== tiendaOnlineRequestRef.current) return;
      setTiendaOnlineHabilitada(estado.tiendaOnlineHabilitada);
    } catch {
      if (requestId !== tiendaOnlineRequestRef.current) return;
      // Fail closed, and `false` rather than `null`: a network failure hides the
      // section instead of leaving it flickering.
      setTiendaOnlineHabilitada(false);
    }
  }, []);

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
    // Behind the authenticated guard on purpose: `/api/tienda-online/estado` is
    // closed by the API gate, so calling it from an anonymous visitor would
    // answer 401 and `axiosClient` would sign them out (E-007).
    loadTiendaOnlineEstado();
  }, [status, session, loadMonedas, loadTiendaOnlineEstado]);

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
      tiendaOnlineHabilitada,
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
      tiendaOnlineHabilitada,
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
    tiendaOnlineHabilitada,
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
    tiendaOnlineHabilitada,
  };
};
