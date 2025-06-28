"use client";

import { PropsWithChildren, useEffect, useState, useRef } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Box,
  Button,
  ListItemButton,
  ListItemIcon,
  Divider,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControlLabel,
  Radio,
  RadioGroup,
  DialogActions,
  CircularProgress,
  Chip,
  Container,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SupervisedUserCircleIcon from "@mui/icons-material/SupervisedUserCircle";
import StoreIcon from "@mui/icons-material/Store";
import CategoryIcon from "@mui/icons-material/Category";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import { useAppContext } from "@/context/AppContext";
import { AccountCircle } from "@mui/icons-material";

import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { cambierNegocio, cambierTienda, getTiendasDisponibles } from "@/services/authService";
import { useSession, signOut } from "next-auth/react";
import { useMessageContext } from "@/context/MessageContext";
import { getNegocios } from "@/services/negocioServce";
import { INegocio } from "@/types/INegocio";
import LogoutIcon from "@mui/icons-material/Logout";
import ChangeCircleIcon from '@mui/icons-material/ChangeCircleOutlined';
import NextWeekIcon from '@mui/icons-material/NextWeekOutlined';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import OfflineBanner from './OfflineBanner';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import { 
  Analytics, 
  PointOfSale, 
  Receipt, 
  AccountBalanceWallet,
  SwapVert,
  Inventory,
  Summarize,
  GridView,
} from '@mui/icons-material';

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
  { label: "Tiendas", path: "/configuracion/tiendas", icon: StoreIcon },
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
    label: "Planes y Suscripción",
    path: "/configuracion/planes",
    icon: UpgradeIcon,
  },
];

const mainMenuItems = [
  { label: "Dashboard", path: "/dashboard", icon: <Analytics /> },
  { label: "POS", path: "/pos", icon: <PointOfSale /> },
  { label: "Ventas", path: "/ventas", icon: <Receipt /> },
  { label: "Costos y Precios", path: "/costos_precios", icon: <GridView /> },
  { label: "Inventario", path: "/inventario", icon: <Inventory /> },
  { label: "Movimientos", path: "/movimientos", icon: <SwapVert /> },
  { label: "Cierre", path: "/cierre", icon: <AccountBalanceWallet /> },
  { label: "Resumen Cierres", path: "/resumen_cierre", icon: <Summarize /> },
];

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { user, isAuth, handleLogout, goToLogin, gotToPath } = useAppContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openSelectTienda, setOpenSelectTienda] = useState(false);
  const [openSelectNegocio, setOpenSelectNegocio] = useState(false);
  const [cambiandoNegocio, setCambiandoNegocio] = useState(false);
  const [negocioRecienCambiado, setNegocioRecienCambiado] = useState(false);
  const selectorTiendaAbiertoRef = useRef(false);
  const { update, data: session } = useSession();
  const { showMessage } = useMessageContext();
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [loadingNegocios, setLoadingNegocios] = useState(false);
  const [tiendasDisponibles, setTiendasDisponibles] = useState([]);
  const [loadingTiendas, setLoadingTiendas] = useState(false);
  const [totalTiendasDisponibles, setTotalTiendasDisponibles] = useState(0);
  const { isOnline, wasOffline } = useNetworkStatus();

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCambiarTienda = async () => {
    try {
      setLoadingTiendas(true);
      handleClose();
      const tiendas = await getTiendasDisponibles();
      setTiendasDisponibles(tiendas);
      setTotalTiendasDisponibles(tiendas.length);
      setOpenSelectTienda(true);
      selectorTiendaAbiertoRef.current = true;
    } catch (error) {
      showMessage("No se pueden cargar las tiendas disponibles", "error", error);
    } finally {
      setLoadingTiendas(false);
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

  const handleCloseCambiarTienda = () => {
    setOpenSelectTienda(false);
    selectorTiendaAbiertoRef.current = false;
  };
  const handleCloseCambiarNegocio = () => {
    setOpenSelectNegocio(false);
  };

  const handleSelectTienda = async (selectedTienda) => {
    console.log(selectedTienda);
    const resp = await cambierTienda(selectedTienda);
    if (resp.status === 201) {
      await update({
        tiendaActual: tiendasDisponibles?.find((t) => t.id === selectedTienda),
      });
      showMessage("La tienda fue actualizada satisfactoriamente", "success");
    } else {
      console.log(resp);
      showMessage("No se pudo actualizar la tienda", "error");
    }
    handleCloseCambiarTienda();
  };

  const handleSelectNegocio = async (selectedNegocio) => {
    console.log("🔄 Iniciando cambio de negocio");
    setCambiandoNegocio(true);
    setNegocioRecienCambiado(true);
    selectorTiendaAbiertoRef.current = false; // Reset del ref
    
    const resp = await cambierNegocio(selectedNegocio);
    if (resp.status === 201) {
      await update({
        negocio: negocios.find((n) => n.id === selectedNegocio),
        tiendaActual: null, // Limpiar tienda actual al cambiar negocio
      });
      showMessage("El negocio fue actualizado satisfactoriamente", "success");
      
      // Cargar las nuevas tiendas disponibles y abrir selector
      try {
        const tiendas = await getTiendasDisponibles();
        setTiendasDisponibles(tiendas);
        setTotalTiendasDisponibles(tiendas.length);
        
        console.log("🏪 Tiendas disponibles:", tiendas.length);
        
        // Solo abrir selector si hay tiendas disponibles
        if (tiendas.length > 0) {
          console.log("⏰ Programando apertura del selector en 300ms");
          // Esperar un poco para asegurar que la sesión se actualice
          setTimeout(() => {
            console.log("✅ Abriendo selector de tienda desde cambio de negocio");
            setOpenSelectTienda(true);
            selectorTiendaAbiertoRef.current = true;
          }, 300);
        } else {
          // Si no hay tiendas, mostrar mensaje y resetear flags inmediatamente
          showMessage("Este negocio no tiene tiendas disponibles", "warning");
          setNegocioRecienCambiado(false);
        }
        
        // Resetear el flag después de un tiempo más largo solo si hay tiendas
        if (tiendas.length > 0) {
          setTimeout(() => {
            console.log("🔄 Reseteando negocioRecienCambiado");
            setNegocioRecienCambiado(false);
          }, 3000); // Aumentado a 3 segundos para mayor seguridad
        }
      } catch (error) {
        showMessage("Error al cargar tiendas disponibles", "error", error);
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

  // Función para cargar el conteo de tiendas disponibles
  const loadTiendasCount = async () => {
    try {
      // Solo cargar si no tenemos el conteo aún
      if (totalTiendasDisponibles === 0) {
        const tiendas = await getTiendasDisponibles();
        setTotalTiendasDisponibles(tiendas.length);
      }
    } catch (error) {
      console.error("Error al obtener conteo de tiendas:", error);
    }
  };

  // Cargar el conteo de tiendas al montar el componente
  useEffect(() => {
    if (isAuth && user && totalTiendasDisponibles === 0) {
      loadTiendasCount();
    }
  }, [isAuth, user, totalTiendasDisponibles]);

  // Detectar si el usuario necesita seleccionar una tienda
  useEffect(() => {
    console.log("🔍 useEffect selector tienda ejecutándose:", {
      negocioRecienCambiado,
      isAuth,
      tiendaActual: !!user?.tiendaActual,
      totalTiendasDisponibles,
      openSelectTienda,
      cambiandoNegocio,
      selectorAbierto: selectorTiendaAbiertoRef.current
    });
    
    // SOLO ejecutar si NO acabamos de cambiar de negocio
    if (negocioRecienCambiado) {
      console.log("⏹️ Saliendo temprano - negocio recién cambiado");
      return; // Salir temprano si acabamos de cambiar negocio
    }
    
    // No mostrar selector automáticamente si estamos cambiando de negocio, ya está abierto, ya se abrió antes
    if (isAuth && user && !user.tiendaActual && totalTiendasDisponibles >= 1 && !openSelectTienda && !cambiandoNegocio && !selectorTiendaAbiertoRef.current) {
      console.log("🚀 Abriendo selector de tienda desde useEffect");
      // Mostrar automáticamente el selector de tienda si el usuario no tiene una asignada
      handleCambiarTienda();
    }
  }, [isAuth, user?.tiendaActual, totalTiendasDisponibles, openSelectTienda, cambiandoNegocio, negocioRecienCambiado]);

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
                mr: 2,
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.08)',
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
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
            
            {user?.negocio?.nombre && (
              <Chip 
                label={user?.negocio?.nombre}
                size="small"
                variant="outlined"
                sx={{ 
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  fontWeight: 500,
                  display: { xs: 'none', sm: 'flex' }
                }}
              />
            )}
          </Box>

          {isAuth && user ? (
            <Box display="flex" alignItems="center" gap={1}>
              {/* Info del usuario mejorada */}
              <Box
                display="flex"
                flexDirection="column"
                alignItems="end"
                sx={{ 
                  mr: 1,
                  display: { xs: 'none', md: 'flex' }
                }}
              >
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  {user?.nombre || user?.usuario}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {user?.tiendaActual?.nombre}
                </Typography>
              </Box>

              <IconButton
                size="large"
                aria-label="cuenta del usuario actual"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                sx={{
                  border: '2px solid transparent',
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
                {(user.rol === "SUPER_ADMIN" || totalTiendasDisponibles > 1 || (totalTiendasDisponibles >= 1 && !user?.tiendaActual)) && (
                [
                    <MenuItem key="cambiar-tienda" onClick={() => handleCambiarTienda()}>
                      <ChangeCircleIcon sx={{ mr: 2, color: 'info.main' }} />
                      <Typography variant="body2" fontWeight={500}>
                        {!user?.tiendaActual ? 'Seleccionar tienda' : 'Cambiar de tienda'}
                      </Typography>
                    </MenuItem>,
                    <Divider key="divider-tienda" sx={{ my: 1 }} />
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
              
              <List sx={{ pt: 0 }}>
                {mainMenuItems.map((item) => (
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
        open={openSelectTienda}
        onClose={user?.tiendaActual || tiendasDisponibles.length === 0 ? () => handleCloseCambiarTienda() : undefined}
        disableEscapeKeyDown={!user?.tiendaActual && tiendasDisponibles.length > 0}
        PaperProps={{
          sx: {
            borderRadius: 3,
            minWidth: 400,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            {!user?.tiendaActual ? 'Seleccionar tienda' : 'Cambiar tienda'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {!user?.tiendaActual 
              ? 'Necesitas seleccionar una tienda para comenzar a trabajar'
              : 'Selecciona la tienda donde deseas trabajar'
            }
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {!user?.tiendaActual && tiendasDisponibles.length === 1 && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'info.light', borderRadius: 1 }}>
              <Typography variant="body2" color="info.contrastText">
                <strong>Nota:</strong> Necesitas seleccionar una tienda para acceder al sistema.
              </Typography>
            </Box>
          )}
          {tiendasDisponibles.length === 0 && !loadingTiendas && (
            <Box sx={{ mb: 2, p: 2, backgroundColor: 'warning.light', borderRadius: 1, textAlign: 'center' }}>
              <Typography variant="body2" color="warning.contrastText">
                <strong>Sin tiendas disponibles</strong>
              </Typography>
              <Typography variant="body2" color="warning.contrastText" sx={{ mt: 1 }}>
                Este negocio no tiene tiendas configuradas. Contacta al administrador para crear tiendas.
              </Typography>
            </Box>
          )}
          {loadingTiendas ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : tiendasDisponibles.length > 0 ? (
            <RadioGroup
              onChange={(e) => handleSelectTienda(e.target.value)}
            >
              {tiendasDisponibles?.map((tienda) => (
                <FormControlLabel
                  key={tienda.id}
                  value={tienda.id}
                  control={<Radio color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {tienda.nombre}
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
          {(user?.tiendaActual || tiendasDisponibles.length === 0) && (
            <Button onClick={handleCloseCambiarTienda} variant="outlined">
              {tiendasDisponibles.length === 0 ? 'Cerrar' : 'Cancelar'}
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
