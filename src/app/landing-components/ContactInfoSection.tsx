'use client';

import {
  Box,
  Card,
  Container,
  Grid,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Email, WhatsApp } from '@mui/icons-material';
import {
  buildWhatsAppUrl,
  LANDING_CONTACT_INFO_SECTION_ID,
  LANDING_CONTACTS,
} from '@/constants/landingContact';

const TEAL = '#4ECDC4';

export default function ContactInfoSection() {
  return (
    <Box
      id={LANDING_CONTACT_INFO_SECTION_ID}
      sx={{ py: 8, bgcolor: '#1e2433', borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <Container maxWidth="lg">
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            variant="h4"
            component="h2"
            sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 1.5 }}
          >
            Información de contacto
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', maxWidth: 560, mx: 'auto' }}>
            ¿Tienes dudas sobre la prueba gratuita, los planes o el programa de promotores? Escríbenos por
            WhatsApp o correo.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {LANDING_CONTACTS.map((person) => (
            <Grid item xs={12} md={6} key={person.email}>
              <Card
                sx={{
                  p: 3,
                  height: '100%',
                  bgcolor: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 'bold', color: 'rgba(255,255,255,0.95)', mb: 0.5 }}>
                  {person.name}
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mb: 2.5 }}>
                  {person.role}
                </Typography>

                <Stack spacing={1.5}>
                  {person.phones.map((phone) => (
                    <Link
                      key={phone.whatsapp}
                      href={buildWhatsAppUrl(phone.whatsapp)}
                      target="_blank"
                      rel="noopener noreferrer"
                      underline="none"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 1.25,
                        borderRadius: 1.5,
                        bgcolor: 'rgba(37, 211, 102, 0.14)',
                        border: '1px solid rgba(37, 211, 102, 0.38)',
                        color: '#ffffff',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: 'rgba(37, 211, 102, 0.22)',
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <WhatsApp sx={{ color: '#25D366', fontSize: 22 }} />
                      <Box>
                        <Typography
                          variant="body1"
                          sx={{
                            fontWeight: 800,
                            fontSize: '1.05rem',
                            color: '#ffffff',
                            letterSpacing: 0.2,
                            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                          }}
                        >
                          {phone.display}
                        </Typography>
                        {phone.label ? (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            {phone.label} · WhatsApp
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                            Escribir por WhatsApp
                          </Typography>
                        )}
                      </Box>
                    </Link>
                  ))}

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 0.5, pt: 0.5 }}>
                    <Email sx={{ color: TEAL }} />
                    <Link
                      href={`mailto:${person.email}`}
                      underline="hover"
                      sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500 }}
                    >
                      {person.email}
                    </Link>
                  </Box>
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
