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
  Login as LoginIcon
} from "@mui/icons-material";

export default function LoginPage() {
  const [credentials, setCredentials] = useState({ usuario: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
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
        setError("Credenciales inválidas. Verifica tu usuario y contraseña.");
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
