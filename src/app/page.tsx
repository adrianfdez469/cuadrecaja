"use client";

import { useAppContext } from "@/context/AppContext";
import { 
  CircularProgress, 
  Typography, 
  Box, 
  Grid, 
  Card, 
  CardContent, 
  CardActions,
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
  Summarize
} from "@mui/icons-material";
import { useRouter } from "next/navigation";

const HomePage = () => {
  const { loadingContext, user } = useAppContext();
  const router = useRouter();

  const handleNavigate = (path: string) => {
    router.push(path);
  };

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

  if (user.tiendas.length === 0) {
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
            Para comenzar a usar el sistema, necesitas tener al menos una tienda asociada a tu usuario. 
            Contacta al administrador para que configure tu acceso.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Estado:</strong> Usuario sin tiendas asociadas
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

  if (!user.tiendaActual) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Selecciona una tienda desde el menú de usuario para continuar
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
      gradient: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)"
    },
    {
      title: "Inventario",
      description: "Consultar stock y existencias",
      icon: <Inventory fontSize="large" />,
      color: "success",
      path: "/inventario",
      gradient: "linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)"
    },
    {
      title: "Ventas",
      description: "Revisar historial de ventas",
      icon: <Receipt fontSize="large" />,
      color: "secondary",
      path: "/ventas",
      gradient: "linear-gradient(135deg, #dc004e 0%, #9a0036 100%)"
    },
    {
      title: "Movimientos",
      description: "Historial de movimientos de inventario",
      icon: <TrendingUp fontSize="large" />,
      color: "info",
      path: "/movimientos",
      gradient: "linear-gradient(135deg, #0288d1 0%, #01579b 100%)"
    },
    {
      title: "Cierre de Caja",
      description: "Cerrar período y generar reportes",
      icon: <AccountBalanceWallet fontSize="large" />,
      color: "warning",
      path: "/cierre",
      gradient: "linear-gradient(135deg, #ed6c02 0%, #e65100 100%)"
    },
    {
      title: "Resumen Cierres",
      description: "Ver historial de cierres",
      icon: <Summarize fontSize="large" />,
      color: "default",
      path: "/resumen_cierre",
      gradient: "linear-gradient(135deg, #757575 0%, #424242 100%)"
    }
  ];

  const configOptions = [
    {
      title: "Productos",
      icon: <ShoppingCart />,
      path: "/configuracion/productos"
    },
    {
      title: "Categorías", 
      icon: <BarChart />,
      path: "/configuracion/categorias"
    },
    {
      title: "Tiendas",
      icon: <Store />,
      path: "/configuracion/tiendas"
    },
    {
      title: "Usuarios",
      icon: <Person />,
      path: "/configuracion/usuarios"
    }
  ];

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
              variant="subtitle2" 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.95)',
                fontWeight: 500,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
              }}
            >
              Tienda Actual
            </Typography>
            <Typography 
              variant="h6" 
              fontWeight={600}
              sx={{
                color: '#ffffff',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                mb: 0.5
              }}
            >
              {user.tiendaActual.nombre}
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
        
        <Divider sx={{ my: 3 }} />
      </Box>

      {/* Acciones rápidas */}
      <Box sx={{ mb: 5 }}>
        <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
          Acceso Rápido
        </Typography>
        
        <Grid container spacing={3}>
          {quickActions.map((action, index) => (
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
        <Typography variant="h5" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
          Configuración del Sistema
        </Typography>
        
        <Grid container spacing={2}>
          {configOptions.map((option, index) => (
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
      </Box>
    </Container>
  );
};

export default HomePage;
