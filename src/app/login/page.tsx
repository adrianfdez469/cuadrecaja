"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { 
  TextField, 
  Button, 
  Box, 
  Typography, 
  Container,
  CardContent,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Paper,
  Fade,
  Avatar
} from "@mui/material";
import { 
  Visibility, 
  VisibilityOff, 
  Person, 
  Lock,
  Store,
  Login as LoginIcon,
  Warning,
  WhatsApp,
  Email
} from "@mui/icons-material";

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ usuario: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if(e.target.name === "usuario") {
      setCredentials({ ...credentials, [e.target.name]: e.target.value.trim().toLowerCase() });
    } else {
      setCredentials({ ...credentials, [e.target.name]: e.target.value });
    }
    if (error) setError(""); // Limpiar error al escribir
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        usuario: credentials.usuario,
        password: credentials.password,
      });

      if (result?.error) {
        // Detectar si es error de suscripción expirada
        if (result.error.includes("SUBSCRIPTION_EXPIRED")) {
          setError("SUBSCRIPTION_EXPIRED");
        } 
        // Detectar si es error de usuario sin configurar
        else if (result.error.includes("USUARIO_SIN_CONFIGURAR")) {
          // Extraer el mensaje completo del error
          const mensajeError = result.error.split(": ")[1] || result.error;
          setError(`USUARIO_SIN_CONFIGURAR: ${mensajeError}`);
        } 
        else {
          setError("Credenciales inválidas. Verifica tu usuario y contraseña.");
        }
      } else {
        // Éxito - NextAuth manejará la redirección automáticamente
        console.log("Login exitoso:", result);
      }
    } catch (err) {
      console.log(err);
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Container maxWidth="sm">
        <Fade in={true} timeout={600}>
          <Paper
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Header con branding */}
            <Box
              sx={{
                background: "linear-gradient(135deg, #1976d2 0%, #dc004e 100%)",
                color: "white",
                p: 4,
                textAlign: "center",
                position: "relative",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0, 0, 0, 0.2)",
                  zIndex: 1
                },
                "& > *": {
                  position: "relative",
                  zIndex: 2
                }
              }}
            >
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  mx: "auto",
                  mb: 2,
                  backgroundColor: "rgba(255, 255, 255, 0.25)",
                  backdropFilter: "blur(10px)",
                  border: "2px solid rgba(255, 255, 255, 0.3)"
                }}
              >
                <Store fontSize="large" sx={{ color: "white" }} />
              </Avatar>
              
              <Typography
                variant="h4"
                fontWeight={700}
                gutterBottom
                sx={{
                  textShadow: "0 3px 6px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.7)",
                  color: "#ffffff",
                  fontSize: { xs: "1.75rem", sm: "2.125rem" },
                  letterSpacing: "0.5px"
                }}
              >
                Cuadre de Caja
              </Typography>
              
              <Typography
                variant="body1"
                sx={{
                  textShadow: "0 2px 4px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.7)",
                  fontSize: "1.1rem",
                  color: "#ffffff",
                  fontWeight: 500,
                  letterSpacing: "0.3px"
                }}
              >
                Sistema de Punto de Venta
              </Typography>
            </Box>

            <CardContent sx={{ p: 4 }}>
              <Box sx={{ mb: 3, textAlign: "center" }}>
                <Typography variant="h5" fontWeight={600} gutterBottom>
                  Iniciar Sesión
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Ingresa tus credenciales para acceder al sistema
                </Typography>
              </Box>

              <form onSubmit={handleSubmit}>
                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Nombre de usuario"
                    name="usuario"
                    type="text"
                    variant="outlined"
                    value={credentials.usuario}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person color="action" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        transition: "all 0.2s ease",
                        "&:hover": {
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                        },
                        "&.Mui-focused": {
                          boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.12)",
                        },
                      },
                    }}
                  />
                </Box>

                <Box sx={{ mb: 3 }}>
                  <TextField
                    fullWidth
                    label="Contraseña"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    variant="outlined"
                    value={credentials.password}
                    onChange={handleChange}
                    required
                    disabled={loading}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Lock color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={handleTogglePassword}
                            edge="end"
                            disabled={loading}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      "& .MuiOutlinedInput-root": {
                        borderRadius: 2,
                        transition: "all 0.2s ease",
                        "&:hover": {
                          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
                        },
                        "&.Mui-focused": {
                          boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.12)",
                        },
                      },
                    }}
                  />
                </Box>

                {error && (
                  <>
                    {error.startsWith("USUARIO_SIN_CONFIGURAR:") ? (
                      <Alert 
                        severity="warning" 
                        icon={<Warning />}
                        sx={{ 
                          mb: 3,
                          borderRadius: 2,
                          "& .MuiAlert-message": {
                            width: "100%"
                          }
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Usuario Sin Configurar
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          {error.split(": ")[1]}
                        </Typography>
                        
                        <Box 
                          sx={{ 
                            mt: 2, 
                            pt: 2, 
                            borderTop: '1px solid rgba(237, 108, 2, 0.2)'
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Para completar tu configuración, contacta al administrador:
                          </Typography>
                          
                          {/* WhatsApp Links */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                            <Box
                              component="a"
                              href="https://wa.me/5354319958?text=Hola%2C%20mi%20usuario%20no%20est%C3%A1%20completamente%20configurado%20en%20Cuadre%20de%20Caja.%20%C2%BFPodr%C3%ADan%20ayudarme%3F"
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                p: 1,
                                pl: 1.5,
                                borderRadius: 1,
                                textDecoration: 'none',
                                color: 'inherit',
                                backgroundColor: 'rgba(237, 108, 2, 0.08)',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  backgroundColor: 'rgba(237, 108, 2, 0.15)',
                                  transform: 'translateX(4px)'
                                }
                              }}
                            >
                              <WhatsApp sx={{ fontSize: 18, color: '#25D366' }} />
                              <Typography variant="body2" fontWeight={500}>
                                +53 5 4319958
                              </Typography>
                            </Box>
                            <Box
                              component="a"
                              href="https://wa.me/5353334449?text=Hola%2C%20mi%20usuario%20no%20est%C3%A1%20completamente%20configurado%20en%20Cuadre%20de%20Caja.%20%C2%BFPodr%C3%ADan%20ayudarme%3F"
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                p: 1,
                                pl: 1.5,
                                borderRadius: 1,
                                textDecoration: 'none',
                                color: 'inherit',
                                backgroundColor: 'rgba(237, 108, 2, 0.08)',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  backgroundColor: 'rgba(237, 108, 2, 0.15)',
                                  transform: 'translateX(4px)'
                                }
                              }}
                            >
                              <WhatsApp sx={{ fontSize: 18, color: '#25D366' }} />
                              <Typography variant="body2" fontWeight={500}>
                                +53 53334449
                              </Typography>
                            </Box>

                            <Box
                              component="a"
                              href="https://wa.me/59897728107?text=Hola%2C%20mi%20usuario%20no%20est%C3%A1%20completamente%20configurado%20en%20Cuadre%20de%20Caja.%20%C2%BFPodr%C3%ADan%20ayudarme%3F"
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                p: 1,
                                pl: 1.5,
                                borderRadius: 1,
                                textDecoration: 'none',
                                color: 'inherit',
                                backgroundColor: 'rgba(237, 108, 2, 0.08)',
                                transition: 'all 0.2s',
                                '&:hover': {
                                  backgroundColor: 'rgba(237, 108, 2, 0.15)',
                                  transform: 'translateX(4px)'
                                }
                              }}
                            >
                              <WhatsApp sx={{ fontSize: 18, color: '#25D366' }} />
                              <Typography variant="body2" fontWeight={500}>
                                +598 97728107
                              </Typography>
                            </Box>
                          </Box>

                          {/* Email */}
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.5 }}>
                            <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              adrianfdez469@gmail.com
                            </Typography>
                          </Box>
                        </Box>
                      </Alert>
                    ) : error === "SUBSCRIPTION_EXPIRED" ? (
                      <Alert 
                        severity="error" 
                        icon={<Warning />}
                        sx={{ 
                          mb: 3,
                          borderRadius: 2,
                          "& .MuiAlert-message": {
                            width: "100%"
                          }
                        }}
                      >
                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                          Suscripción Expirada
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          La suscripción de su negocio ha expirado. No puede acceder al sistema hasta que se renueve la suscripción.
                        </Typography>
                        
                        <Box 
                          sx={{ 
                            mt: 2, 
                            pt: 2, 
                            borderTop: '1px solid rgba(211, 47, 47, 0.2)'
                          }}
                        >
                          <Typography variant="body2" fontWeight={600} gutterBottom>
                            Para renovar, contacte a:
                          </Typography>
                          
                          {/* WhatsApp Links */}
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                            <Box
                              component="a"
                              href="https://wa.me/5354319958?text=Hola%2C%20necesito%20renovar%20la%20suscripci%C3%B3n%20de%20mi%20negocio%20en%20Cuadre%20de%20Caja.%20%C2%BFPodr%C3%ADan%20ayudarme%3F"
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: '#25D366',
                                textDecoration: 'none',
                                padding: '6px 12px',
                                borderRadius: 1,
                                transition: 'all 0.2s',
                                '&:hover': {
                                  backgroundColor: 'rgba(37, 211, 102, 0.08)',
                                  transform: 'translateX(2px)'
                                }
                              }}
                            >
                              <WhatsApp sx={{ fontSize: 18 }} />
                              <Typography variant="body2" fontWeight={500}>
                                +53 5 4319958
                              </Typography>
                            </Box>
                            <Box
                              component="a"
                              href="https://wa.me/5353334449?text=Hola%2C%20necesito%20renovar%20la%20suscripci%C3%B3n%20de%20mi%20negocio%20en%20Cuadre%20de%20Caja.%20%C2%BFPodr%C3%ADan%20ayudarme%3F"
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: '#25D366',
                                textDecoration: 'none',
                                padding: '6px 12px',
                                borderRadius: 1,
                                transition: 'all 0.2s',
                                '&:hover': {
                                  backgroundColor: 'rgba(37, 211, 102, 0.08)',
                                  transform: 'translateX(2px)'
                                }
                              }}
                            >
                              <WhatsApp sx={{ fontSize: 18 }} />
                              <Typography variant="body2" fontWeight={500}>
                                +53 53334449
                              </Typography>
                            </Box>
                            
                            <Box
                              component="a"
                              href="https://wa.me/59897728107?text=Hola%2C%20necesito%20renovar%20la%20suscripci%C3%B3n%20de%20mi%20negocio%20en%20Cuadre%20de%20Caja.%20%C2%BFPodr%C3%ADan%20ayudarme%3F"
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                color: '#25D366',
                                textDecoration: 'none',
                                padding: '6px 12px',
                                borderRadius: 1,
                                transition: 'all 0.2s',
                                '&:hover': {
                                  backgroundColor: 'rgba(37, 211, 102, 0.08)',
                                  transform: 'translateX(2px)'
                                }
                              }}
                            >
                              <WhatsApp sx={{ fontSize: 18 }} />
                              <Typography variant="body2" fontWeight={500}>
                                +598 97728107
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Alert>
                    ) : (
                  <Alert 
                    severity="error" 
                    sx={{ 
                      mb: 3,
                      borderRadius: 2,
                      "& .MuiAlert-message": {
                        fontSize: "0.875rem",
                      }
                    }}
                  >
                    {error}
                  </Alert>
                    )}
                  </>
                )}

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  size="large"
                  disabled={loading || !credentials.usuario || !credentials.password}
                  startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
                  sx={{
                    py: 1.5,
                    fontSize: "1rem",
                    fontWeight: 600,
                    borderRadius: 2,
                    textTransform: "none",
                    background: "linear-gradient(135deg, #1976d2 0%, #1565c0 100%)",
                    "&:hover": {
                      background: "linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)",
                      transform: "translateY(-1px)",
                      boxShadow: "0 6px 20px rgba(25, 118, 210, 0.4)",
                    },
                    "&:disabled": {
                      background: "rgba(0, 0, 0, 0.12)",
                      color: "rgba(0, 0, 0, 0.26)",
                    },
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {loading ? "Iniciando sesión..." : "Iniciar sesión"}
                </Button>
              </form>

              {/* Footer informativo */}
              <Box sx={{ mt: 4, textAlign: "center" }}>
                <Typography variant="caption" color="text.secondary">
                  Versión 1.0 • Sistema de gestión comercial
                </Typography>
              </Box>
            </CardContent>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
}
