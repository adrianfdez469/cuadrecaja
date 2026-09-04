"use client";

import { Box, Button, Typography } from "@mui/material";
import { Lock } from "@mui/icons-material";
import { useRouter } from "next/navigation";

import { StatusScreen } from "@/components/StatusScreen";
import { TIENDA_ONLINE_LABELS } from "@/constants/tiendaOnline";
import { shape, touch } from "@/theme/tokens";

/**
 * The "denied" state of both Tienda Online screens.
 *
 * Shared because the two pages must say the SAME thing, word for word: the copy
 * deliberately names the three possible causes and picks none of them, and two
 * copies of that paragraph would drift the first time one is reworded.
 *
 * Why not `/forbidden`'s message: three different causes land here — the switch
 * is off, the permission is missing, or the boot check failed and `AppContext`
 * failed closed — and they are fixed by three different people. Asserting the
 * permission one sends someone to audit roles that may be perfectly fine.
 *
 * It carries no HTTP code: in F-004 this state is computed on the client with no
 * request at all, so there was no 403 to report.
 */
export function TiendaOnlineDeniedScreen() {
  const router = useRouter();

  return (
    <StatusScreen
      icon={<Lock />}
      eyebrow={TIENDA_ONLINE_LABELS.section.toUpperCase()}
      title="Esta sección no está disponible"
      hue="accent"
      description={
        <>
          <Typography component="p" variant="inherit">
            Desde aquí no se puede saber cuál de estas tres es la razón:
          </Typography>
          <Box
            component="ul"
            sx={{ textAlign: "left", pl: 3, mt: 1, mb: 1.5 }}
          >
            <li>La tienda online todavía no está activada para este negocio.</li>
            <li>Tu usuario no tiene el permiso de esta sección.</li>
            <li>
              No se pudo comprobar el estado al abrir la aplicación, por ejemplo
              por falta de conexión.
            </li>
          </Box>
          <Typography component="p" variant="inherit">
            Tu sesión sigue activa: no hace falta que vuelvas a entrar. Si
            recuperaste la conexión, usa «Volver a comprobar». Si no, pídele el
            permiso a un administrador del negocio, o la activación de la tienda
            online al equipo de cuadrecaja.
          </Typography>
        </>
      }
      actions={
        <>
          <Button
            variant="outlined"
            color="inherit"
            // A reload is what re-runs the AppContext effect that asks for
            // `GET /api/tienda-online/estado`: it is the real way out of the
            // third cause, not decoration.
            onClick={() => window.location.reload()}
            sx={{
              minHeight: 48,
              px: 2.25,
              borderRadius: `${shape.radius.md}px`,
              color: "text.secondary",
              borderColor: "semantic.surface.border",
              bgcolor: "semantic.surface.raised",
            }}
          >
            Volver a comprobar
          </Button>
          <Button
            variant="contained"
            onClick={() => router.push("/home")}
            sx={{
              minHeight: 48,
              px: 2.5,
              borderRadius: `${shape.radius.md}px`,
              minWidth: touch.min,
            }}
          >
            Ir al inicio
          </Button>
        </>
      }
    />
  );
}

export default TiendaOnlineDeniedScreen;
