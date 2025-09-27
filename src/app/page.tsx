"use client";

import { useAppContext } from "@/context/AppContext";
import {
  CircularProgress,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Container,
  Paper,
  Avatar,
  IconButton,
  Divider,
  Alert
} from "@mui/material";
import {
  Storefront,
  Inventory,
  TrendingUp,
  AccountBalanceWallet,
  Receipt,
  BarChart,
  Settings,
  Person,
  Store,
  ShoppingCart,
  Summarize,
  Security,
  CalendarMonth
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { TipoLocal } from "@/types/ILocal";
import { excludeOnWarehouse } from "@/utils/excludeOnWarehouse";
import { usePermisos } from "@/utils/permisos_front";
import NotificationsWidget from "@/components/NotificationsWidget";
import SubscriptionWarning from "@/components/SubscriptionWarning";
import SuspensionSummary from "@/components/SuspensionSummary";
import { useEffect, useState } from "react";
import axios from "axios";
import { getNegocioStats } from "@/services/negocioServce";
import { formatDate } from "@/utils/formatters";

interface NegocioStats {
  tiendas: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  usuarios: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  productos: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  fechaVencimiento: Date;
  diasRestantes: number;
}

const HomePage = () => {
  const { loadingContext, user } = useAppContext();
  const router = useRouter();
  const { verificarPermiso } = usePermisos();
  const [loadingNegocioStats, setLoadingNegocioStats] = useState(true);
  const [negocioStats, setNegocioStats] = useState<NegocioStats>();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

  useEffect(() => {

    const fetchNegocioStats = async () => {
      setLoadingNegocioStats(true);
      const stats = await getNegocioStats();
      console.log(stats);
      setNegocioStats(stats);
      setLoadingNegocioStats(false);
    }
    fetchNegocioStats();
  }, []);

  if (loadingContext) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="60vh"
        flexDirection="column"
        gap={2}
      >
        <CircularProgress size="3rem" />
        <Typography variant="body1" color="text.secondary">
          Cargando panel de control...
        </Typography>
      </Box>
    );
  }

  if (user.locales.length === 0) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper
          elevation={0}
          sx={{
            p: 4,
            textAlign: 'center',
            backgroundColor: 'background.paper',
            borderRadius: 3,
            border: '1px solid',
            borderColor: 'divider'
          }}
        >
          <Avatar
            sx={{
              width: 80,
              height: 80,
              mx: 'auto',
              mb: 3,
              bgcolor: 'primary.main'
            }}
          >
            <Store fontSize="large" />
          </Avatar>

          <Typography variant="h4" gutterBottom color="text.primary">
            ¡Bienvenido a Cuadre de Caja!
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 500, mx: 'auto' }}>
            Para comenzar a usar el sistema, necesitas tener al menos un local asociada a tu usuario.
            Contacta al administrador para que configure tu acceso.
          </Typography>

          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Estado:</strong> Usuario sin locales asociadas
            </Typography>
          </Alert>

          <Button
            variant="contained"
            size="large"
            startIcon={<Settings />}
            onClick={() => handleNavigate('/configuracion')}
            sx={{ minWidth: 200 }}
          >
            Ir a Configuración
          </Button>
        </Paper>
      </Container>
    );
  }

  // if (!user.tieaActual) {
  if (!user.localActual) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Selecciona un local desde el menú de usuario para continuar
        </Alert>
      </Container>
    );
  }

  const quickActions = [
    {
      title: "Punto de Venta",
      description: "Realizar ventas y gestionar transacciones",
      icon: <Storefront fontSize="large" />,
      color: "primary",
      path: "/pos",
      gradient: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
      permission: 'operaciones.pos-venta.acceder'
    },
    {
      title: "Inventario",
      description: "Consultar stock y existencias",
      icon: <Inventory fontSize="large" />,
      color: "success",
      path: "/inventario",
      gradient: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)",
      permission: 'recuperaciones.inventario.acceder'
    },
    {
      title: "Ventas",
      description: "Revisar historial de ventas",
      icon: <Receipt fontSize="large" />,
      color: "secondary",
      path: "/ventas",
      gradient: "linear-gradient(135deg, #dc004e 0%, #9a0036 100%)",
      permission: 'operaciones.ventas.acceder'
    },
    {
      title: "Movimientos",
      description: "Historial de movimientos de inventario",
      icon: <TrendingUp fontSize="large" />,
      color: "info",
      path: "/movimientos",
      gradient: "linear-gradient(135deg, #0288d1 0%, #01579b 100%)",
      permission: 'operaciones.movimientos.acceder'
    },
    {
      title: "Cierre de Caja",
      description: "Cerrar período y generar reportes",
      icon: <AccountBalanceWallet fontSize="large" />,
      color: "warning",
      path: "/cierre",
      gradient: "linear-gradient(135deg, #ed6c02 0%, #e65100 100%)",
      permission: 'operaciones.cierre.acceder'
    },
    {
      title: "Resumen Cierres",
      description: "Ver historial de cierres",
      icon: <Summarize fontSize="large" />,
      color: "default",
      path: "/resumen_cierre",
      gradient: "linear-gradient(135deg, #757575 0%, #424242 100%)",
      permission: 'recuperaciones.resumencierres.acceder'
    }
  ];

  const configOptions = [
    {
      title: "Productos",
      icon: <ShoppingCart />,
      path: "/configuracion/productos",
      permission: 'configuracion.productos.acceder'
    },
    {
      title: "Categorías",
      icon: <BarChart />,
      path: "/configuracion/categorias",
      permission: 'configuracion.categorias.acceder'
    },
    {
      title: "Locales",
      icon: <Store />,
      path: "/configuracion/locales",
      permission: 'configuracion.locales.acceder'
    },
    {
      title: "Usuarios",
      icon: <Person />,
      path: "/configuracion/usuarios",
      permission: 'configuracion.usuarios.acceder'
    },
    {
      title: "Roles",
      icon: <Security />,
      path: "/configuracion/roles",
      permission: 'configuracion.roles.acceder'
    }
  ];


  const getQuickAction = (localType: string) => {
    return quickActions.filter(item => {
      if (//user.permisos.includes(item.permission)
        verificarPermiso(item.permission)
        || user.rol === 'SUPER_ADMIN') {
        if (localType === TipoLocal.ALMACEN) {
          return !excludeOnWarehouse.includes(item.path);
        }
        return true;
      }
    })
  };

  const getConfigOptions = () => {
    return configOptions.filter(item => {
      if (//user.permisos.includes(item.permission) 
        verificarPermiso(item.permission)
        || user.rol === 'SUPER_ADMIN') {
        return true;
      }
    })
  }

  const getTipoLocalText = (tipoLocal: string) => {
    return tipoLocal === TipoLocal.ALMACEN ? 'Alamcén' : 'Tienda';
  }



  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      {/* Header mejorado */}
      <Box sx={{ mb: 4 }}>
        <Box
          display="flex"
          flexDirection={{ xs: "column", md: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", md: "flex-start" }}
          gap={{ xs: 3, md: 0 }}
          mb={2}
        >
          <Box>
            <Typography
              variant="h3"
              gutterBottom
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(135deg, #1976d2 0%, #dc004e 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontSize: { xs: '2rem', sm: '2.5rem', md: '3rem' }
              }}
            >
              Panel de Control
            </Typography>
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              Bienvenido, {user.nombre || user.usuario}
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              p: 2,
              bgcolor: 'primary.main',
              color: 'white',
              borderRadius: 2,
              minWidth: { xs: '100%', md: 200 },
              width: { xs: '100%', md: 'auto' },
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.2)'
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: 'rgba(255, 255, 255, 0.95)',
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                display: 'flex',
                flexDirection: 'row',
                alignContent: 'center',
                justifyItems: 'center',
                alignItems: 'center'
              }}
            >
              {`${getTipoLocalText(user.localActual.tipo)}: ${user.localActual.nombre}`}

            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.92)',
                fontWeight: 400,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
              }}
            >
              {user.negocio?.nombre}
            </Typography>





          </Paper>
        </Box>

        <Divider sx={{ my: 1 }} />
        <Box display="flex" flexDirection="row" gap={1}>
          <Chip
            label={`Productos: ${negocioStats?.productos.actual} / ${ user.negocio?.productlimit === -1 ? '∞' : user.negocio?.productlimit} (${negocioStats?.productos.porcentaje}%)`}
            icon={<ShoppingCart />}
            color={negocioStats?.productos.porcentaje <= 0 ? 'error' : negocioStats?.productos.porcentaje <= 10 ? 'warning' : 'success'}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'primary.main', color: 'primary.main', fontWeight: 500 }}
          />
          <Chip
            label={`Usuarios: ${negocioStats?.usuarios.actual} / ${ user.negocio?.userlimit === -1 ? '∞' : user.negocio?.userlimit} (${negocioStats?.usuarios.porcentaje}%)`}
            icon={<Person />}
            color={negocioStats?.usuarios.porcentaje <= 0 ? 'error' : negocioStats?.usuarios.porcentaje <= 3 ? 'warning' : 'success'}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'primary.main', color: 'primary.main', fontWeight: 500 }}
          />
          <Chip
            label={`Tiendas: ${negocioStats?.tiendas.actual} / ${ user.negocio?.locallimit === -1 ? '∞' : user.negocio?.locallimit} (${negocioStats?.tiendas.porcentaje}%)`}
            icon={<Store />}
            color={negocioStats?.tiendas.porcentaje <= 0 ? 'error' : negocioStats?.tiendas.porcentaje <= 30 ? 'warning' : 'success'}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'primary.main', color: 'primary.main', fontWeight: 500 }}
          />
          <Chip
            label={`Fecha de vencimiento: ${formatDate(negocioStats?.fechaVencimiento)} - ${negocioStats?.diasRestantes} días restantes`}
            icon={<CalendarMonth />}
            color={negocioStats?.diasRestantes <= 0 ? 'error' : negocioStats?.diasRestantes <= 7 ? 'warning' : 'success'}
            size="small"
            variant="outlined"
            sx={{ borderColor: 'primary.main', color: 'primary.main', fontWeight: 500 }}
          />
        </Box>
        <Divider sx={{ my: 1 }} />
      </Box>

      {/* Widget de Notificaciones */}
      <Box sx={{ mb: 3 }}>
        <SuspensionSummary />
        <SubscriptionWarning />
        <NotificationsWidget maxNotifications={5} showBadge={true} />
      </Box>

      {/* Acciones rápidas */}
      <Box sx={{ mb: 5 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
          Acceso Rápido
        </Typography>

        <Grid container spacing={3}>

          {getQuickAction(user.localActual.tipo).map((action, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 24px rgba(0, 0, 0, 0.15)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onClick={() => handleNavigate(action.path)}
              >
                {/* Fondo con gradiente */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 4,
                    background: action.gradient,
                  }}
                />

                <CardContent sx={{ p: 3 }}>
                  <Box display="flex" alignItems="flex-start" gap={2}>
                    <Avatar
                      sx={{
                        background: action.gradient,
                        width: 56,
                        height: 56,
                      }}
                    >
                      {action.icon}
                    </Avatar>

                    <Box flex={1}>
                      <Typography variant="h6" gutterBottom fontWeight={600}>
                        {action.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {action.description}
                      </Typography>

                      <Chip
                        label="Acceder"
                        size="small"
                        variant="outlined"
                        sx={{
                          borderColor: 'primary.main',
                          color: 'primary.main',
                          fontWeight: 500
                        }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Configuración */}
      <Box>
        {getConfigOptions().length > 0 &&
          <>
            <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
              Configuración del Sistema
            </Typography>

            <Grid container spacing={2}>
              {getConfigOptions().map((option, index) => (
                <Grid item xs={6} sm={3} key={index}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      textAlign: 'center',
                      p: 2,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => handleNavigate(option.path)}
                  >
                    <IconButton
                      size="large"
                      sx={{
                        mb: 1,
                        bgcolor: 'primary.light',
                        color: 'white',
                        '&:hover': {
                          bgcolor: 'primary.main',
                        }
                      }}
                    >
                      {option.icon}
                    </IconButton>
                    <Typography variant="subtitle2" fontWeight={500}>
                      {option.title}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        }
      </Box>
    </Container>
  );
};

export default HomePage;
