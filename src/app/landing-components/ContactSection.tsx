"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Stack,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import {
  Phone,
  Email,
  Send,
  Business,
  Person,
  CheckCircle,
  ContactPhone,
} from '@mui/icons-material';
import { LANDING_ACTIVATION_TTL_LABEL } from '@/constants/onboarding';
import {
  LANDING_CTA_SECTION_ID,
  LANDING_CONTACT_INFO_SECTION_ID,
  scrollToLandingSection,
} from '@/constants/landingContact';

interface FormData {
  nombre: string;
  nombreNegocio: string;
  correo: string;
  telefono: string;
  referido: string;
}

const initialFormData: FormData = {
  nombre: '',
  nombreNegocio: '',
  correo: '',
  telefono: '',
  referido: '',
};

export default function ContactSection() {
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  useEffect(() => {
    const refCode = searchParams.get('ref')?.trim().toUpperCase();
    if (!refCode) return;

    setFormData((prev) => ({
      ...prev,
      referido: refCode,
    }));

    const headerReservePx = (): number => {
      const appBar = document.querySelector('.MuiAppBar-root');
      if (appBar instanceof HTMLElement) {
        return Math.ceil(appBar.getBoundingClientRect().height) + 16;
      }
      return 104;
    };

    const scrollToForm = () => {
      const el = document.getElementById('landing-contact-form');
      if (!el) return;
      const reserve = headerReservePx();
      const top = el.getBoundingClientRect().top + window.scrollY - reserve;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    };

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(scrollToForm);
    });
    const t1 = setTimeout(scrollToForm, 280);
    const t2 = setTimeout(scrollToForm, 600);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [searchParams]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [incluirProductosPrueba, setIncluirProductosPrueba] = useState<boolean | null>(null);

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
    if (!formData.nombreNegocio.trim()) return false;
    if (!formData.correo.trim()) return false;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.correo)) return false;

    if (incluirProductosPrueba === null) return false;

    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateForm()) {
      setSubmitStatus('error');
      setErrorMessage(
        incluirProductosPrueba === null
          ? 'Indica si deseas incluir productos de ejemplo en tu tienda Principal.'
          : 'Por favor, completa nombre, nombre del negocio y un correo válido.'
      );
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    const telefonoTrim = formData.telefono.trim();
    const payload = {
      nombre: formData.nombre.trim(),
      nombreNegocio: formData.nombreNegocio.trim(),
      correo: formData.correo.trim(),
      telefono: telefonoTrim ? normalizePhone(telefonoTrim) : '',
      numeroLocales: 1,
      referido: formData.referido.trim().toUpperCase(),
      incluirProductosPrueba: incluirProductosPrueba as boolean,
    };

    try {
      const response = await fetch('/api/contact-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.ok) {
        setSubmitStatus('success');
        setFormData(initialFormData);
        setIncluirProductosPrueba(null);
      } else {
        setSubmitStatus('error');
        setErrorMessage(
          typeof data.error === 'string' && data.error.trim()
            ? data.error
            : 'No se pudo enviar el formulario. Intenta de nuevo.'
        );
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
    <Box id={LANDING_CTA_SECTION_ID} sx={{ py: 10, bgcolor: '#252a3a' }}>
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Chip
            label="🚀 Prueba gratuita"
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
            Completa el formulario y recibirás un enlace de activación en tu correo
            para empezar tu prueba gratuita
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Contact Form */}
          <Grid item xs={12} md={6}>
            <Card
              id="landing-contact-form"
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
                Activar prueba gratuita
              </Typography>

              {submitStatus === 'success' && (
                <Alert 
                  severity="success" 
                  sx={{ mb: 3 }}
                  icon={<CheckCircle />}
                >
                  ¡Listo! Revisa tu correo electrónico: te llegará un enlace de activación válido por {LANDING_ACTIVATION_TTL_LABEL}
                  desde <strong>adrianfdez469@gmail.com</strong> (correo personal del desarrollador).
                  Si no lo ves, revisa la carpeta de spam.
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
                      label="Nombre del Negocio"
                      value={formData.nombreNegocio}
                      onChange={handleInputChange('nombreNegocio')}
                      required
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
                      label="Teléfono (opcional)"
                      value={formData.telefono}
                      onChange={handleInputChange('telefono')}
                      placeholder="Opcional"
                      InputProps={{
                        startAdornment: <Phone sx={{ mr: 1, color: 'rgba(255,255,255,0.7)' }} />,
                      }}
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Código de Referido (opcional)"
                      value={formData.referido}
                      onChange={handleInputChange('referido')}
                      placeholder="PRM-XXXX"
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <FormControl
                      component="fieldset"
                      required
                      sx={{
                        width: '100%',
                        '& .MuiFormLabel-root': { color: 'rgba(255,255,255,0.7)' },
                        '& .MuiFormLabel-root.Mui-focused': { color: TEAL },
                        '& .MuiFormControlLabel-label': { color: 'rgba(255,255,255,0.9)' },
                      }}
                    >
                      <FormLabel component="legend">
                        ¿Incluir productos de ejemplo en tu tienda Principal?
                      </FormLabel>
                      <RadioGroup
                        value={
                          incluirProductosPrueba === null
                            ? ''
                            : incluirProductosPrueba
                              ? 'yes'
                              : 'no'
                        }
                        onChange={(event) =>
                          setIncluirProductosPrueba(event.target.value === 'yes')
                        }
                      >
                        <FormControlLabel
                          value="yes"
                          control={<Radio sx={{ color: TEAL, '&.Mui-checked': { color: TEAL } }} />}
                          label="Sí, incluir 12 productos de ejemplo con stock y precios"
                        />
                        <FormControlLabel
                          value="no"
                          control={<Radio sx={{ color: TEAL, '&.Mui-checked': { color: TEAL } }} />}
                          label="No, empezar con inventario vacío"
                        />
                      </RadioGroup>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      fullWidth
                      disabled={isSubmitting || incluirProductosPrueba === null}
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
                      {isSubmitting ? 'Enviando...' : 'Probar gratis'}
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

          <Grid item xs={12} md={6}>
            <Stack spacing={3}>
              {/* Benefits */}
              <Card sx={{ p: 3, bgcolor: 'rgba(78, 205, 196, 0.12)', border: '1px solid rgba(78, 205, 196, 0.3)', color: 'white' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)' }}>
                  ¿Qué incluye tu prueba?
                </Typography>
                
                <Stack spacing={1}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      7 días de prueba gratuita (Plan Freemium)
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      POS con multimoneda, tickets de venta y gestión unificada de productos e inventario
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ mr: 1, fontSize: 20, color: TEAL }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                      Activación inmediata por correo electrónico
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
                  {LANDING_ACTIVATION_TTL_LABEL}
                </Typography>
                <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Validez del enlace de activación
                </Typography>
              </Card>

              <Card
                sx={{
                  p: 3,
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  textAlign: 'center',
                }}
              >
                <ContactPhone sx={{ fontSize: 40, color: TEAL, mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 1 }}>
                  ¿Prefieres hablar con nosotros?
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 2 }}>
                  Teléfonos, correos y WhatsApp con mensaje listo para enviar.
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => scrollToLandingSection(LANDING_CONTACT_INFO_SECTION_ID)}
                  sx={{
                    borderColor: 'rgba(78, 205, 196, 0.5)',
                    color: '#6ee7de',
                    fontWeight: 600,
                    textTransform: 'none',
                    '&:hover': {
                      borderColor: TEAL,
                      bgcolor: 'rgba(78, 205, 196, 0.08)',
                    },
                  }}
                >
                  Ver información de contacto
                </Button>
              </Card>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
