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

  const normalizePhone = (valor: string): string => valor.replace(/\s/g, '');

  const validateForm = (): boolean => {
    if (!formData.nombre.trim()) return false;
    if (!formData.correo.trim()) return false;
    if (!formData.telefono.trim()) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.correo)) return false;

    const telefonoNorm = normalizePhone(formData.telefono);
    if (!/^(\+53)?\d{7}$/.test(telefonoNorm)) return false;

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

    const payload = {
      ...formData,
      telefono: normalizePhone(formData.telefono),
    };

    try {
      const response = await fetch('/api/contact-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
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

  const TEAL = '#4ECDC4';

  return (
    <Box id="contact-section" sx={{ py: 10, bgcolor: '#252a3a' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="📞 Contáctanos"
            sx={{
              bgcolor: 'rgba(78, 205, 196, 0.15)',
              color: '#6ee7de',
              border: '1px solid rgba(78, 205, 196, 0.35)',
              mb: 2,
              px: 2,
              fontWeight: 600,
            }}
          />
          <Typography 
            variant="h3" 
            component="h2" 
            gutterBottom
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}
          >
            ¿Listo para Transformar tu Negocio?
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              maxWidth: 600,
              mx: 'auto',
              lineHeight: 1.6
            }}
          >
            Completa el formulario y uno de nuestros especialistas se contactará contigo 
            para programar una demo personalizada
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Contact Form */}
          <Grid item xs={12} md={6}>
            <Card
              className="contact-form-card"
              sx={{
                p: 4,
                bgcolor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                // Estilos con mayor especificidad para ganar al theme global y evitar que se pierdan
                '&.contact-form-card .MuiOutlinedInput-root': {
                  backgroundColor: 'rgba(255,255,255,0.06) !important',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.15)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.25)' },
                  '&.Mui-focused fieldset': { borderColor: TEAL },
                },
                '&.contact-form-card .MuiOutlinedInput-input': {
                  color: 'rgba(255,255,255,0.95) !important',
                  '&::placeholder': { color: 'rgba(255,255,255,0.5)', opacity: 1 },
                  // Evitar que el autofill del navegador sobrescriba colores
                  '&:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 100px rgba(255,255,255,0.06) inset',
                    boxShadow: '0 0 0 100px rgba(255,255,255,0.06) inset',
                    WebkitTextFillColor: 'rgba(255,255,255,0.95)',
                    caretColor: 'rgba(255,255,255,0.95)',
                  },
                  '&:-webkit-autofill:hover, &:-webkit-autofill:focus, &:-webkit-autofill:active': {
                    WebkitBoxShadow: '0 0 0 100px rgba(255,255,255,0.06) inset',
                    boxShadow: '0 0 0 100px rgba(255,255,255,0.06) inset',
                    WebkitTextFillColor: 'rgba(255,255,255,0.95)',
                  },
                },
                '&.contact-form-card .MuiInputLabel-root': { color: 'rgba(255,255,255,0.7)' },
                '&.contact-form-card .MuiInputLabel-root.Mui-focused': { color: TEAL },
                '&.contact-form-card .MuiInputAdornment-root .MuiSvgIcon-root': { color: 'rgba(255,255,255,0.7)' },
                '&.contact-form-card .MuiSelect-select': { color: 'rgba(255,255,255,0.95)' },
                '&.contact-form-card .MuiInputBase-input': { color: 'rgba(255,255,255,0.95)' },
              }}
            >
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3, color: 'rgba(255,255,255,0.95)' }}>
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
                        startAdornment: <Person sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Nombre del Negocio (opcional)"
                      value={formData.nombreNegocio}
                      onChange={handleInputChange('nombreNegocio')}
                      InputProps={{
                        startAdornment: <Business sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }} />,
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
                        startAdornment: <Email sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }} />,
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
                      placeholder="7 dígitos o +53 y 7 dígitos"
                      InputProps={{
                        startAdornment: <Phone sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }} />,
                      }}
                    />
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Tipo de Negocio (opcional)</InputLabel>
                      <Select
                        value={formData.tipoNegocio}
                        onChange={(e) => handleInputChange('tipoNegocio')(e as React.ChangeEvent<HTMLInputElement>)}
                        label="Tipo de Negocio (opcional)"
                        displayEmpty
                      >
                        <MenuItem value="">—</MenuItem>
                        {tiposNegocio.map((tipo) => (
                          <MenuItem key={tipo} value={tipo}>
                            {tipo}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth>
                      <InputLabel>Número de Locales (opcional)</InputLabel>
                      <Select
                        value={formData.numeroLocales}
                        onChange={(e) => handleInputChange('numeroLocales')(e as React.ChangeEvent<HTMLInputElement>)}
                        label="Número de Locales (opcional)"
                        displayEmpty
                      >
                        <MenuItem value="">—</MenuItem>
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
                      startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
                      sx={{
                        py: 1.5,
                        fontSize: '1.1rem',
                        fontWeight: 600,
                        bgcolor: TEAL,
                        color: '#1a1d29',
                        boxShadow: '0 4px 20px rgba(78, 205, 196, 0.35)',
                        '&:hover': {
                          bgcolor: '#45b8b0',
                          boxShadow: '0 6px 24px rgba(78, 205, 196, 0.4)',
                        },
                      }}
                    >
                      {isSubmitting ? 'Enviando...' : 'Solicitar Demo Gratuita'}
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(255,255,255,0.06)', borderRadius: 1, border: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'center' }}>
                  🔒 Tu información está segura. No compartimos datos con terceros.
                </Typography>
              </Box>
            </Card>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} md={6}>

            {/* Contact Details */}
            <Grid container spacing={1} mb={3}>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                    Información de Contacto
                  </Typography>

                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Phone sx={{ mr: 2, color: TEAL }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                          +53 53334449
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Adrián Fernández - Desarrollador
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Phone sx={{ mr: 2, color: TEAL }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                          +598 97728107
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Número alternativo
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Email sx={{ mr: 2, color: TEAL }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                          adrianfdez469@gmail.com
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Contacto directo con el desarrollador
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card sx={{ p: 3, bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                    Información de Contacto
                  </Typography>

                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Phone sx={{ mr: 2, color: TEAL }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                          +53 54319958
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Carlos Fernández - Desarrollador
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Phone sx={{ mr: 2, color: TEAL }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                          No disponible
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Número alternativo
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Email sx={{ mr: 2, color: TEAL }} />
                      <Box>
                        <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                          olimac9010@gmail.com
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                          Contacto directo con el desarrollador
                        </Typography>
                      </Box>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            </Grid>

            <Stack spacing={3}>
              {/* Benefits */}
              <Card sx={{ p: 3, bgcolor: 'rgba(78, 205, 196, 0.12)', border: '1px solid rgba(78, 205, 196, 0.3)', color: 'white' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  ¿Qué Incluye tu Demo?
                </Typography>
                
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      Análisis de tus necesidades específicas
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      Propuesta de plan personalizada
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      30 días de prueba gratuita (Plan Freemium)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      Capacitación inicial sin costo
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      Si necesitas una solución más personalizada, te ofrecemos un plan custom
                    </Typography>
                  </Box>
                </Stack>
              </Card>

              {/* Response Time */}
              <Card sx={{ p: 3, textAlign: 'center', bgcolor: 'rgba(78, 205, 196, 0.15)', border: '1px solid rgba(78, 205, 196, 0.35)' }}>
                <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: '#6ee7de' }}>
                  &lt; 24h
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
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
