"use client";

import { PropsWithChildren, useEffect, useState } from "react";
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
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SupervisedUserCircleIcon from "@mui/icons-material/SupervisedUserCircle";
import StoreIcon from "@mui/icons-material/Store";
import CategoryIcon from "@mui/icons-material/Category";
import ChangeHistoryIcon from "@mui/icons-material/ChangeHistory";
import StorefrontIcon from "@mui/icons-material/Storefront";
import CancelPresentationIcon from "@mui/icons-material/CancelPresentation";
import GridViewIcon from "@mui/icons-material/GridView";
import SummarizeIcon from "@mui/icons-material/Summarize";
import MoveUpIcon from "@mui/icons-material/MoveUp";
import { useAppContext } from "@/context/AppContext";
import { AccountCircle } from "@mui/icons-material";
import SellIcon from "@mui/icons-material/Sell";
import BusinessCenterIcon from "@mui/icons-material/BusinessCenter";
import { cambierNegocio, cambierTienda } from "@/services/authService";
import { useSession, signOut } from "next-auth/react";
import { useMessageContext } from "@/context/MessageContext";
import { getNegocios } from "@/services/negocioServce";
import { INegocio } from "@/types/INegocio";
import LogoutIcon from "@mui/icons-material/Logout";
import ChangeCircleIcon from '@mui/icons-material/ChangeCircleOutlined';
import NextWeekIcon from '@mui/icons-material/NextWeekOutlined';
import InventoryIcon from '@mui/icons-material/Inventory';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import OfflineBanner from './OfflineBanner';

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
];
const menuItems = [
  { label: "Costos y Precios", path: "/costos_precios", icon: GridViewIcon },
  { label: "Movimientos", path: "/movimientos", icon: MoveUpIcon },
  { label: "Inventario", path: "/inventario", icon: InventoryIcon },
  { label: "Pos de ventas", path: "/pos", icon: StorefrontIcon },
  { label: "Ventas", path: "/ventas", icon: SellIcon },
  { label: "Cierre", path: "/cierre", icon: CancelPresentationIcon },
  { label: "Resumen cierres", path: "/resumen_cierre", icon: SummarizeIcon },
];

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const { user, isAuth, handleLogout, goToLogin, gotToPath } = useAppContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openSelectTienda, setOpenSelectTienda] = useState(false);
  const [openSelectNegocio, setOpenSelectNegocio] = useState(false);
  const { update, data: session } = useSession();
  const { showMessage } = useMessageContext();
  const [negocios, setNegocios] = useState<INegocio[]>([]);
  const [loadingNegocios, setLoadingNegocios] = useState(false);
  const { isOnline, wasOffline } = useNetworkStatus();

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCambiarTienda = () => {
    handleClose();
    setOpenSelectTienda(true);
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
  };
  const handleCloseCambiarNegocio = () => {
    setOpenSelectNegocio(false);
  };

  const handleSelectTienda = async (selectedTienda) => {
    console.log(selectedTienda);
    const resp = await cambierTienda(selectedTienda);
    if (resp.status === 201) {
      await update({
        tiendaActual: user.tiendas.find((t) => t.id === selectedTienda),
      });
      showMessage("La tienda fue acctualizada satisfactoriamente", "success");
    } else {
      console.log(resp);
      showMessage("No se puedo actualizar la tienda", "error");
    }
    handleCloseCambiarTienda();
  };

  const handleSelectNegocio = async (selectedNegocio) => {
    console.log(selectedNegocio);
    const resp = await cambierNegocio(selectedNegocio);
    if (resp.status === 201) {
      await update({
        negocio: negocios.find((n) => n.id === selectedNegocio),
      });
      showMessage("El negocio fue actualizado satisfactoriamente", "success");
    } else {
      console.log(resp);
      showMessage("No se pudo actualizar el negocio", "error");
    }
    handleCloseCambiarNegocio();
    handleCambiarTienda();
  };

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
      {/* Barra superior */}
      <AppBar position="static">
        <Toolbar>
          {isAuth && (
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Cuadre de Caja: {user?.negocio?.nombre || ""}
          </Typography>

          {isAuth && user ? (
            <Box display={"flex"} flexDirection={"row"} alignItems={"center"}>
              <Box
                display={"flex"}
                flexDirection={"column"}
                alignItems={"end"}
                sx={{ mr: 2 }}
              >
                <Typography variant="body1">
                  {user.nombre || user.usuario}{" "}
                </Typography>
                <Typography variant="body2">
                  {user.tiendaActual?.nombre}{" "}
                </Typography>
              </Box>

              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <AccountCircle />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                keepMounted
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                {user.rol === "SUPER_ADMIN" && (
                  <MenuItem onClick={() => handleCambiarNegocio()}>
                    <NextWeekIcon />
                    <Box pl={1}>Cambiar de Negocio</Box>
                  </MenuItem>
                )}
                {user.tiendas.filter(tienda => tienda.negocioId === user.negocio.id).length > 1 && (
                  <Box m={0}>
                    <MenuItem onClick={() => handleCambiarTienda()}>
                      <ChangeCircleIcon />
                      <Box pl={1}>Cambiar de tienda</Box>
                    </MenuItem>
                    <Divider sx={{ my: 0.5 }} />
                  </Box>
                )}
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon />
                  <Box pl={1}>Cerrar sesión</Box>
                </MenuItem>
              </Menu>

              <Dialog
                open={openSelectTienda}
                onClose={() => handleCloseCambiarTienda()}
              >
                <DialogTitle>{"Cambiar tienda"}</DialogTitle>
                <DialogContent>
                  <RadioGroup
                    onChange={(e) => handleSelectTienda(e.target.value)}
                  >
                    {user.tiendas.filter(tienda => tienda.negocioId === user.negocio.id).map((tienda) => (
                      <FormControlLabel
                        key={tienda.id}
                        value={tienda.id}
                        control={<Radio />}
                        label={tienda.nombre}
                      />
                    ))}
                  </RadioGroup>
                </DialogContent>
                <DialogActions>
                  <Button onClick={handleCloseCambiarTienda}>Cancelar</Button>
                </DialogActions>
              </Dialog>

              {user.rol === "SUPER_ADMIN" && (
                <Dialog
                  open={openSelectNegocio}
                  onClose={() => handleCloseCambiarTienda()}
                >
                  <DialogTitle>{"Cambiar negocio"}</DialogTitle>
                  <DialogContent>
                    {loadingNegocios ? (
                      <CircularProgress />
                    ) : (
                      <RadioGroup
                        onChange={(e) => handleSelectNegocio(e.target.value)}
                      >
                        {negocios.map((negocio) => (
                          <FormControlLabel
                            key={negocio.id}
                            value={negocio.id}
                            control={<Radio />}
                            label={negocio.nombre}
                          />
                        ))}
                      </RadioGroup>
                    )}
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={handleCloseCambiarNegocio}>
                      Cancelar
                    </Button>
                  </DialogActions>
                </Dialog>
              )}
            </Box>
          ) : (
            <Button color="inherit" onClick={goToLogin}>
              Entrar
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {isAuth && (
        <>
          {/* Banner de estado offline */}
          <OfflineBanner />
          
          {/* Menú lateral */}
          <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
            <Box
              sx={{ width: 250 }}
              role="presentation"
              onClick={() => setOpen(false)}
            >
              <List>
                {configurationMenuItems.map((item) => (
                  <ListItem key={item.label} disablePadding>
                    <ListItemButton onClick={() => gotToPath(item.path)}>
                      <ListItemIcon>
                        <item.icon />
                      </ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
              <Divider />
              <List>
                {menuItems.map((item) => (
                  <ListItem key={item.label} disablePadding>
                    <ListItemButton onClick={() => gotToPath(item.path)}>
                      <ListItemIcon>
                        <item.icon />
                      </ListItemIcon>
                      <ListItemText primary={item.label} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          </Drawer>
        </>
      )}

      {/* Contenido dinámico */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
};

export default Layout;
