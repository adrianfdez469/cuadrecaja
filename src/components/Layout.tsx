"use client";

import { useState } from "react";
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
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useRouter } from "next/navigation";
import SupervisedUserCircleIcon from '@mui/icons-material/SupervisedUserCircle';
import StoreIcon from '@mui/icons-material/Store';
import CategoryIcon from '@mui/icons-material/Category';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';
import GridViewIcon from '@mui/icons-material/GridView';

const configurationMenuItems = [
  { label: "Usuarios", path: "/configuracion/usuarios", icon: SupervisedUserCircleIcon },
  { label: "Tiendas", path: "/configuracion/tiendas", icon: StoreIcon  },
  { label: "Categorías", path: "/configuracion/categorias", icon: CategoryIcon },
  { label: "Productos", path: "/configuracion/productos", icon: ChangeHistoryIcon },
];
const menuItems = [
  { label: "Cantidades y Precios", path: "/cantidades_precios", icon: GridViewIcon },
  { label: "Ventas", path: "/ventas", icon: StorefrontIcon },
  { label: "Cierre", path: "/cierre", icon: CancelPresentationIcon },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleLogout = () => {
    // Aquí puedes limpiar el estado de autenticación y redirigir al login
    router.push("/login");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Barra superior */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={() => setOpen(true)}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Cuadre de Caja
          </Typography>
          <Button color="inherit" onClick={handleLogout}>
            Cerrar Sesión
          </Button>
        </Toolbar>
      </AppBar>

      {/* Menú lateral */}
      <Drawer anchor="left" open={open} onClose={() => setOpen(false)}>
        {/* <List>
          {menuItems.map((item) => (
            <ListItem key={item.label} onClick={() => router.push(item.path)}>
              <ListItemText primary={item.label} />
            </ListItem>
          ))}
        </List> */}
        <Box
          sx={{ width: 250 }}
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <List>
            {configurationMenuItems.map((item, index) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton onClick={() => router.push(item.path)}>
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
            {menuItems.map((item, index) => (
              <ListItem key={item.label} disablePadding>
                <ListItemButton onClick={() => router.push(item.path)}>
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

      {/* Contenido dinámico */}
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}
