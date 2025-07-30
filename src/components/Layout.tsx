"use client";

import {PropsWithChildren, useEffect, useRef, useState} from "react";
import {
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
  useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SupervisedUserCircleIcon from "@mui/icons-material/SupervisedUserCircle";
import StoreIcon from "@mui/icons-material/Store";
import CategoryIcon from "@mui/icons-material/Category";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import {useAppContext} from "@/context/AppContext";
import {
  AccountBalanceWallet,
  AccountCircle,
  CardGiftcardOutlined,
  GridView,
  Handshake,
  Inventory,
  LocalShipping,
  PointOfSale,
  Receipt,
  Summarize,
  SwapVert
} from "@mui/icons-material";

import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import {cambiarLocal, cambiarNegocio, getLocalesDisponibles} from "@/services/authService";
import {signOut, useSession} from "next-auth/react";
import {useMessageContext} from "@/context/MessageContext";
import {getNegocios} from "@/services/negocioServce";
import {INegocio} from "@/types/INegocio";
import LogoutIcon from "@mui/icons-material/Logout";
import ChangeCircleIcon from '@mui/icons-material/ChangeCircleOutlined';
import NextWeekIcon from '@mui/icons-material/NextWeekOutlined';
import {useNetworkStatus} from '@/hooks/useNetworkStatus';
import OfflineBanner from './OfflineBanner';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import {TipoLocal} from "@/types/ILocal";
import {excludeOnWarehouse} from "@/utils/excludeOnWarehouse";

const configurationMenuItems = [
  {
    label: "Negocios",
    path: "/configuracion/negocios",
    icon: BusinessCenterIcon,
  },
  {
    label: "Usuarios",
    path: "/configuracion/usuarios",
    icon: SupervisedUserCircleIcon,
  },
  { label: "Locales", path: "/configuracion/locales", icon: StoreIcon },
  {
    label: "Categorías",
    path: "/configuracion/categorias",
    icon: CategoryIcon,
  },
  {
    label: "Productos",
    path: "/configuracion/productos",
    icon: ChangeHistoryIcon,
  },
  {
    label: "Proveedores",
    path: "/configuracion/proveedores",
    icon: LocalShipping,
  },
  {
    label: "Destinos de Transferencia",
    path: "/configuracion/destinos-transferencia",
    icon: CardGiftcardOutlined
  },
  {
    label: "Planes y Suscripción",
    path: "/configuracion/planes",
    icon: UpgradeIcon,
  },
];

const mainMenuItems = [
  // { label: "Dashboard", path: "/dashboard", icon: <Analytics /> },
  { label: "Dashboard", path: "/dashboard-resumen", icon: <Summarize /> },
  { label: "POS", path: "/pos", icon: <PointOfSale /> },
  { label: "Ventas", path: "/ventas", icon: <Receipt /> },
  { label: "Conformar Precios", path: "/conformar_precios", icon: <GridView /> },
  { label: "Inventario", path: "/inventario", icon: <Inventory /> },
  { label: "Movimientos", path: "/movimientos", icon: <SwapVert /> },
  { label: "Proveedores Consignación", path: "/proveedores", icon: <Handshake /> },
  { label: "Cierre", path: "/cierre", icon: <AccountBalanceWallet /> },
  { label: "Resumen Cierres", path: "/resumen_cierre", icon: <Summarize /> },
  { label: "Análisis de CPP", path: "/cpp-analysis", icon: <Summarize /> },
];

const getMainMenuItemsByLocalType = (localType: string) => {
  return mainMenuItems.filter(item => {
    if(localType === TipoLocal.ALMACEN) {
      return !excludeOnWarehouse.includes(item.path);
    }
    return true;
  })
}

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { user, isAuth, handleLogout, goToLogin, gotToPath } = useAppContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openSelectLocal, setOpenSelectLocal] = useState(false);
  const [openSelectNegocio, setOpenSelectNegocio] = useState(false);
  const [cambiandoNegocio, setCambiandoNegocio] = useState(false);
  const [negocioRecienCambiado, setNegocioRecienCambiado] = useState(false);
  const selectorLocalAbiertoRef = useRef(false);
  const { update, data: session } = useSession();
  const { showMessage } = useMessageContext();
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [loadingNegocios, setLoadingNegocios] = useState(false);
  const [localesDisponibles, setLocalesDisponibles] = useState([]);
  const [loadingLocales, setLoadingLocales] = useState(false);
  const [totalLocalesDisponibles, setTotalLocalesDisponibles] = useState(0);
  const { isOnline, wasOffline } = useNetworkStatus();
  const isMobile = useMediaQuery('(max-width: 600px)');

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
      showMessage("No se puede cambiar de negocio", "error", error);
    } finally {
      setLoadingNegocios(false);
    }
  };

  const handleCloseCambiarLocal = () => {
    setOpenSelectLocal(false);
    selectorLocalAbiertoRef.current = false;
  };
  const handleCloseCambiarNegocio = () => {
    setOpenSelectNegocio(false);
  };

  const handleSelectLocal = async (selectedLocal) => {
    console.log(selectedLocal);
    const resp = await cambiarLocal(selectedLocal);
    if (resp.status === 201) {
      await update({
        localActual: localesDisponibles?.find((t) => t.id === selectedLocal),
      });
      showMessage("El local fue actualizada satisfactoriamente", "success");
    } else {
      console.log(resp);
      showMessage("No se pudo actualizar el local", "error");
    }
    handleCloseCambiarLocal();
  };

  const handleSelectNegocio = async (selectedNegocio) => {
    console.log("🔄 Iniciando cambio de negocio");
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
        
        console.log("🏪 Locales disponibles:", locales.length);
        
        // Solo abrir selector si hay locales disponibles
        if (locales.length > 0) {
          console.log("⏰ Programando apertura del selector en 300ms");
          // Esperar un poco para asegurar que la sesión se actualice
          setTimeout(() => {
            console.log("✅ Abriendo selector de local desde cambio de negocio");
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
            console.log("🔄 Reseteando negocioRecienCambiado");
            setNegocioRecienCambiado(false);
          }, 3000); // Aumentado a 3 segundos para mayor seguridad
        }
      } catch (error) {
        showMessage("Error al cargar locales disponibles", "error", error);
        setNegocioRecienCambiado(false);
      }
    } else {
      console.log(resp);
      showMessage("No se pudo actualizar el negocio", "error");
      setNegocioRecienCambiado(false);
    }
    handleCloseCambiarNegocio();
    
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

  // Cargar el conteo de locales al montar el componente
  useEffect(() => {
    if (isAuth && user && totalLocalesDisponibles === 0) {
      loadLocalesCount();
    }
  }, [isAuth, user, totalLocalesDisponibles]);

  // Detectar si el usuario necesita seleccionar una local
  useEffect(() => {
    console.log("🔍 useEffect selector local ejecutándose:", {
      negocioRecienCambiado,
      isAuth,
      localActual: !!user?.localActual,
      totalLocalesDisponibles: totalLocalesDisponibles,
      openSelectLocal: openSelectLocal,
      cambiandoNegocio,
      selectorAbierto: selectorLocalAbiertoRef.current
    });
    
    // SOLO ejecutar si NO acabamos de cambiar de negocio
    if (negocioRecienCambiado) {
      console.log("⏹️ Saliendo temprano - negocio recién cambiado");
      return; // Salir temprano si acabamos de cambiar negocio
    }
    
    // No mostrar selector automáticamente si estamos cambiando de negocio, ya está abierto, ya se abrió antes
    if (isAuth && user && !user.localActual && totalLocalesDisponibles >= 1 && !openSelectLocal && !cambiandoNegocio && !selectorLocalAbiertoRef.current) {
      console.log("🚀 Abriendo selector de local desde useEffect");
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
    if (!session && isOnline && !wasOffline) {
      goToLogin();
    }
  }, [session, isOnline, wasOffline]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Barra superior mejorada */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{ 
          backgroundColor: '#ffffff',
          color: '#1a202c',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 56, sm: 64 } }}>
          {isAuth && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setOpen(true)}
              sx={{ 
                mr: {xs: 0, sm: 2},
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            alignContent: 'center',
            // gap: {xs: 0, sm: 2}
          }}>
            <Typography
                variant="h6"
                component="h1"
                sx={{
                  fontWeight: 700,
                  background: 'linear-gradient(135deg, #1976d2 0%, #dc004e 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: {xs: '1.1rem', sm: '1.25rem'}

                }}
            >
              Cuadre de Caja
            </Typography>

            {user?.negocio?.nombre && (
                <Chip
                    label={user?.negocio?.nombre}
                    size="small"
                    variant="outlined"
                    sx={{
                      borderColor: 'primary.main',
                      color: 'primary.main',
                      fontWeight: 500,
                      display: 'flex'
                    }}
                />
            )}
          </Box>

          {isAuth && user ? (
            <Box display="flex" flexDirection={'row'} alignItems="flex-end" gap={0}>
              {/* Info del usuario mejorada */}
              <Box
                display="flex"
                flexDirection="column"
                alignItems="end"
                sx={{ 
                  mr: {xs: 0, sm: 0},
                  display: 'flex'
                }}
              >
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  {user?.nombre || user?.usuario}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.localActual?.nombre}
                </Typography>
              </Box>

              <IconButton
                // size="large"
                aria-label="cuenta del usuario actual"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                sx={{
                  // border: '2px solid transparent',
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
                    minWidth: 200,
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
                    <Divider key="divider-local" sx={{ my: 1 }} />
                 ] 
                )}
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
          {/* Banner de estado offline */}
          <OfflineBanner />
          
          {/* Menú lateral mejorado */}
          <Drawer 
            anchor="left" 
            open={open} 
            onClose={() => setOpen(false)}
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
              sx={{ width: 280 }}
              role="presentation"
              onClick={() => setOpen(false)}
            >
              {/* Header del menú */}
              <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0' }}>
                <Typography variant="h6" fontWeight={700} color="primary.main">
                  Configuración
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gestión del sistema
                </Typography>
              </Box>

              <List sx={{ pt: 2 }}>
                {configurationMenuItems
                  .filter((item) => {
                    // Solo mostrar "Negocios" a usuarios SUPER_ADMIN
                    if (item.label === "Negocios") {
                      return user?.rol === "SUPER_ADMIN";
                    }
                    return true;
                  })
                  .map((item) => (
                  <ListItem key={item.label} disablePadding sx={{ px: 2, mb: 0.5 }}>
                    <ListItemButton 
                      onClick={() => gotToPath(item.path)}
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
              
              <Divider sx={{ mx: 2, my: 2 }} />
              
              {/* Operaciones principales */}
              <Box sx={{ px: 3, pb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Operaciones
                </Typography>
              </Box>
              
              {user?.localActual && (
              <List sx={{ pt: 0 }}>
                {getMainMenuItemsByLocalType(user.localActual.tipo).map((item) => (
                  <ListItem key={item.label} disablePadding sx={{ px: 2, mb: 0.5 }}>
                    <ListItemButton 
                      onClick={() => gotToPath(item.path)}
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
                          fontWeight: 500,
                          fontSize: '0.875rem'
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              )}
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
          minHeight: 'calc(100vh - 64px)',
          p: { xs: 0, sm: 1, md: 2 },
        }}
      >
        <Container 
          maxWidth="xl" 
          sx={{ 
            py: 0,
            px: { xs: 0.5, sm: 2, md: 3 }
          }}
        >
          {children}
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
          <Typography variant="h6" fontWeight={600}>
            {!user?.localActual ? 'Seleccionar local' : 'Cambiar local'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
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
              {localesDisponibles?.map((local) => (
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
            <Button onClick={handleCloseCambiarLocal} variant="outlined">
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
            <Typography variant="h6" fontWeight={600}>
              Cambiar negocio
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Selecciona el negocio al que deseas cambiar
            </Typography>
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
                {negocios.map((negocio) => (
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
    </Box>
  );
};

export default Layout;
