import { cookies } from "next/headers";
import Link from "next/link";
import { Alert, Button, Stack } from "@mui/material";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import {
  PROMOTER_SESSION_COOKIE_NAME,
  verifyPromoterSession,
} from "@/lib/referrals/promoterSession";
import { getPromoterDashboardData } from "@/lib/referrals/promoterDashboard";
import PromotorDashboardClient from "@/app/promotor/PromotorDashboardClient";

export default async function PromotorHomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(PROMOTER_SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return (
      <AuthCardLayout>
        <Stack spacing={2}>
          <Alert severity="warning">
            No tienes una sesión activa de promotor.
          </Alert>
          <Button component={Link} href="/promotor/acceso" variant="contained">
            Ir al acceso de promotor
          </Button>
        </Stack>
      </AuthCardLayout>
    );
  }

  try {
    const session = verifyPromoterSession(sessionToken);
    const dashboard = await getPromoterDashboardData(session.promoterId);

    if (!dashboard) {
      return (
        <AuthCardLayout>
          <Stack spacing={2}>
            <Alert severity="error">
              No encontramos una cuenta de promotor activa asociada a tu sesión.
            </Alert>
            <Button
              component={Link}
              href="/promotor/acceso"
              variant="contained"
            >
              Solicitar acceso de nuevo
            </Button>
          </Stack>
        </AuthCardLayout>
      );
    }

    return <PromotorDashboardClient data={dashboard} />;
  } catch {
    return (
      <AuthCardLayout>
        <Stack spacing={2}>
          <Alert severity="error">
            Tu sesión de promotor no es válida o expiró.
          </Alert>
          <Button component={Link} href="/promotor/acceso" variant="contained">
            Solicitar nuevo enlace
          </Button>
        </Stack>
      </AuthCardLayout>
    );
  }
}
