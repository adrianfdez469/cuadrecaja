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
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import SupervisedUserCircleIcon from '@mui/icons-material/SupervisedUserCircle';
import StoreIcon from '@mui/icons-material/Store';
import CategoryIcon from '@mui/icons-material/Category';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';
import GridViewIcon from '@mui/icons-material/GridView';
import SummarizeIcon from '@mui/icons-material/Summarize';
import MoveUpIcon from '@mui/icons-material/MoveUp';
import { useAppContext } from "@/context/AppContext";
import { AccountCircle } from "@mui/icons-material";
import SellIcon from '@mui/icons-material/Sell';

const configurationMenuItems = [
  { label: "Usuarios", path: "/configuracion/usuarios", icon: SupervisedUserCircleIcon },
  { label: "Tiendas", path: "/configuracion/tiendas", icon: StoreIcon  },
  { label: "Categorías", path: "/configuracion/categorias", icon: CategoryIcon },
  { label: "Productos", path: "/configuracion/productos", icon: ChangeHistoryIcon },
];
const menuItems = [
  { label: "Costos y Precios", path: "/costos_precios", icon: GridViewIcon },
  { label: "Movimientos", path: "/movimientos", icon: MoveUpIcon },
  { label: "Pos de ventas", path: "/pos", icon: StorefrontIcon },
  { label: "Ventas", path: "/ventas", icon: SellIcon },
  { label: "Cierre", path: "/cierre", icon: CancelPresentationIcon },
  { label: "Resumen cierres", path: "/resumen_cierre", icon: SummarizeIcon},
];

const Layout:React.FC<PropsWithChildren> = ({children}) => {
  const [open, setOpen] = useState(false);
  const { user, isAuth, handleLogout, goToLogin, gotToPath } = useAppContext();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Barra superior */}
      <AppBar position="static">
        <Toolbar>
          {isAuth &&
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={() => setOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          }
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Cuadre de Caja
          </Typography>
          
          { isAuth && user ?
             <Box display={'flex'} flexDirection={'row'} alignItems={'center'}>
              
              <Box display={'flex'} flexDirection={'column'} alignItems={'end'} sx={{mr: 2}}>
                <Typography variant="body1">{user.nombre || user.usuario} </Typography>
                <Typography variant="body2">{user.tiendaActual?.nombre} </Typography>
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
                  vertical: 'top',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem onClick={handleLogout}>Cerrar sesión</MenuItem>
              </Menu>
            </Box>  : 
            <Button color="inherit" onClick={goToLogin}>
              Entrar
            </Button>
          }
        </Toolbar>
      </AppBar>

      { isAuth && 
      <>
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
      }
      

      {/* Contenido dinámico */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}

export default Layout;
