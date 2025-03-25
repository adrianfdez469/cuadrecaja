"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { TextField, Button, Box, Typography, Container, Card, CardContent } from "@mui/material";


export default function LoginPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState({ usuario: "", password: "" });
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = await signIn("credentials", {
      redirect: false,
      usuario: credentials.usuario,
      password: credentials.password,
    });

    if (result?.error) {
      setError("Credenciales inválidas");
    } else {
      // Mostrar selector de tiendas
      console.log(result);
      
      
      
      //router.push("/"); // Redirige a la página principal
    }
  };

  return (
    <Container
      maxWidth="xs"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <Card sx={{ width: "100%", p: 2, boxShadow: 3 }}>
        <CardContent>
          <Typography variant="h5" align="center" gutterBottom>
            Iniciar Sesión
          </Typography>
          <form onSubmit={handleSubmit}>
            <Box mb={2}>
              <TextField
                fullWidth
                label="Nombre usuario"
                name="usuario"
                type="text"
                variant="outlined"
                value={credentials.usuario}
                onChange={handleChange}
                required
              />
            </Box>
            <Box mb={2}>
              <TextField
                fullWidth
                label="Contraseña"
                name="password"
                type="password"
                variant="outlined"
                value={credentials.password}
                onChange={handleChange}
                required
              />
            </Box>
            {error && (
              <Typography color="error" align="center">
                {error}
              </Typography>
            )}
            <Button type="submit" fullWidth variant="contained" color="primary">
              Iniciar sesión
            </Button>
          </form>
        </CardContent>
      </Card>
    </Container>
  );
}
