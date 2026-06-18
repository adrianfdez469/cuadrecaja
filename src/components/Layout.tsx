"use client";

import { PropsWithChildren, useEffect, useRef, useState, Suspense } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Radio,
  RadioGroup,
  Toolbar,
  Typography,
  TextField,
  InputAdornment,
  Alert
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SupervisedUserCircleIcon from "@mui/icons-material/SupervisedUserCircle";
import StoreIcon from "@mui/icons-material/Store";
import CategoryIcon from "@mui/icons-material/Category";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import { useAppContext } from "@/context/AppContext";
import {
  AccountBalanceWallet,
  AccountCircle,
  CardGiftcardOutlined,
  ExpandMore,
  GridView,
  Handshake,
  Inventory,
  JoinInner,
  LocalShipping,
  PointOfSale,
  Receipt,
  Security,
  Summarize,
  SwapVert,
  Lock,
  Visibility,
  VisibilityOff,
  Notifications,
  Block,
  Android,
  TrendingDown,
  Campaign,
} from "@mui/icons-material";

import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { cambiarLocal, cambiarNegocio, getLocalesDisponibles } from "@/services/authService";
import { signOut, useSession } from "next-auth/react";
import { useMessageContext } from "@/context/MessageContext";
import { getNegocios } from "@/services/negocioServce";
import { INegocio } from "@/schemas/negocio";
import LogoutIcon from "@mui/icons-material/Logout";
import ChangeCircleIcon from '@mui/icons-material/ChangeCircleOutlined';
import NextWeekIcon from '@mui/icons-material/NextWeekOutlined';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import OfflineBanner from './OfflineBanner';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremium';
import GroupsIcon from '@mui/icons-material/Groups';
import { TipoLocal } from "@/schemas/tienda";
import { excludeOnWarehouse } from "@/utils/excludeOnWarehouse";
import { useOnboardingNavigation } from "@/features/onboarding";
import { useOnboardingStore } from "@/features/onboarding/store/onboardingStore";
import {
  NAV_DRAWER_TARGET_SELECTORS,
  scrollNavDrawerTargetIntoView,
} from "@/features/onboarding/utils/onboardingNavigation";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import type { CSSProperties } from "react";
import { usePermisos } from "@/utils/permisos_front";
import { Avatar } from "@mui/material";
import LocalOffer from "@mui/icons-material/LocalOffer";
import CurrencyExchangeIcon from "@mui/icons-material/CurrencyExchange";
import MonetizationOnIcon from "@mui/icons-material/MonetizationOn";
import Loading from "./Loading";
import Logo from "./Logo";

const SUPER_ADMIN_MENU_ITEMS = [
  { label: "Negocios", path: "/configuracion/negocios", icon: BusinessCenterIcon },
  { label: "Planes de Negocio", path: "/configuracion/planes-admin", icon: WorkspacePremiumIcon },
  { label: "Referidos", path: "/configuracion/referidos", icon: GroupsIcon },
  { label: "Suspensiones", path: "/configuracion/suspensiones", icon: Block },
  { label: "Notificaciones", path: "/configuracion/notificaciones", icon: Notifications },
  { label: "Monedas globales", path: "/configuracion/monedas", icon: MonetizationOnIcon },
];

const CONFIGURATION_MENU_ITEMS = [
  {
    label: "Usuarios",
    path: "/configuracion/usuarios",
    icon: SupervisedUserCircleIcon,
    permission: 'configuracion.usuarios.acceder'
  },
  {
    label: "Roles",
    path: "/configuracion/roles",
    icon: Security,
    permission: 'configuracion.roles.acceder'
  },
  {
    label: "Locales",
    path: "/configuracion/locales",
    icon: StoreIcon,
    permission: 'configuracion.locales.acceder'
  },
  {
    label: "Categorías",
    path: "/configuracion/categorias",
    icon: CategoryIcon,
    permission: 'configuracion.categorias.acceder'
  },
  {
    label: "Productos",
    path: "/configuracion/productos",
    icon: ChangeHistoryIcon,
    permission: 'configuracion.productos.acceder'
  },
  {
    label: "Gestión Unificada de Productos",
    path: "/configuracion/gestion-inventario",
    icon: JoinInner,
    permission: 'configuracion.gestion-inventario.acceder'
  },
  {
    label: "Plantillas de Gastos",
    path: "/gastos/plantillas",
    icon: TrendingDown,
    permission: 'configuracion.gastos.plantillas.gestionar'
  },
  {
    label: "Descuentos",
    path: "/configuracion/descuentos",
    icon: LocalOffer,
    permission: 'configuracion.descuentos.acceder'
  },
  {
    label: "Proveedores",
    path: "/configuracion/proveedores",
    icon: LocalShipping,
    permission: 'configuracion.proveedores.acceder'
  },
  {
    label: "Destinos de Transferencia",
    path: "/configuracion/destinos-transferencia",
    icon: CardGiftcardOutlined,
    permission: 'configuracion.destinostransferencia.acceder'
  },
  {
    label: "Monedas del negocio",
    path: "/configuracion/monedas-negocio",
    icon: MonetizationOnIcon,
    permission: 'configuracion.administrador'
  },
  {
    label: "Tasas de cambio",
    path: "/configuracion/tasas-cambio",
    icon: CurrencyExchangeIcon,
    permission: 'configuracion.administrador'
  },
  {
    label: "Planes y Suscripción",
    path: "/configuracion/planes",
    icon: UpgradeIcon,
    permission: '*'
  }
];

const MAIN_MENU_ITEMS = [
  { label: "POS", path: "/pos", icon: PointOfSale, permission: 'operaciones.pos-venta.acceder' },
  { label: "Ventas", path: "/ventas", icon: Receipt, permission: 'operaciones.ventas.acceder' },
  { label: "Movimientos", path: "/movimientos", icon: SwapVert, permission: 'operaciones.movimientos.acceder' },
  { label: "Conformar Precios", path: "/conformar_precios", icon: GridView, permission: 'operaciones.conformarprecios.acceder' },
  { label: "Gastos", path: "/gastos", icon: TrendingDown, permission: 'operaciones.gastos.ver' },
  { label: "Cierre", path: "/cierre", icon: AccountBalanceWallet, permission: 'operaciones.cierre.acceder' },
];

const RESUMEN_MENU_ITEMS = [
  { label: "Dashboard", path: "/dashboard-resumen", icon: Summarize, permission: 'recuperaciones.dashboard.acceder' },
  { label: "Inventario", path: "/inventario", icon: Inventory, permission: 'recuperaciones.inventario.acceder' },
  { label: "Resumen Cierres", path: "/resumen_cierre", icon: Summarize, permission: 'recuperaciones.resumencierres.acceder' },
  { label: "Análisis de CPP", path: "/cpp-analysis", icon: Summarize, permission: 'recuperaciones.analisiscpp.acceder' },
  { label: "Proveedores Consignación", path: "/proveedores", icon: Handshake, permission: 'recuperaciones.proveedoresconsignación.acceder' },
];

const HELP_MENU_ITEMS = [
  {
    label: "Ayuda",
    path: "/ayuda",
    icon: <HelpOutlineIcon sx={{ color: "primary.main", fontSize: 22 }} />,
  },
  {
    label: "Descargar App",
    path: "/descargar",
    icon: <Android sx={{ mr: 2, color: "success.main" }} />,
  },
];



const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { user, isAuth, handleLogout, goToLogin, gotToPath, isNavigating, monedaBase } = useAppContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openSelectLocal, setOpenSelectLocal] = useState(false);
  const [openSelectNegocio, setOpenSelectNegocio] = useState(false);
  const [cambiandoNegocio, setCambiandoNegocio] = useState(false);
  const [negocioRecienCambiado, setNegocioRecienCambiado] = useState(false);
  const selectorLocalAbiertoRef = useRef(false);
  const { update, data: session, status: sessionStatus } = useSession();
  const { showMessage } = useMessageContext();
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [loadingNegocios, setLoadingNegocios] = useState(false);
  const [localesDisponibles, setLocalesDisponibles] = useState([]);
  const [loadingLocales, setLoadingLocales] = useState(false);
  const [totalLocalesDisponibles, setTotalLocalesDisponibles] = useState(0);
  const { isOnline, wasOffline } = useNetworkStatus();
  const [menuState, setMenuState] = useState<{ operaciones: boolean, resumenes: boolean, configuracion: boolean, administracion: boolean }>({
    operaciones: true,
    resumenes: false,
    administracion: false,
    configuracion: false
  });
  const { verificarPermiso } = usePermisos();
  const {
    isBlockingActive,
    canNavigateTo,
    isMenuItemAllowed,
    isToolbarTargetAllowed,
    isDrawerCloseAllowed,
  } = useOnboardingNavigation();
  const onboardingRun = useOnboardingStore((s) => s.run);
  const onboardingStepIndex = useOnboardingStore((s) => s.stepIndex);
  const activeStepDefinitions = useOnboardingStore((s) => s.activeStepDefinitions);

  useEffect(() => {
    if (!onboardingRun) return;
    const step = activeStepDefinitions[onboardingStepIndex];
    if (!step) return;

    if (step.target.includes("nav-gestion-inventario")) {
      setMenuState({
        operaciones: false,
        resumenes: false,
        configuracion: true,
        administracion: false,
      });
      setOpen(true);
      scrollNavDrawerTargetIntoView(
        NAV_DRAWER_TARGET_SELECTORS.gestionInventario,
        () => useOnboardingStore.getState().bumpLayoutNonce(),
      );
    }
    if (step.target.includes("nav-pos")) {
      setMenuState({
        operaciones: true,
        resumenes: false,
        configuracion: false,
        administracion: false,
      });
      setOpen(true);
      scrollNavDrawerTargetIntoView(NAV_DRAWER_TARGET_SELECTORS.pos, () =>
        useOnboardingStore.getState().bumpLayoutNonce(),
      );
    }
    if (
      step.target.includes("pos-toolbar-") ||
      step.target.includes("pos-category-first")
    ) {
      window.setTimeout(
        () => useOnboardingStore.getState().bumpLayoutNonce(),
        200
      );
    }
  }, [onboardingRun, onboardingStepIndex, activeStepDefinitions]);

  const toolbarInteractionSx = (tourAttr?: string) => {
    if (!isBlockingActive) return {};
    const allowed = isToolbarTargetAllowed(tourAttr);
    return {
      pointerEvents: (allowed ? "auto" : "none") as CSSProperties["pointerEvents"],
      opacity: allowed ? 1 : 0.45,
    };
  };

  const handleOpenNavDrawer = () => {
    setOpen(true);
    const store = useOnboardingStore.getState();
    if (!store.isBlockingActive() || !store.activeTourId) return;

    const step = store.activeStepDefinitions[store.stepIndex];
    if (!step?.target.includes("nav-menu-button")) return;

    window.setTimeout(() => {
      store.signalEvent({ type: "drawer_opened" });
      store.bumpLayoutNonce();
    }, 320);
  };

  const navigateIfAllowed = (path: string) => {
    if (!canNavigateTo(path)) return;
    gotToPath(path);
  };

  const getMenuTourAttr = (path: string): string | undefined => {
    if (path === "/configuracion/gestion-inventario") return "nav-gestion-inventario";
    if (path === "/pos") return "nav-pos";
    return undefined;
  };

  const handleMenuNavigate = (path: string) => {
    const tourAttr = getMenuTourAttr(path);
    if (isBlockingActive && tourAttr && !isMenuItemAllowed(tourAttr)) return;
    navigateIfAllowed(path);
    setOpen(false);
  };

  // Estados para cambio de contraseña
  const [openChangePassword, setOpenChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [loadingPasswordChange, setLoadingPasswordChange] = useState(false);
  const [loadingPromoterAccess, setLoadingPromoterAccess] = useState(false);

  const getMainMenuItemsByLocalType = (localType: string, type: string, user: { rol: string, permisos: string }) => {
    let items = [];
    if (type === "resumen") {
      items = RESUMEN_MENU_ITEMS;
    } else {
      items = MAIN_MENU_ITEMS;
    }
    return items.filter(item => {
      if (localType === TipoLocal.ALMACEN) {
        return !excludeOnWarehouse.includes(item.path);
      }
      return true;
    }).filter(item => {
      if (user.rol === 'SUPER_ADMIN') return true;
      return verificarPermiso(item.permission)
    })
  }

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCambiarLocal = async () => {
    try {
      setLoadingLocales(true);
      handleClose();
      const locales = await getLocalesDisponibles();
      setLocalesDisponibles(locales);
      setTotalLocalesDisponibles(locales.length);
      setOpenSelectLocal(true);
      selectorLocalAbiertoRef.current = true;
    } catch (error) {
      console.error(error);
      showMessage("No se pueden cargar los locales disponibles", "error", error);
    } finally {
      setLoadingLocales(false);
    }
  };

  const handleCambiarNegocio = async () => {
    try {
      setLoadingNegocios(true);
      const negocios = await getNegocios();
      setNegocios(negocios);
      setOpenSelectNegocio(true);
    } catch (error) {
      console.error(error);
      showMessage("No se puede cambiar de negocio", "error", error);
    } finally {
      setLoadingNegocios(false);
    }
  };

  const handleCloseCambiarLocal = (localSeleccionado = false) => {
    setOpenSelectLocal(false);
    if (!localSeleccionado) {
      selectorLocalAbiertoRef.current = false;
    }
  };
  const handleCloseCambiarNegocio = () => {
    setOpenSelectNegocio(false);
  };

  const handleSelectLocal = async (selectedLocal) => {
    const resp = await cambiarLocal(selectedLocal);
    if (resp.status === 201) {
      await update({
        localActual: localesDisponibles?.find((t) => t.id === selectedLocal),
      });
      showMessage("El local fue actualizada satisfactoriamente", "success");
      handleCloseCambiarLocal(true);

      // Redirigir a /home para forzar re-render con el nuevo local
      gotToPath('/home');
    } else {
      showMessage("No se pudo actualizar el local", "error");
      handleCloseCambiarLocal();
    }
  };

  const handleSelectNegocio = async (selectedNegocio) => {
    if (cambiandoNegocio) return;
    handleCloseCambiarNegocio();
    setCambiandoNegocio(true);
    setNegocioRecienCambiado(true);
    selectorLocalAbiertoRef.current = false; // Reset del ref

    const resp = await cambiarNegocio(selectedNegocio);
    if (resp.status === 201) {
      await update({
        negocio: negocios.find((n) => n.id === selectedNegocio),
        localActual: null, // Limpiar local actual al cambiar negocio
      });
      showMessage("El negocio fue actualizado satisfactoriamente", "success");

      // Cargar las nuevas local disponibles y abrir selector
      try {
        const locales = await getLocalesDisponibles();
        setLocalesDisponibles(locales);
        setTotalLocalesDisponibles(locales.length);


        // Solo abrir selector si hay locales disponibles
        if (locales.length > 0) {
          // Esperar un poco para asegurar que la sesión se actualice
          setTimeout(() => {
            setOpenSelectLocal(true);
            selectorLocalAbiertoRef.current = true;
          }, 300);
        } else {
          // Si no hay locales, mostrar mensaje y resetear flags inmediatamente
          showMessage("Este negocio no tiene locales disponibles", "warning");
          setNegocioRecienCambiado(false);
        }

        // Resetear el flag después de un tiempo más largo solo si hay locales
        if (locales.length > 0) {
          setTimeout(() => {
            setNegocioRecienCambiado(false);
          }, 3000); // Aumentado a 3 segundos para mayor seguridad
        }
      } catch (error) {
        console.error(error);
        showMessage("Error al cargar locales disponibles", "error", error);
        setNegocioRecienCambiado(false);
      }
    } else {
      showMessage("No se pudo actualizar el negocio", "error");
      setNegocioRecienCambiado(false);
    }

    // Usar setTimeout para asegurar que el estado se actualice después del render
    setTimeout(() => {
      setCambiandoNegocio(false);
    }, 500); // Aumentado para mayor seguridad
  };

  // Función para cargar el conteo de locales disponibles
  const loadLocalesCount = async () => {
    try {
      // Solo cargar si no tenemos el conteo aún
      if (totalLocalesDisponibles === 0) {
        const locales = await getLocalesDisponibles();
        setTotalLocalesDisponibles(locales.length);
      }
    } catch (error) {
      console.error("Error al obtener conteo de locales:", error);
    }
  };

  const handleMenuAccordion = (type: string) => {
    if (menuState[type] === false) {
      setMenuState({
        configuracion: false,
        operaciones: false,
        resumenes: false,
        administracion: false,
        [type]: true
      });
    } else {
      setMenuState({
        ...menuState,
        [type]: !menuState[type]
      });
    }
  }

  const handleChangePassword = () => {
    setOpenChangePassword(true);
    handleClose(); // Cerrar el menú de usuario
  };

  const handleCloseChangePassword = () => {
    setOpenChangePassword(false);
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
    setPasswordErrors([]);
    setShowPasswords({
      current: false,
      new: false,
      confirm: false
    });
  };

  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    if (password.length < 8) {
      errors.push('La contraseña debe tener al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('La contraseña debe contener al menos una minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('La contraseña debe contener al menos un número');
    }
    return errors;
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));

    // Limpiar errores cuando el usuario empiece a escribir
    if (passwordErrors.length > 0) {
      setPasswordErrors([]);
    }
  };

  const handleSubmitPasswordChange = async () => {
    const errors: string[] = [];

    // Validaciones
    if (!passwordData.currentPassword) {
      errors.push('La contraseña actual es requerida');
    }

    if (!passwordData.newPassword) {
      errors.push('La nueva contraseña es requerida');
    } else {
      const passwordValidationErrors = validatePassword(passwordData.newPassword);
      errors.push(...passwordValidationErrors);
    }

    if (!passwordData.confirmPassword) {
      errors.push('Confirmar la nueva contraseña es requerido');
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.push('Las nuevas contraseñas no coinciden');
    }

    if (passwordData.currentPassword === passwordData.newPassword) {
      errors.push('La nueva contraseña debe ser diferente a la actual');
    }

    if (errors.length > 0) {
      setPasswordErrors(errors);
      return;
    }

    setLoadingPasswordChange(true);

    try {
      const response = await fetch('/api/auth/cambiar-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const result = await response.json();

      if (response.ok) {
        showMessage('Contraseña cambiada exitosamente', 'success');
        handleCloseChangePassword();
      } else {
        setPasswordErrors([result.error || 'Error al cambiar la contraseña']);
      }
    } catch (error) {
      console.error('Error al cambiar contraseña:', error);
      setPasswordErrors(['Error de conexión. Intenta nuevamente.']);
    } finally {
      setLoadingPasswordChange(false);
    }
  };

  const handlePromoterQuickAccess = async () => {
    if (loadingPromoterAccess) return;
    setLoadingPromoterAccess(true);
    handleClose();

    try {
      const response = await fetch('/api/promoters/self-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await response.json()) as { ok?: boolean; error?: string; wasCreated?: boolean };

      if (!response.ok || !data?.ok) {
        showMessage(data?.error || 'No se pudo abrir el panel de promotor.', 'error');
        return;
      }

      showMessage(
        data.wasCreated
          ? 'Tu perfil de promotor fue creado. Redirigiendo al panel...'
          : 'Redirigiendo a tu panel de promotor...',
        'success'
      );
      gotToPath('/promotor');
    } catch (error) {
      console.error(error);
      showMessage('Error de conexión al habilitar el acceso de promotor.', 'error');
    } finally {
      setLoadingPromoterAccess(false);
    }
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  // Cargar el conteo de locales al montar el componente
  useEffect(() => {
    if (isAuth && user && totalLocalesDisponibles === 0) {
      loadLocalesCount();
    }
  }, [isAuth, user, totalLocalesDisponibles]);

  // Detectar si el usuario necesita seleccionar una local
  useEffect(() => {

    // SOLO ejecutar si NO acabamos de cambiar de negocio
    if (negocioRecienCambiado) {
      return; // Salir temprano si acabamos de cambiar negocio
    }

    // No mostrar selector automáticamente si estamos cambiando de negocio, ya está abierto, ya se abrió antes
    if (isAuth && user && !user.localActual && totalLocalesDisponibles >= 1 && !openSelectLocal && !cambiandoNegocio && !selectorLocalAbiertoRef.current) {
      // Mostrar automáticamente el selector de local si el usuario no tiene una asignada
      handleCambiarLocal();
    }
  }, [isAuth, user?.localActual, totalLocalesDisponibles, openSelectLocal, cambiandoNegocio, negocioRecienCambiado]);

  useEffect(() => {
    // Solo verificar expiración si hay sesión
    if (session?.user.expiresAt && new Date() > new Date(session.user.expiresAt)) {
      signOut();
    }

    // Verificar si hay conexión antes de redirigir al login
    // Esto evita que la app se recargue cuando está funcionando offline
    // Solo redirigir si:
    // 1. No hay sesión
    // 2. Estamos online (para evitar problemas offline)
    // 3. No estuvimos offline recientemente (para evitar redirecciones después de reconectar)
    if (!session && sessionStatus !== 'loading' && isOnline && !wasOffline) {
      goToLogin();
    }
  }, [session, isOnline, wasOffline]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Barra superior mejorada */}
      <AppBar
        component="header"
        position="sticky"
        elevation={0}
        sx={{
          top: 0,
          backgroundColor: '#ffffff',
          color: '#1a202c',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
          zIndex: (theme) =>
            isBlockingActive ? theme.zIndex.appBar : theme.zIndex.drawer - 1,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {!isAuth && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Logo size={32} sx={{ mr: 1.5 }} />
              <Typography
                variant="h6"
                component="h1"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #1976d2 0%, #dc004e 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: { xs: '1.1rem', sm: '1.25rem' }

                }}
              >
                Cuadre de Caja
              </Typography>
            </Box>
          )}
          {isAuth && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              data-tour="nav-menu-button"
              onClick={handleOpenNavDrawer}
              sx={{
                mr: { xs: 0, sm: 2 },
                ...toolbarInteractionSx("nav-menu-button"),
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {isAuth && user?.localActual && (
            <Box
              display="flex"
              alignItems="center"
              gap={0.5}
              sx={{
                cursor: isBlockingActive ? "default" : "pointer",
                ...toolbarInteractionSx(),
              }}
              onClick={() => navigateIfAllowed("/home")}
            >
              <StoreIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={700}>
                {user.localActual.nombre}
              </Typography>
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {isAuth && user ? (
            <Box display="flex" flexDirection={'row'} alignItems="center" gap={1}>
              {monedaBase && (
                <Chip
                  label={monedaBase}
                  size="small"
                  variant="outlined"
                  icon={<MonetizationOnIcon style={{ fontSize: 14 }} />}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.7rem',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                    ...toolbarInteractionSx(),
                  }}
                />
              )}


              <IconButton
                // size="large"
                aria-label="cuenta del usuario actual"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={(e) => {
                  if (isBlockingActive) return;
                  handleMenu(e);
                }}
                sx={{
                  ...toolbarInteractionSx(),
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  }
                }}
              >
                <AccountCircle sx={{ color: 'primary.main', fontSize: 32 }} />
              </IconButton>

              {/* Menú de usuario mejorado */}
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                  elevation: 8,
                  sx: {
                    mt: 1,
                    borderRadius: 2,
                    minWidth: 280,
                    border: '1px solid #e2e8f0',
                    '& .MuiMenuItem-root': {
                      px: 2,
                      py: 1.5,
                      borderRadius: 1,
                      mx: 1,
                      my: 0.5,
                      '&:hover': {
                        backgroundColor: 'rgba(25, 118, 210, 0.08)',
                      }
                    }
                  }
                }}
              >
                {/* Sección de información del usuario */}
                <Box sx={{ p: 2, pb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Avatar
                      sx={{
                        width: 40,
                        height: 40,
                        bgcolor: 'primary.main',
                        mr: 2,
                        fontSize: '1rem',
                        fontWeight: 600,
                      }}
                    >
                      {(user?.nombre || user?.usuario)?.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body1" fontWeight={600} color="text.primary">
                        {user?.nombre}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {user?.rol}
                      </Typography>
                      {user?.rol === 'SUPER_ADMIN' && user?.negocio?.nombre && (
                        <Chip
                          label={user.negocio.nombre}
                          size="small"
                          variant="outlined"
                          sx={{ mt: 0.25, mb: 0.25, borderColor: 'primary.main', color: 'primary.main', fontWeight: 500, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ mx: 2, my: 1 }} />

                {/* Opción de cambiar contraseña */}
                <MenuItem onClick={handleChangePassword}>
                  <Lock sx={{ mr: 2, color: 'info.main' }} />
                  <Typography variant="body2" fontWeight={500}>
                    Cambiar contraseña
                  </Typography>
                </MenuItem>

                <Divider sx={{ mx: 2, my: 1 }} />

                <MenuItem onClick={handlePromoterQuickAccess} disabled={loadingPromoterAccess}>
                  {loadingPromoterAccess ? (
                    <CircularProgress size={18} sx={{ mr: 2 }} />
                  ) : (
                    <Campaign sx={{ mr: 2, color: 'secondary.main' }} />
                  )}
                  <Typography variant="body2" fontWeight={500}>
                    Panel de promotor
                  </Typography>
                </MenuItem>

                <Divider sx={{ mx: 2, my: 1 }} />

                {user.rol === "SUPER_ADMIN" && (
                  <MenuItem onClick={() => handleCambiarNegocio()}>
                    <NextWeekIcon sx={{ mr: 2, color: 'primary.main' }} />
                    <Typography variant="body2" fontWeight={500}>
                      Cambiar de Negocio
                    </Typography>
                  </MenuItem>
                )}
                {(user.rol === "SUPER_ADMIN" || totalLocalesDisponibles > 1 || (totalLocalesDisponibles >= 1 && !user?.localActual)) && (
                  [
                    <MenuItem key="cambiar-local" onClick={() => handleCambiarLocal()}>
                      <ChangeCircleIcon sx={{ mr: 2, color: 'info.main' }} />
                      <Typography variant="body2" fontWeight={500}>
                        {!user?.localActual ? 'Seleccionar local' : 'Cambiar de local'}
                      </Typography>
                    </MenuItem>,
                    <Divider key="divider-local" sx={{ mx: 2, my: 1 }} />
                  ]
                )}

                <MenuItem onClick={() => { handleClose(); gotToPath("/ayuda"); }}>
                  <HelpOutlineIcon sx={{ mr: 2, color: "primary.main" }} />
                  <Typography variant="body2" fontWeight={500}>
                    Ayuda
                  </Typography>
                </MenuItem>

                <Divider sx={{ mx: 2, my: 1 }} />

                <MenuItem onClick={() => { handleClose(); gotToPath('/descargar'); }}>
                  <Android sx={{ mr: 2, color: 'success.main' }} />
                  <Typography variant="body2" fontWeight={500}>
                    Descargar App(APK)
                  </Typography>
                </MenuItem>

                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 2, color: 'error.main' }} />
                  <Typography variant="body2" fontWeight={500} color="error.main">
                    Cerrar sesión
                  </Typography>
                </MenuItem>

              </Menu>
            </Box>
          ) : (
            <Button
              color="inherit"
              onClick={goToLogin}
              variant="outlined"
              sx={{
                borderColor: 'primary.main',
                color: 'primary.main',
                '&:hover': {
                  borderColor: 'primary.dark',
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                }
              }}
            >
              Entrar
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {isAuth && (
        <>
          {/* Banner de estado offline moved inside main to follow flow */}

          {/* Menú lateral mejorado */}
          <Drawer
            anchor="left"
            open={open}
            onClose={() => {
              if (!isDrawerCloseAllowed()) return;
              setOpen(false);
            }}
            ModalProps={{
              sx: { zIndex: (theme) => theme.zIndex.drawer },
            }}
            PaperProps={{
              sx: {
                width: 280,
                backgroundColor: '#ffffff',
                borderRight: '1px solid #e2e8f0',
                boxShadow: '4px 0 12px rgba(0, 0, 0, 0.08)',
              }
            }}
          >
            <Box
              sx={{
                width: 280,
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                maxHeight: '100dvh'
              }}
              role="presentation"
            >
              {/* Header del menú (Fijo) */}
              <Box sx={{
                p: 2,
                pt: 'calc(16px + env(safe-area-inset-top))',
                borderBottom: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                zIndex: 1
              }}>
                <Typography variant="h6" fontWeight={700} color="primary.main">
                  Menú
                </Typography>
              </Box>

              {/* Contenido (Scrollable) */}
              <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {user.localActual?.tipo && getMainMenuItemsByLocalType(user.localActual?.tipo || '', 'operaciones', user).length > 0 &&
                  <Accordion style={{margin: 0}} expanded={menuState.operaciones} onChange={() => handleMenuAccordion('operaciones')}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Operaciones
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {user?.localActual && (
                        <List sx={{ pt: 0 }}>
                          {getMainMenuItemsByLocalType(user.localActual.tipo, 'operaciones', user).map((item) => (
                            <ListItem key={item.label} disablePadding sx={{ px: 2, mb: 0.5 }}>
                              <ListItemButton
                                {...(getMenuTourAttr(item.path)
                                  ? { "data-tour": getMenuTourAttr(item.path) }
                                  : {})}
                                onClick={() => handleMenuNavigate(item.path)}
                                sx={{
                                  borderRadius: 2,
                                  py: 1.5,
                                  '&:hover': {
                                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                  }
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 40 }} color="primary">
                                  <item.icon sx={{ color: 'primary.main', fontSize: 22 }} />
                                </ListItemIcon>
                                <ListItemText
                                  primary={item.label}
                                  primaryTypographyProps={{
                                    fontWeight: 500,
                                    fontSize: '0.875rem'
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </AccordionDetails>
                  </Accordion>
                }

                {user.localActual?.tipo && getMainMenuItemsByLocalType(user.localActual?.tipo || '', 'resumen', user).length > 0 &&
                  <Accordion style={{margin: 0}} expanded={menuState.resumenes} onChange={() => handleMenuAccordion('resumenes')}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Resúmenes
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {user?.localActual && (
                        <List sx={{ pt: 0}}>
                          {getMainMenuItemsByLocalType(user.localActual?.tipo || '', 'resumen', user).map((item) => (
                            <ListItem key={item.label} disablePadding sx={{ px: 2, mb: 0.5 }}>
                              <ListItemButton
                                onClick={() => handleMenuNavigate(item.path)}
                                sx={{
                                  borderRadius: 2,
                                  py: 1.5,
                                  '&:hover': {
                                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                  }
                                }}
                              >
                                <ListItemIcon sx={{ minWidth: 40 }} color="primary">
                                  <item.icon sx={{ color: 'primary.main', fontSize: 22 }} />
                                </ListItemIcon>
                                <ListItemText
                                  primary={item.label}
                                  primaryTypographyProps={{
                                    fontWeight: 500,
                                    fontSize: '0.875rem'
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </AccordionDetails>
                  </Accordion>
                }

                {CONFIGURATION_MENU_ITEMS
                        .filter((item) => {
                          return verificarPermiso(item.permission);
                        }).length > 0 &&
                    <Accordion expanded={menuState.configuracion} onChange={() => handleMenuAccordion('configuracion')}>
                        <AccordionSummary expandIcon={<ExpandMore />}>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                Configuración
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <List sx={{ pt: 2 }}>
                              {CONFIGURATION_MENU_ITEMS
                                  .filter((item) => verificarPermiso(item.permission))
                                  .map((item) => (
                                      <ListItem key={item.label} disablePadding sx={{ px: 2, mb: 0.5 }}>
                                        <ListItemButton
                                            {...(getMenuTourAttr(item.path)
                                              ? { "data-tour": getMenuTourAttr(item.path) }
                                              : {})}
                                            onClick={() => handleMenuNavigate(item.path)}
                                            sx={{
                                              borderRadius: 2,
                                              py: 1.5,
                                              '&:hover': {
                                                backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                              }
                                            }}
                                        >
                                          <ListItemIcon sx={{ minWidth: 40 }}>
                                            <item.icon sx={{ color: 'primary.main', fontSize: 22 }} />
                                          </ListItemIcon>
                                          <ListItemText
                                              primary={item.label}
                                              primaryTypographyProps={{
                                                fontWeight: 500,
                                                fontSize: '0.875rem'
                                              }}
                                          />
                                        </ListItemButton>
                                      </ListItem>
                                  ))}
                            </List>
                        </AccordionDetails>
                    </Accordion>
                }

                {user.rol === 'SUPER_ADMIN' &&
                  <Accordion style={{margin: 0}} expanded={menuState.administracion} onChange={() => handleMenuAccordion('administracion')}>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                        Administración
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List sx={{ pt: 2 }}>
                        {SUPER_ADMIN_MENU_ITEMS.map((item) => (
                          <ListItem key={item.label} disablePadding sx={{ px: 2, mb: 0.5 }}>
                            <ListItemButton
                              onClick={() => {
                                gotToPath(item.path);
                                setOpen(false);
                              }}
                              sx={{
                                borderRadius: 2,
                                py: 1.5,
                                '&:hover': {
                                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                                }
                              }}
                            >
                              <ListItemIcon sx={{ minWidth: 40 }}>
                                <item.icon sx={{ color: 'primary.main', fontSize: 22 }} />
                              </ListItemIcon>
                              <ListItemText
                                primary={item.label}
                                primaryTypographyProps={{
                                  fontWeight: 500,
                                  fontSize: '0.9rem'
                                }}
                              />
                            </ListItemButton>
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
                }



                <List sx={{ px: 2 }}>
                  {HELP_MENU_ITEMS.map((item) => (
                    <ListItem key={item.label} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => {
                          gotToPath(item.path);
                          setOpen(false);
                        }}
                        sx={{
                          borderRadius: 2,
                          py: 1.5,
                          '&:hover': {
                            backgroundColor: 'rgba(25, 118, 210, 0.08)',
                          }
                        }}
                      >
                        <ListItemIcon sx={{ minWidth: 40 }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontWeight: 600,
                            fontSize: '0.875rem'
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  ))}
                </List>
              </Box>
            </Box>
          </Drawer>
        </>
      )}

      {/* Contenido dinámico mejorado */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          backgroundColor: '#f8fafc',
          p: { xs: 0, sm: 0.5, md: 0.5 },
        }}
      >
        {isAuth && <OfflineBanner />}
        <Container
          maxWidth="xl"
          sx={{
            py: 0,
            px: { xs: 0.5, sm: 1, md: 1 }
          }}
        >
          <Suspense>
            {isNavigating ? <Loading /> : children}
          </Suspense>
        </Container>
      </Box>

      {/* Dialogs mejorados */}
      <Dialog
        open={openSelectLocal}
        onClose={user?.localActual || localesDisponibles.length === 0 ? () => handleCloseCambiarLocal() : undefined}
        disableEscapeKeyDown={!user?.localActual && localesDisponibles.length > 0}
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: 400,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={600} component="span" display="block">
            {!user?.localActual ? 'Seleccionar local' : 'Cambiar local'}
          </Typography>
          <Typography variant="body2" color="text.secondary" component="span" display="block">
            {!user?.localActual
              ? 'Necesitas seleccionar un local para comenzar a trabajar'
              : 'Selecciona el local donde deseas trabajar'
            }
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {!user?.localActual && localesDisponibles.length === 1 && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" color="info.contrastText">
                <strong>Nota:</strong> Necesitas seleccionar un local para acceder al sistema.
              </Typography>
            </Box>
          )}
          {localesDisponibles.length === 0 && !loadingLocales && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'warning.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="body2" color="warning.contrastText">
                <strong>Sin locales disponibles</strong>
              </Typography>
              <Typography variant="body2" color="warning.contrastText" sx={{ mt: 1 }}>
                Este negocio no tiene locales configuradas. Contacta al administrador para crear locales.
              </Typography>
            </Box>
          )}
          {loadingLocales ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : localesDisponibles.length > 0 ? (
            <RadioGroup
              onChange={(e) => handleSelectLocal(e.target.value)}
            >
              {localesDisponibles?.filter((local) => local.id !== user?.localActual?.id).map((local) => (
                <FormControlLabel
                  key={local.id}
                  value={local.id}
                  control={<Radio color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {local.nombre}
                      </Typography>
                    </Box>
                  }
                  sx={{
                    mb: 1,
                    p: 1,
                    borderRadius: 2,
                    '&:hover': {
                      backgroundColor: 'action.hover',
                    }
                  }}
                />
              )) || []}
            </RadioGroup>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          {(user?.localActual || localesDisponibles.length === 0) && (
            <Button onClick={() => handleCloseCambiarLocal()} variant="outlined">
              {localesDisponibles.length === 0 ? 'Cerrar' : 'Cancelar'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {user?.rol && user.rol === "SUPER_ADMIN" && (
        <Dialog
          open={openSelectNegocio}
          onClose={() => handleCloseCambiarNegocio()}
          PaperProps={{
            sx: {
              borderRadius: 3,
              minWidth: 400,
            }
          }}
        >
          <DialogTitle sx={{ pb: 1 }}>
              Cambiar negocio
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            {loadingNegocios ? (
              <Box display="flex" justifyContent="center" py={4}>
                <CircularProgress />
              </Box>
            ) : (
              <RadioGroup
                onChange={(e) => handleSelectNegocio(e.target.value)}
              >
                {negocios.filter((negocio) => negocio.id !== user?.negocio?.id).map((negocio) => (
                  <FormControlLabel
                    key={negocio.id}
                    value={negocio.id}
                    control={<Radio color="primary" />}
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          {negocio.nombre}
                        </Typography>
                      </Box>
                    }
                    sx={{
                      mb: 1,
                      p: 1,
                      borderRadius: 2,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      }
                    }}
                  />
                ))}
              </RadioGroup>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button onClick={handleCloseCambiarNegocio} variant="outlined">
              Cancelar
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Dialog de cambio de contraseña */}
      <Dialog
        open={openChangePassword}
        onClose={handleCloseChangePassword}
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: 400,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={600} component="span" display="block">
            Cambiar Contraseña
          </Typography>
          <Typography variant="body2" color="text.secondary" component="span" display="block">
            Ingresa tu contraseña actual y define una nueva contraseña segura.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {passwordErrors.length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Box>
                {passwordErrors.map((error, index) => (
                  <Typography key={index} variant="body2">
                    • {error}
                  </Typography>
                ))}
              </Box>
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Contraseña Actual"
              type={showPasswords.current ? "text" : "password"}
              value={passwordData.currentPassword}
              onChange={(e) => handlePasswordChange('currentPassword', e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('current')}
                      edge="end"
                    >
                      {showPasswords.current ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
            <TextField
              label="Nueva Contraseña"
              type={showPasswords.new ? "text" : "password"}
              value={passwordData.newPassword}
              onChange={(e) => handlePasswordChange('newPassword', e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('new')}
                      edge="end"
                    >
                      {showPasswords.new ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
              helperText="Mínimo 8 caracteres, incluyendo mayúsculas, minúsculas y números"
            />
            <TextField
              label="Confirmar Nueva Contraseña"
              type={showPasswords.confirm ? "text" : "password"}
              value={passwordData.confirmPassword}
              onChange={(e) => handlePasswordChange('confirmPassword', e.target.value)}
              fullWidth
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => togglePasswordVisibility('confirm')}
                      edge="end"
                    >
                      {showPasswords.confirm ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button
            onClick={handleCloseChangePassword}
            variant="outlined"
            disabled={loadingPasswordChange}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmitPasswordChange}
            variant="contained"
            color="primary"
            disabled={loadingPasswordChange}
          >
            {loadingPasswordChange ? <CircularProgress size={24} /> : "Cambiar Contraseña"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Layout;
