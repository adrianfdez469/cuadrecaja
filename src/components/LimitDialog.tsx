import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery,
  RadioGroup,
  FormControlLabel,
  Radio,
  Avatar,
  Card,
  CardContent,
  Grid,
  Chip,
  Divider
} from '@mui/material';
import {
  Upgrade,
  Check,
  Info,
  ContactSupport,
  Store,
  Person,
  Inventory,
  Business,
  WhatsApp,
  Phone,
  Star,
  CheckCircle
} from '@mui/icons-material';
import { planesNegocio } from '@/utils/planesNegocio';

export type LimitType = 'tiendas' | 'usuarios' | 'productos';

interface LimitDialogProps {
  open: boolean;
  onClose: () => void;
  limitType: LimitType;
}

interface SupportUser {
  name: string;
  phone: string;
  whatsapp: string;
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

// Convertir los datos de planesNegocio al formato necesario para la UI
const getPlansForUI = () => {
  const plans = [
    {
      key: 'FREEMIUM',
      name: 'Freemium',
      price: '$0',
      period: 'mes',
      description: 'Plan gratuito por un mes',
      features: [
        `${planesNegocio.FREEMIUM.limiteLocales} tienda`,
        `${planesNegocio.FREEMIUM.limiteUsuarios} usuario`,
        `Hasta ${planesNegocio.FREEMIUM.limiteProductos} productos`,
        'Funcionalidades básicas',
        'Soporte por email'
      ],
      recommended: false,
      color: 'info'
    },
    {
      key: 'BASICO',
      name: 'Básico',
      price: `$${planesNegocio.BASICO.precio}`,
      period: 'mes',
      description: 'Plan básico mensual',
      features: [
        `${planesNegocio.BASICO.limiteLocales} tienda`,
        `${planesNegocio.BASICO.limiteUsuarios} usuario`,
        `Hasta ${planesNegocio.BASICO.limiteProductos} productos`,
        'Reportes básicos',
        'Soporte por email'
      ],
      recommended: false,
      color: 'primary'
    },
    {
      key: 'SILVER',
      name: 'Silver',
      price: `$${planesNegocio.SILVER.precio}`,
      period: 'mes',
      description: 'Plan silver con usuarios ilimitados',
      features: [
        `Hasta ${planesNegocio.SILVER.limiteLocales} tiendas`,
        'Usuarios ilimitados',
        `Hasta ${planesNegocio.SILVER.limiteProductos} productos`,
        'Reportes avanzados',
        'Soporte prioritario',
        'Gestión de inventario avanzada'
      ],
      recommended: true,
      color: 'secondary'
    },
    {
      key: 'PREMIUM',
      name: 'Premium',
      price: `$${planesNegocio.PREMIUM.precio}`,
      period: 'mes',
      description: 'Plan premium con productos ilimitados',
      features: [
        `Hasta ${planesNegocio.PREMIUM.limiteLocales} tiendas`,
        'Usuarios ilimitados',
        'Productos ilimitados',
        'Reportes personalizados',
        'Soporte prioritario 24/7',
        'API personalizada',
        'Integración con sistemas externos'
      ],
      recommended: false,
      color: 'warning'
    },
    {
      key: 'CUSTOM',
      name: 'Personalizado',
      price: 'Cotización',
      period: '',
      description: 'Plan personalizado según tus necesidades',
      features: [
        'Tiendas según necesidad',
        'Usuarios según necesidad',
        'Productos según necesidad',
        'Funcionalidades personalizadas',
        'Soporte dedicado 24/7',
        'Integración completa',
        'Capacitación incluida'
      ],
      recommended: false,
      color: 'success'
    }
  ];

  return plans;
};

const LimitDialog: React.FC<LimitDialogProps> = ({
  open,
  onClose,
  limitType
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [showContactSupport, setShowContactSupport] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [selectedSupport, setSelectedSupport] = useState<string>('');

  const plans = getPlansForUI();

  const getConfig = () => {
    switch (limitType) {
      case 'tiendas':
        return {
          icon: <Store />,
          title: 'Límite de Tiendas Alcanzado',
          description: 'Has alcanzado el límite máximo de tiendas permitido en tu plan actual.',
          explanation: 'Tu plan actual tiene un límite en el número de tiendas que puedes crear. Esto te ayuda a mantener un control organizado de tu negocio según el tamaño de tu operación.',
          benefits: [
            {
              title: 'Más tiendas disponibles',
              description: 'Crea tantas sucursales como necesites'
            },
            {
              title: 'Gestión multi-ubicación',
              description: 'Administra múltiples puntos de venta desde una sola cuenta'
            },
            {
              title: 'Reportes consolidados',
              description: 'Visualiza el rendimiento de todas tus tiendas en un solo lugar'
            },
            {
              title: 'Soporte prioritario',
              description: 'Acceso a asistencia técnica especializada'
            }
          ]
        };
      
      case 'usuarios':
        return {
          icon: <Person />,
          title: 'Límite de Usuarios Alcanzado',
          description: 'Has alcanzado el límite máximo de usuarios permitido en tu plan actual.',
          explanation: 'Tu plan actual tiene un límite en el número de usuarios que puedes crear. Esto incluye empleados, administradores y otros colaboradores de tu negocio.',
          benefits: [
            {
              title: 'Más usuarios disponibles',
              description: 'Agrega tantos empleados como necesites'
            },
            {
              title: 'Gestión de roles avanzada',
              description: 'Asigna permisos específicos a cada usuario'
            },
            {
              title: 'Control de acceso granular',
              description: 'Administra quién puede acceder a qué funciones'
            },
            {
              title: 'Auditoría de actividades',
              description: 'Rastrea las acciones de cada usuario en el sistema'
            }
          ]
        };
      
      case 'productos':
        return {
          icon: <Inventory />,
          title: 'Límite de Productos Alcanzado',
          description: 'Has alcanzado el límite máximo de productos permitido en tu plan actual.',
          explanation: 'Tu plan actual tiene un límite en el número de productos que puedes registrar en tu inventario. Esto incluye todos los artículos y servicios que vendes.',
          benefits: [
            {
              title: 'Inventario ilimitado',
              description: 'Registra tantos productos como necesites'
            },
            {
              title: 'Gestión avanzada de inventario',
              description: 'Control de stock, alertas de inventario bajo y más'
            },
            {
              title: 'Categorización avanzada',
              description: 'Organiza tus productos con categorías y subcategorías'
            },
            {
              title: 'Reportes de productos',
              description: 'Analiza el rendimiento de cada producto en ventas'
            }
          ]
        };
      
      default:
        return {
          icon: <Business />,
          title: 'Límite Alcanzado',
          description: 'Has alcanzado el límite de tu plan actual.',
          explanation: 'Tu plan actual tiene limitaciones en algunas funcionalidades.',
          benefits: []
        };
    }
  };

  const config = getConfig();

  const handleContactSupport = () => {
    setShowContactSupport(true);
  };

  const handleViewPlans = () => {
    setShowPlans(true);
  };

  const handleBackToMain = () => {
    setShowContactSupport(false);
    setShowPlans(false);
    setSelectedSupport('');
  };

  const handleSendWhatsApp = () => {
    if (!selectedSupport) return;
    
    const supportUser = supportUsers.find(user => user.name === selectedSupport);
    if (!supportUser) return;

    const message = encodeURIComponent(
      `Hola ${supportUser.name}, necesito ayuda con mi plan de Cuadre de Caja. ` +
      `He alcanzado el límite de ${limitType} y me gustaría conocer las opciones para actualizar mi plan. ` +
      `¿Podrías ayudarme con información sobre los planes disponibles?`
    );

    const whatsappUrl = `https://wa.me/${supportUser.whatsapp}?text=${message}`;
    window.open(whatsappUrl, '_blank');
    onClose();
  };

  const renderMainContent = () => (
    <>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: 'warning.light',
              color: 'warning.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {config.icon}
          </Box>
          <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: isMobile ? '1.1rem' : '1.5rem' }}>
            {config.title}
          </Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ pb: 1 }}>
        <Stack spacing={3}>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body1" gutterBottom>
              {config.description}
            </Typography>
          </Alert>

          <Box>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: isMobile ? '1rem' : '1.25rem' }}>
              <Info color="primary" />
              ¿Por qué veo este mensaje?
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              {config.explanation}
            </Typography>
          </Box>

          {config.benefits.length > 0 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: isMobile ? '1rem' : '1.25rem' }}>
                <Upgrade color="primary" />
                Beneficios de actualizar tu plan
              </Typography>
              <List dense>
                {config.benefits.map((benefit, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Check color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={benefit.title}
                      secondary={benefit.description}
                      primaryTypographyProps={{ fontSize: isMobile ? '0.875rem' : '1rem' }}
                      secondaryTypographyProps={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          <Alert severity="info">
            <Typography variant="body2" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
              <strong>¿Necesitas ayuda?</strong> Nuestro equipo de soporte puede ayudarte a elegir 
              el plan que mejor se adapte a las necesidades de tu negocio.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      
      <DialogActions 
        sx={{ 
          p: isMobile ? 2 : 3, 
          gap: isMobile ? 1 : 1,
          flexDirection: isMobile ? 'column' : 'row',
          '& > :not(style)': {
            width: isMobile ? '100%' : 'auto',
            minWidth: isMobile ? 'unset' : '120px'
          }
        }}
      >
        <Button 
          onClick={onClose} 
          color="secondary"
          variant={isMobile ? "outlined" : "text"}
          size={isMobile ? "large" : "medium"}
        >
          Entendido
        </Button>
        <Button 
          variant="outlined" 
          color="primary"
          startIcon={<ContactSupport />}
          size={isMobile ? "large" : "medium"}
          onClick={handleContactSupport}
        >
          Contactar Soporte
        </Button>
        <Button 
          variant="contained" 
          color="primary"
          startIcon={<Upgrade />}
          size={isMobile ? "large" : "medium"}
          onClick={handleViewPlans}
        >
          Ver Planes
        </Button>
      </DialogActions>
    </>
  );

  const renderContactSupport = () => (
    <>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: 'primary.light',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ContactSupport />
          </Box>
          <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: isMobile ? '1.1rem' : '1.5rem' }}>
            Contactar Soporte
          </Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ pb: 1 }}>
        <Stack spacing={3}>
          <Alert severity="info">
            <Typography variant="body2" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
              Selecciona un miembro de nuestro equipo de soporte para contactar por WhatsApp.
            </Typography>
          </Alert>

          <RadioGroup
            value={selectedSupport}
            onChange={(e) => setSelectedSupport(e.target.value)}
          >
            {supportUsers.map((user) => (
              <Card 
                key={user.name} 
                variant="outlined" 
                sx={{ 
                  mb: 2,
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'action.hover' },
                  border: selectedSupport === user.name ? 2 : 1,
                  borderColor: selectedSupport === user.name ? 'primary.main' : 'divider'
                }}
                onClick={() => setSelectedSupport(user.name)}
              >
                <CardContent sx={{ p: isMobile ? 2 : 3, '&:last-child': { pb: isMobile ? 2 : 3 } }}>
                  <FormControlLabel
                    value={user.name}
                    control={<Radio sx={{ display: 'none' }} />}
                    label=""
                    sx={{ m: 0, width: '100%' }}
                  />
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: 'primary.main',
                        width: isMobile ? 40 : 48,
                        height: isMobile ? 40 : 48
                      }}
                    >
                      {user.name.charAt(0)}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" sx={{ fontSize: isMobile ? '1rem' : '1.25rem' }}>
                        {user.name}
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                        <Phone fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                          {user.phone}
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                        <WhatsApp fontSize="small" sx={{ color: '#25D366' }} />
                        <Typography variant="body2" sx={{ color: '#25D366', fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
                          Disponible en WhatsApp
                        </Typography>
                      </Stack>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </RadioGroup>
        </Stack>
      </DialogContent>
      
      <DialogActions 
        sx={{ 
          p: isMobile ? 2 : 3, 
          gap: isMobile ? 1 : 1,
          flexDirection: isMobile ? 'column' : 'row',
          '& > :not(style)': {
            width: isMobile ? '100%' : 'auto',
            minWidth: isMobile ? 'unset' : '120px'
          }
        }}
      >
        <Button 
          onClick={handleBackToMain}
          color="secondary"
          variant={isMobile ? "outlined" : "text"}
          size={isMobile ? "large" : "medium"}
        >
          Volver
        </Button>
        <Button 
          variant="contained" 
          color="success"
          startIcon={<WhatsApp />}
          size={isMobile ? "large" : "medium"}
          disabled={!selectedSupport}
          onClick={handleSendWhatsApp}
        >
          Contactar por WhatsApp
        </Button>
      </DialogActions>
    </>
  );

  const renderPlans = () => (
    <>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: 'warning.light',
              color: 'warning.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Upgrade />
          </Box>
          <Typography variant={isMobile ? "h6" : "h5"} sx={{ fontSize: isMobile ? '1.1rem' : '1.5rem' }}>
            Planes Disponibles
          </Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent sx={{ pb: 1, px: isMobile ? 1 : 3 }}>
        <Stack spacing={3}>
          <Alert severity="info">
            <Typography variant="body2" sx={{ fontSize: isMobile ? '0.75rem' : '0.875rem' }}>
              Elige el plan que mejor se adapte a las necesidades de tu negocio.
            </Typography>
          </Alert>

          {isMobile ? (
            // Vista móvil: Stack vertical con cards más compactas
            <Stack spacing={2}>
              {plans.map((plan) => (
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
                  <CardContent sx={{ p: 2 }}>
                    <Stack spacing={2}>
                      {/* Header del plan */}
                      <Box>
                        <Typography variant="h6" component="h3" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
                          {plan.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                          {plan.description}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
                          <Typography 
                            variant="h5" 
                            component="span" 
                            color="primary"
                            sx={{ fontSize: '1.5rem', fontWeight: 700 }}
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
                      
                      {/* Features compactas para móvil */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
                          Características incluidas:
                        </Typography>
                        <Stack spacing={0.5}>
                          {plan.features.slice(0, 4).map((feature, index) => (
                            <Stack key={index} direction="row" alignItems="center" spacing={1}>
                              <CheckCircle color="success" sx={{ fontSize: 16 }} />
                              <Typography 
                                variant="body2" 
                                sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}
                              >
                                {feature}
                              </Typography>
                            </Stack>
                          ))}
                          {plan.features.length > 4 && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem', mt: 0.5 }}>
                              +{plan.features.length - 4} características más
                            </Typography>
                          )}
                        </Stack>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            // Vista desktop/tablet: Grid
            <Grid container spacing={isTablet ? 2 : 3}>
              {plans.map((plan) => (
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
                          left: '50%',
                          transform: 'translateX(-50%)',
                          zIndex: 1
                        }}
                      />
                    )}
                    <CardContent sx={{ p: isTablet ? 2 : 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <Typography variant="h5" component="h3" sx={{ fontSize: isTablet ? '1.25rem' : '1.5rem' }}>
                          {plan.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: isTablet ? '0.75rem' : '0.875rem' }}>
                          {plan.description}
                        </Typography>
                        <Box sx={{ my: 2 }}>
                          <Typography 
                            variant="h4" 
                            component="span" 
                            color="primary"
                            sx={{ fontSize: isTablet ? '1.75rem' : '2rem' }}
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
                      
                      <Divider sx={{ mb: 2 }} />
                      
                      <List dense sx={{ flexGrow: 1 }}>
                        {plan.features.map((feature, index) => (
                          <ListItem key={index} sx={{ px: 0, py: 0.25 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              <CheckCircle color="success" fontSize="small" />
                            </ListItemIcon>
                            <ListItemText 
                              primary={feature}
                              primaryTypographyProps={{ 
                                fontSize: isTablet ? '0.75rem' : '0.875rem',
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
        </Stack>
      </DialogContent>
      
      <DialogActions 
        sx={{ 
          p: isMobile ? 2 : 3, 
          gap: isMobile ? 1 : 1,
          flexDirection: isMobile ? 'column' : 'row',
          '& > :not(style)': {
            width: isMobile ? '100%' : 'auto',
            minWidth: isMobile ? 'unset' : '120px'
          }
        }}
      >
        <Button 
          onClick={handleBackToMain}
          color="secondary"
          variant={isMobile ? "outlined" : "text"}
          size={isMobile ? "large" : "medium"}
        >
          Volver
        </Button>
        <Button 
          variant="contained" 
          color="primary"
          startIcon={<ContactSupport />}
          size={isMobile ? "large" : "medium"}
          onClick={handleContactSupport}
        >
          Contactar para Actualizar
        </Button>
      </DialogActions>
    </>
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth={showPlans ? (isMobile ? "sm" : "lg") : "sm"} 
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          maxHeight: isMobile ? '100vh' : '95vh',
          height: isMobile && showPlans ? '100vh' : 'auto'
        }
      }}
    >
      {showContactSupport ? renderContactSupport() : 
       showPlans ? renderPlans() : 
       renderMainContent()}
    </Dialog>
  );
};

export default LimitDialog; 