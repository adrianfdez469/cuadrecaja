"use client";

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Divider,
  Alert,
  useTheme,
  useMediaQuery,
  Avatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Star,
  ContactSupport,
  WhatsApp,
  Phone,
  Business,
  Store,
  Person,
  Inventory,
  Schedule,
  Warning,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { planesNegocio } from '@/utils/planesNegocio';
import { PageContainer } from '@/components/PageContainer';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import { 
  formatDate, 
  formatDaysRemaining, 
  getDaysRemainingColor,
  formatPercentage 
} from '@/utils/formatters';
import axios from 'axios';
import { subscriptionPlansForUi } from '@/constants/subscriptionsPlans';

interface SupportUser {
  name: string;
  phone: string;
  whatsapp: string;
}

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

const supportUsers: SupportUser[] = [
  {
    name: 'Adrian',
    phone: '+53 5 3334449',
    whatsapp: '+5353334449'
  },
  {
    name: 'Camilo',
    phone: '+53 5 4319958',
    whatsapp: '+5354319958'
  }
];

export default function PlanesPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAppContext();
  const { showMessage } = useMessageContext();
  const [showContactSupport, setShowContactSupport] = useState(false);
  const [selectedSupport, setSelectedSupport] = useState<string>('');
  const [stats, setStats] = useState<NegocioStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Cargar estadísticas del negocio
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoadingStats(true);
        const response = await axios.get('/api/negocio/stats');
        setStats(response.data);
      } catch (error) {
        console.error('Error al cargar estadísticas:', error);
        showMessage('Error al cargar estadísticas del negocio', 'error');
      } finally {
        setLoadingStats(false);
      }
    };

    if (user?.negocio) {
      fetchStats();
    }
  }, [user?.negocio, showMessage]);

  const handleContactSupport = () => {
    setShowContactSupport(true);
  };

  const handleCloseContactSupport = () => {
    setShowContactSupport(false);
    setSelectedSupport('');
  };

  const handleContactSelected = () => {
    const selectedUser = supportUsers.find(u => u.name === selectedSupport);
    if (selectedUser) {
      // Abrir WhatsApp con mensaje predefinido
      const message = encodeURIComponent(
        `Hola ${selectedUser.name}, me interesa obtener más información sobre los planes de suscripción de Cuadre de Caja. Mi negocio es: ${user?.negocio?.nombre || 'Sin especificar'}`
      );
      window.open(`https://wa.me/${selectedUser.whatsapp.replace(/\s/g, '')}?text=${message}`, '_blank');
      showMessage('Redirigiendo a WhatsApp...', 'info');
    }
    handleCloseContactSupport();
  };

  // Determinar el plan actual del usuario
  const getCurrentPlan = () => {
    if (!user?.negocio) return null;
    
    const currentLimits = {
      tiendas: user.negocio.locallimit,
      usuarios: user.negocio.userlimit,
      productos: user.negocio.productlimit
    };

    const planEntry = Object.entries(planesNegocio).find(
      ([, plan]) => 
        plan.limiteLocales === currentLimits.tiendas && 
        plan.limiteUsuarios === currentLimits.usuarios &&
        plan.limiteProductos === currentLimits.productos
    );

    return planEntry ? planEntry[0] : 'CUSTOM';
  };

  const currentPlan = getCurrentPlan();

  const breadcrumbs = [
    { label: 'Inicio', href: '/home' },
    { label: 'Configuración', href: '/configuracion' },
    { label: 'Planes y Suscripción' }
  ];

  // Componente para mostrar estadísticas de uso
  const UsageStatsCard = ({ icon, title, actual, limite, porcentaje }: {
    icon: React.ReactNode;
    title: string;
    actual: number;
    limite: number;
    porcentaje: number;
    color: string;
  }) => {
    const isUnlimited = limite === -1;
    const isNearLimit = porcentaje >= 80 && !isUnlimited;
    const isOverLimit = porcentaje >= 100 && !isUnlimited;

    return (
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          {icon}
          <Typography variant="body2" fontWeight="medium">
            {title}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6" fontWeight="bold">
            {actual}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            de {isUnlimited ? '∞' : limite}
          </Typography>
          {!isUnlimited && (
            <Chip
              label={formatPercentage(porcentaje)}
              size="small"
              color={isOverLimit ? 'error' : isNearLimit ? 'warning' : 'success'}
              variant="outlined"
            />
          )}
        </Stack>
        {!isUnlimited && (
          <LinearProgress
            variant="determinate"
            value={Math.min(porcentaje, 100)}
            sx={{
              mt: 1,
              height: 6,
              borderRadius: 3,
              backgroundColor: 'grey.200',
              '& .MuiLinearProgress-bar': {
                backgroundColor: isOverLimit ? 'error.main' : isNearLimit ? 'warning.main' : 'success.main',
                borderRadius: 3,
              }
            }}
          />
        )}
      </Box>
    );
  };

  return (
    <PageContainer
      title="Planes y Suscripción"
      subtitle={!isMobile ? "Elige el plan que mejor se adapte a las necesidades de tu negocio" : undefined}
      breadcrumbs={breadcrumbs}
    >
      {/* Información del plan actual con estadísticas */}
      {currentPlan && (
        <Alert 
          severity="info" 
          sx={{ mb: 4 }}
          icon={<Business />}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1 }}>
              Plan Actual: {currentPlan}
            </Typography>
            
            {loadingStats ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
                <CircularProgress size={20} />
                <Typography variant="body2">Cargando estadísticas...</Typography>
              </Box>
            ) : stats ? (
              <Grid container spacing={3}>
                {/* Estadísticas de uso */}
                <Grid item xs={12} md={8}>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    {user?.negocio?.nombre} está usando el plan {currentPlan.toLowerCase()} con el siguiente uso:
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <UsageStatsCard
                        icon={<Store color="primary" />}
                        title="Locales"
                        actual={stats.tiendas.actual}
                        limite={stats.tiendas.limite}
                        porcentaje={stats.tiendas.porcentaje}
                        color="primary"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <UsageStatsCard
                        icon={<Person color="secondary" />}
                        title="Usuarios"
                        actual={stats.usuarios.actual}
                        limite={stats.usuarios.limite}
                        porcentaje={stats.usuarios.porcentaje}
                        color="secondary"
                      />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <UsageStatsCard
                        icon={<Inventory color="info" />}
                        title="Productos"
                        actual={stats.productos.actual}
                        limite={stats.productos.limite}
                        porcentaje={stats.productos.porcentaje}
                        color="info"
                      />
                    </Grid>
                  </Grid>
                </Grid>

                {/* Información de vencimiento */}
                <Grid item xs={12} md={4}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack alignItems="center" spacing={2}>
                        <Box sx={{ textAlign: 'center' }}>
                          {stats.diasRestantes <= 0 ? (
                            <ErrorIcon color="error" sx={{ fontSize: 40 }} />
                          ) : stats.diasRestantes <= 7 ? (
                            <Warning color="warning" sx={{ fontSize: 40 }} />
                          ) : (
                            <Schedule color="success" sx={{ fontSize: 40 }} />
                          )}
                        </Box>
                        
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography variant="h6" fontWeight="bold">
                            {formatDaysRemaining(stats.diasRestantes)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Vence el {formatDate(stats.fechaVencimiento)}
                          </Typography>
                        </Box>

                        <Chip
                          label={stats.diasRestantes <= 0 ? 'Plan Expirado' : 'Plan Activo'}
                          color={getDaysRemainingColor(stats.diasRestantes)}
                          variant="filled"
                          size="small"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            ) : null}
          </Box>
        </Alert>
      )}

      {/* Alerta sobre validez mensual */}
      <Alert severity="warning" sx={{ mb: 4 }} icon={<Schedule />}>
        <Typography variant="subtitle2" fontWeight="bold">
          ⏰ Importante: Validez de los Planes
        </Typography>
        <Typography variant="body2">
          Todos los planes tienen una <strong>validez de 30 días(excepto el FREEMIUM)</strong> desde su activación.
          Después de este período, será necesario renovar la suscripción mensual para continuar 
          usando el servicio sin interrupciones.
        </Typography>
      </Alert>

      {/* Planes disponibles */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Planes Disponibles
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Compara las características de cada plan y elige el que mejor se adapte a tu negocio.
        </Typography>

        {isMobile ? (
          // Vista móvil: Stack vertical con cards más compactas
          <Stack spacing={3}>
            {subscriptionPlansForUi.map((plan) => (
              <Card 
                key={plan.key}
                variant="outlined"
                sx={{ 
                  position: 'relative',
                  border: plan.recommended ? 2 : 1,
                  borderColor: plan.recommended ? 'primary.main' : 'divider',
                  '&:hover': { 
                    boxShadow: plan.recommended ? 4 : 2,
                    transform: 'translateY(-2px)',
                    transition: 'all 0.2s'
                  }
                }}
              >
                {plan.recommended && (
                  <Chip
                    label="Recomendado"
                    color="primary"
                    size="small"
                    icon={<Star />}
                    sx={{
                      position: 'absolute',
                      top: -10,
                      left: 16,
                      zIndex: 1
                    }}
                  />
                )}
                {currentPlan === plan.key && (
                  <Chip
                    label="Plan Actual"
                    color="success"
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -10,
                      right: 16,
                      zIndex: 1
                    }}
                  />
                )}
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={2}>
                    {/* Header del plan */}
                    <Box>
                      <Typography variant="h6" component="h3" sx={{ fontSize: '1.25rem', fontWeight: 600 }}>
                        {plan.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                        {plan.description}
                      </Typography>
                      <Typography variant="caption" color="warning.main" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                        {plan.duration}
                      </Typography>
                      <Box sx={{ mt: 2, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                        <Typography 
                          variant="h4" 
                          component="span" 
                          color="primary"
                          sx={{ fontSize: '2rem', fontWeight: 700 }}
                        >
                          {plan.price}
                        </Typography>
                        {plan.period && (
                          <Typography variant="body2" component="span" color="text.secondary">
                            /{plan.period}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    
                    <Divider />
                    
                    {/* Features */}
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontSize: '1rem', fontWeight: 600, mb: 2 }}>
                        Características incluidas:
                      </Typography>
                      <Stack spacing={1}>
                        {plan.features.map((feature, index) => (
                          <Stack key={index} direction="row" alignItems="center" spacing={1.5}>
                            <CheckCircle color="success" sx={{ fontSize: 20 }} />
                            <Typography 
                              variant="body2" 
                              sx={{ fontSize: '0.875rem', lineHeight: 1.4 }}
                            >
                              {feature}
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          // Vista desktop/tablet: Grid
          <Grid container spacing={isTablet ? 3 : 4}>
            {subscriptionPlansForUi.map((plan) => (
              <Grid item xs={12} sm={6} md={4} key={plan.key}>
                <Card 
                  variant="outlined"
                  sx={{ 
                    height: '100%',
                    position: 'relative',
                    border: plan.recommended ? 2 : 1,
                    borderColor: plan.recommended ? 'primary.main' : 'divider',
                    '&:hover': { 
                      boxShadow: plan.recommended ? 4 : 2,
                      transform: 'translateY(-4px)',
                      transition: 'all 0.3s'
                    }
                  }}
                >
                  {plan.recommended && (
                    <Chip
                      label="Recomendado"
                      color="primary"
                      size="small"
                      icon={<Star />}
                      sx={{
                        position: 'absolute',
                        top: -10,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1
                      }}
                    />
                  )}
                  {currentPlan === plan.key && (
                    <Chip
                      label="Plan Actual"
                      color="success"
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: -10,
                        right: 16,
                        zIndex: 1
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ textAlign: 'center', mb: 3 }}>
                      <Typography variant="h5" component="h3" sx={{ fontSize: isTablet ? '1.5rem' : '1.75rem', fontWeight: 600 }}>
                        {plan.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: isTablet ? '0.875rem' : '1rem', mt: 1 }}>
                        {plan.description}
                      </Typography>
                      <Typography variant="caption" color="warning.main" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
                        {plan.duration}
                      </Typography>
                      <Box sx={{ my: 3 }}>
                        <Typography 
                          variant="h3" 
                          component="span" 
                          color="primary"
                          sx={{ fontSize: isTablet ? '2.5rem' : '3rem', fontWeight: 700 }}
                        >
                          {plan.price}
                        </Typography>
                        {plan.period && (
                          <Typography variant="h6" component="span" color="text.secondary">
                            /{plan.period}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    
                    <Divider sx={{ mb: 3 }} />
                    
                    <List dense sx={{ flexGrow: 1 }}>
                      {plan.features.map((feature, index) => (
                        <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                          <ListItemIcon sx={{ minWidth: 36 }}>
                            <CheckCircle color="success" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText 
                            primary={feature}
                            primaryTypographyProps={{ 
                              fontSize: isTablet ? '0.875rem' : '1rem',
                              fontWeight: 500
                            }}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Información adicional */}
      <Box sx={{ mb: 4 }}>
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ fontSize: isMobile ? '0.875rem' : '1rem' }}>
            <strong>¿Necesitas ayuda para elegir?</strong> Nuestro equipo de soporte puede ayudarte a seleccionar 
            el plan que mejor se adapte a las necesidades específicas de tu negocio.
          </Typography>
        </Alert>

        <Box sx={{ textAlign: 'center' }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<ContactSupport />}
            onClick={handleContactSupport}
            sx={{ 
              py: 1.5, 
              px: 4,
              fontSize: isMobile ? '1rem' : '1.125rem',
              fontWeight: 600
            }}
          >
            Contactar para Actualizar Plan
          </Button>
        </Box>
      </Box>

      {/* Modal de contacto */}
      <Dialog
        open={showContactSupport}
        onClose={handleCloseContactSupport}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            p: 1
          }
        }}
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={2}>
            <ContactSupport color="primary" />
            <Typography variant="h6">
              Contactar Soporte
            </Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3}>
            <Typography variant="body1">
              Selecciona con quién te gustaría hablar para obtener más información sobre nuestros planes:
            </Typography>
            
            <RadioGroup
              value={selectedSupport}
              onChange={(e) => setSelectedSupport(e.target.value)}
            >
              {supportUsers.map((user) => (
                <FormControlLabel
                  key={user.name}
                  value={user.name}
                  control={<Radio />}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {user.name.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {user.name}
                        </Typography>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Phone sx={{ fontSize: 16 }} />
                          <Typography variant="body2" color="text.secondary">
                            {user.phone}
                          </Typography>
                          <WhatsApp sx={{ fontSize: 16, color: '#25D366' }} />
                        </Stack>
                      </Box>
                    </Box>
                  }
                  sx={{ 
                    m: 0,
                    p: 1,
                    borderRadius: 2,
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.04)'
                    }
                  }}
                />
              ))}
            </RadioGroup>
          </Stack>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button 
            onClick={handleCloseContactSupport}
            color="secondary"
            size="large"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleContactSelected}
            variant="contained"
            startIcon={<WhatsApp />}
            disabled={!selectedSupport}
            size="large"
          >
            Contactar por WhatsApp
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
} 