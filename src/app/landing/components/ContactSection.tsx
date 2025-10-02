"use client";

import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  Button,
  TextField,
  useTheme,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
} from '@mui/material';
import {
  Phone,
  Email,
  Send,
  Business,
  Person,
  Store,
  CheckCircle,
} from '@mui/icons-material';

interface FormData {
  nombre: string;
  nombreNegocio: string;
  correo: string;
  telefono: string;
  tipoNegocio: string;
  numeroLocales: string;
  mensaje: string;
}

const initialFormData: FormData = {
  nombre: '',
  nombreNegocio: '',
  correo: '',
  telefono: '',
  tipoNegocio: '',
  numeroLocales: '',
  mensaje: '',
};

const tiposNegocio = [
  'Tienda de Barrio',
  'Supermercado',
  'Minimercado',
  'Farmacia',
  'Ferretería',
  'Restaurante',
  'Panadería',
  'Distribuidora',
  'Otro'
];

const numeroLocalesOptions = [
  '1 local',
  '2-3 locales',
  '4-5 locales',
  '6-10 locales',
  'Más de 10 locales'
];

export default function ContactSection() {
  const theme = useTheme();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (field: keyof FormData) => (
    event: React.ChangeEvent<HTMLInputElement | { value: unknown }>
  ) => {
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value as string
    }));
  };

  const validateForm = (): boolean => {
    if (!formData.nombre.trim()) return false;
    if (!formData.nombreNegocio.trim()) return false;
    if (!formData.correo.trim()) return false;
    if (!formData.telefono.trim()) return false;
    if (!formData.tipoNegocio) return false;
    if (!formData.numeroLocales) return false;
    
    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.correo)) return false;
    
    // Validar teléfono (básico)
    if (formData.telefono.length < 10) return false;
    
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      setSubmitStatus('error');
      setErrorMessage('Por favor, completa todos los campos correctamente.');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/contact-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitStatus('success');
        setFormData(initialFormData);
      } else {
        throw new Error('Error al enviar el formulario');
      }
    } catch (error) {
      console.error('Error:', error);
      setSubmitStatus('error');
      setErrorMessage('Hubo un error al enviar tu información. Por favor, intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box id="contact-section" sx={{ py: 10, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="📞 Contáctanos"
            sx={{
              bgcolor: theme.palette.secondary.main,
              color: 'white',
              mb: 2,
              px: 2,
            }}
          />
          <Typography 
            variant="h3" 
            component="h2" 
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'text.primary' }}
          >
            ¿Listo para Transformar tu Negocio?
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'text.secondary',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Completa el formulario y uno de nuestros especialistas se contactará contigo 
            para programar una demo personalizada
          </Typography>
        </Box>

        <Grid container spacing={6}>
          {/* Contact Form */}
          <Grid item xs={12} md={7}>
            <Card sx={{ p: 4, boxShadow: theme.shadows[4] }}>
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                Solicita tu Demo Gratuita
              </Typography>

              {submitStatus === 'success' && (
                <Alert 
                  severity="success" 
                  sx={{ mb: 3 }}
                  icon={<CheckCircle />}
                >
                  ¡Gracias por tu interés! Nos contactaremos contigo en las próximas 24 horas.
                </Alert>
              )}

              {submitStatus === 'error' && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {errorMessage}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit}>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Nombre Completo"
                      value={formData.nombre}
                      onChange={handleInputChange('nombre')}
                      required
                      InputProps={{
                        startAdornment: <Person sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Nombre del Negocio"
                      value={formData.nombreNegocio}
                      onChange={handleInputChange('nombreNegocio')}
                      required
                      InputProps={{
                        startAdornment: <Business sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Correo Electrónico"
                      type="email"
                      value={formData.correo}
                      onChange={handleInputChange('correo')}
                      required
                      InputProps={{
                        startAdornment: <Email sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Teléfono"
                      value={formData.telefono}
                      onChange={handleInputChange('telefono')}
                      required
                      placeholder="Ej: 3001234567"
                      InputProps={{
                        startAdornment: <Phone sx={{ mr: 1, color: 'text.secondary' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Tipo de Negocio</InputLabel>
                      <Select
                        value={formData.tipoNegocio}
                        onChange={(e) => handleInputChange('tipoNegocio')(e as React.ChangeEvent<HTMLInputElement>)}
                        label="Tipo de Negocio"
                      >
                        {tiposNegocio.map((tipo) => (
                          <MenuItem key={tipo} value={tipo}>
                            {tipo}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth required>
                      <InputLabel>Número de Locales</InputLabel>
                      <Select
                        value={formData.numeroLocales}
                        onChange={(e) => handleInputChange('numeroLocales')(e as React.ChangeEvent<HTMLInputElement>)}
                        label="Número de Locales"
                        startAdornment={<Store sx={{ mr: 1, color: 'text.secondary' }} />}
                      >
                        {numeroLocalesOptions.map((opcion) => (
                          <MenuItem key={opcion} value={opcion}>
                            {opcion}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Mensaje (Opcional)"
                      multiline
                      rows={3}
                      value={formData.mensaje}
                      onChange={handleInputChange('mensaje')}
                      placeholder="Cuéntanos más sobre tu negocio y tus necesidades..."
                    />
                  </Grid>
                  
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={isSubmitting}
                      startIcon={isSubmitting ? <CircularProgress size={20} /> : <Send />}
                      sx={{
                        py: 1.5,
                        fontSize: '1.1rem',
                        bgcolor: theme.palette.secondary.main,
                        '&:hover': {
                          bgcolor: theme.palette.secondary.dark,
                        },
                      }}
                    >
                      {isSubmitting ? 'Enviando...' : 'Solicitar Demo Gratuita'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  🔒 Tu información está segura. No compartimos datos con terceros.
                </Typography>
              </Box>
            </Card>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              {/* Contact Details */}
              <Card sx={{ p: 3 }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
                  Información de Contacto
                </Typography>
                
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Phone sx={{ mr: 2, color: theme.palette.primary.main }} />
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        +53 53334449
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Adrián Fernández - Desarrollador
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Phone sx={{ mr: 2, color: theme.palette.primary.main }} />
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        +598 97728107
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Número alternativo
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Email sx={{ mr: 2, color: theme.palette.primary.main }} />
                    <Box>
                      <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        adrianfdez469@gmail.com
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Contacto directo con el desarrollador
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Card>

              {/* Benefits */}
              <Card sx={{ p: 3, bgcolor: theme.palette.primary.main, color: 'white' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'white' }}>
                  ¿Qué Incluye tu Demo?
                </Typography>
                
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      Análisis de tus necesidades específicas
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      Propuesta de plan personalizada
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      30 días de prueba gratuita (Plan Freemium)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      Capacitación inicial sin costo
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: 'white' }} />
                    <Typography variant="body2" sx={{ color: 'white' }}>
                      Si necesitas una solución más personalizada, te ofrecemos un plan custom
                    </Typography>
                  </Box>
                </Stack>
              </Card>

              {/* Response Time */}
              <Card sx={{ p: 3, textAlign: 'center', bgcolor: theme.palette.success.main, color: 'white' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'white' }}>
                  &lt; 24h
                </Typography>
                <Typography variant="body1" sx={{ color: 'white' }}>
                  Tiempo promedio de respuesta
                </Typography>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
