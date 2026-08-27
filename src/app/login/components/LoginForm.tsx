"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { getSession, signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import {
  Lock,
  Login as LoginIcon,
  Person,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";

import {
  LOGIN_CREDENTIALS_SESSION_KEY,
  OLVIDE_CONTRASEÑA_PATH,
} from "@/constants/userAccount";
import { shape, touch } from "@/theme/tokens";

import { parseSignInError, type LoginError } from "../loginError";
import { LoginErrorAlert } from "./LoginErrorAlert";
import { VERSION_LINE } from "./LoginBrandPanel";

const NO_ROLE_MESSAGE =
  "Tu cuenta no tiene un rol asignado en este local. Contacta al administrador.";

export function LoginForm() {
  const [credentials, setCredentials] = useState({ usuario: "", password: "" });
  const [error, setError] = useState<LoginError | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Activation and password-reset flows hand the credentials over in session
  // storage so the user does not retype what they just set. Read once, then
  // clear: they must not survive a reload.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(LOGIN_CREDENTIALS_SESSION_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as { usuario?: string; password?: string };
      const usuario = (parsed.usuario ?? "").trim().toLowerCase();
      const password = parsed.password ?? "";

      if (usuario || password) setCredentials({ usuario, password });
    } catch {
      // Malformed payload: nothing to prefill, and nothing worth reporting.
    } finally {
      sessionStorage.removeItem(LOGIN_CREDENTIALS_SESSION_KEY);
    }
  }, []);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setCredentials((prev) => ({
      ...prev,
      // Usernames are stored lowercase; normalising here stops a capitalised
      // first letter from a phone keyboard failing the login.
      [name]: name === "usuario" ? value.trim().toLowerCase() : value,
    }));
    if (error) setError(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        usuario: credentials.usuario,
        password: credentials.password,
      });

      if (result?.error) {
        setError(parseSignInError(result.error));
        setLoading(false);
        return;
      }

      // `signIn` reports ok/error, not the session. Fetch it and check it is
      // complete before redirecting, rather than assuming success and leaving
      // AppContext to discover the gap on the next screen.
      const session = await getSession();
      if (!session?.user?.rol) {
        setError({ kind: "generic", message: NO_ROLE_MESSAGE });
        setLoading(false);
        return;
      }

      router.push("/home");
    } catch (err) {
      console.error("[login] sign in failed", err);
      setError({
        kind: "generic",
        message: "Error de conexión. Intenta nuevamente.",
      });
      setLoading(false);
    }
  };

  const disabled = loading || !credentials.usuario || !credentials.password;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minWidth: 0,
        px: { xs: 2.5, md: 7 },
        pt: { xs: 3.5, md: 7 },
        pb: { xs: 2.5, md: 7 },
        justifyContent: { xs: "flex-start", md: "center" },
        alignItems: { xs: "stretch", md: "center" },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: { xs: "none", md: 400 } }}>
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: "1.375rem", md: "1.75rem" },
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "-0.02em",
          }}
        >
          Iniciar Sesión
        </Typography>
        <Typography
          sx={{
            mt: 0.75,
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            color: "text.secondary",
          }}
        >
          Ingresa tus credenciales para acceder al sistema
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ mt: { xs: 3.5, md: 4 } }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              fullWidth
              label="Nombre de usuario"
              name="usuario"
              value={credentials.usuario}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="username"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              fullWidth
              label="Contraseña"
              name="password"
              type={showPassword ? "text" : "password"}
              value={credentials.password}
              onChange={handleChange}
              required
              disabled={loading}
              autoComplete="current-password"
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: "text.disabled" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label={
                          showPassword
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        onClick={() => setShowPassword((prev) => !prev)}
                        edge="end"
                        disabled={loading}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
          </Box>

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
            <Link
              component={NextLink}
              href={OLVIDE_CONTRASEÑA_PATH}
              sx={{
                display: "flex",
                alignItems: "center",
                minHeight: touch.min,
                fontSize: "0.875rem",
                fontWeight: 600,
                textDecoration: "none",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </Box>

          {error && <LoginErrorAlert error={error} />}

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={disabled}
            startIcon={
              loading ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <LoginIcon />
              )
            }
            sx={{
              minHeight: touch.comfortable,
              mt: 1,
              borderRadius: `${shape.radius.md}px`,
              fontSize: "1rem",
            }}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </Button>
        </Box>

        <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
          <Link
            component={NextLink}
            href="/"
            sx={{
              display: "flex",
              alignItems: "center",
              minHeight: touch.min,
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "text.secondary",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Volver a la página principal
          </Link>
        </Box>
      </Box>

      {/* On a phone the violet band has no room for it, so the version line
          settles at the foot of the form instead. */}
      <Typography
        sx={{
          display: { xs: "block", md: "none" },
          mt: "auto",
          pt: 3,
          textAlign: "center",
          fontSize: "0.75rem",
          color: "text.disabled",
        }}
      >
        {VERSION_LINE}
      </Typography>
    </Box>
  );
}
