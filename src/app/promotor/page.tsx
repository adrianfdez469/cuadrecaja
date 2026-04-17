import { cookies } from 'next/headers';
import Link from 'next/link';
import { Alert, Box, Button, Container } from '@mui/material';
import { PROMOTER_SESSION_COOKIE_NAME, verifyPromoterSession } from '@/lib/referrals/promoterSession';
import { getPromoterDashboardData } from '@/lib/referrals/promoterDashboard';
import PromotorDashboardClient from '@/app/promotor/PromotorDashboardClient';

export default async function PromotorHomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(PROMOTER_SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          No tienes una sesión activa de promotor.
        </Alert>
        <Button component={Link} href="/promotor/acceso" variant="contained">
          Ir al acceso de promotor
        </Button>
      </Container>
    );
  }

  try {
    const session = verifyPromoterSession(sessionToken);
    const dashboard = await getPromoterDashboardData(session.promoterId);

    if (!dashboard) {
      return (
        <Container maxWidth="sm" sx={{ py: 8 }}>
          <Alert severity="error" sx={{ mb: 2 }}>
            No encontramos una cuenta de promotor activa asociada a tu sesión.
          </Alert>
          <Button component={Link} href="/promotor/acceso" variant="contained">
            Solicitar acceso de nuevo
          </Button>
        </Container>
      );
    }

    return <PromotorDashboardClient data={dashboard} />;
  } catch {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#1a1d29', py: 8 }}>
        <Container maxWidth="sm">
          <Alert severity="error" sx={{ mb: 2 }}>
            Tu sesión de promotor no es válida o expiró.
          </Alert>
          <Button component={Link} href="/promotor/acceso" variant="contained">
            Solicitar nuevo enlace
          </Button>
        </Container>
      </Box>
    );
  }
}
