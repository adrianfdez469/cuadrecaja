import { cookies } from "next/headers";
import Link from "next/link";
import { Alert, Button, Stack } from "@mui/material";
import { PageContainer } from "@/components/PageContainer";
import {
  PROMOTER_SESSION_COOKIE_NAME,
  verifyPromoterSession,
} from "@/lib/referrals/promoterSession";
import { getPromoterDashboardData } from "@/lib/referrals/promoterDashboard";
import PromotorDashboardClient from "@/app/promotor/PromotorDashboardClient";

const breadcrumbs = [{ label: "Panel de promotor" }];

export default async function PromotorHomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(PROMOTER_SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return (
      <PageContainer breadcrumbs={breadcrumbs} title="Panel de promotor">
        <Stack spacing={2} sx={{ maxWidth: "sm" }}>
          <Alert severity="warning" variant="filled">
            No tienes una sesión activa de promotor.
          </Alert>
          <Button
            component={Link}
            href="/promotor/acceso"
            variant="contained"
            sx={{ py: 1.25 }}
          >
            Ir al acceso de promotor
          </Button>
        </Stack>
      </PageContainer>
    );
  }

  try {
    const session = verifyPromoterSession(sessionToken);
    const dashboard = await getPromoterDashboardData(session.promoterId);

    if (!dashboard) {
      return (
        <PageContainer breadcrumbs={breadcrumbs} title="Panel de promotor">
          <Stack spacing={2} sx={{ maxWidth: "sm" }}>
            <Alert severity="error" variant="filled">
              No encontramos una cuenta de promotor activa asociada a tu sesión.
            </Alert>
            <Button
              component={Link}
              href="/promotor/acceso"
              variant="contained"
              sx={{ py: 1.25 }}
            >
              Solicitar acceso de nuevo
            </Button>
          </Stack>
        </PageContainer>
      );
    }

    return <PromotorDashboardClient data={dashboard} />;
  } catch {
    return (
      <PageContainer breadcrumbs={breadcrumbs} title="Panel de promotor">
        <Stack spacing={2} sx={{ maxWidth: "sm" }}>
          <Alert severity="error" variant="filled">
            Tu sesión de promotor no es válida o expiró.
          </Alert>
          <Button
            component={Link}
            href="/promotor/acceso"
            variant="contained"
            sx={{ py: 1.25 }}
          >
            Solicitar nuevo enlace
          </Button>
        </Stack>
      </PageContainer>
    );
  }
}
