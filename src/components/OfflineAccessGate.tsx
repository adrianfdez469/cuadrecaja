import { ReactNode, useRef } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { 
  Warning
} from '@mui/icons-material';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface OfflineAccessGateProps {
  children: ReactNode;
  requireAuth?: boolean;
  allowOfflineAccess?: boolean;
  criticalPage?: boolean;
}

export const OfflineAccessGate: React.FC<OfflineAccessGateProps> = ({
  children,
  requireAuth = true,
  allowOfflineAccess = true,
  criticalPage = false
}) => {
  const { 
    session, 
    status, 
    hasValidOfflineSession,
    source: sessionSource,
    isLoading
  } = useOfflineAuth();
  
  const { isOnline } = useNetworkStatus();

  // Debug logging (solo para cambios de estado importantes)
  const prevStatusRef = useRef(status);
  const prevHasValidOfflineRef = useRef(hasValidOfflineSession);
  const prevIsLoadingRef = useRef(isLoading);
  
  if (prevStatusRef.current !== status || 
      prevHasValidOfflineRef.current !== hasValidOfflineSession ||
      prevIsLoadingRef.current !== isLoading) {
    console.log('🚪 [OfflineAccessGate] Cambio de estado:', {
      requireAuth,
      allowOfflineAccess,
      criticalPage,
      session: !!session,
      status: `${prevStatusRef.current} → ${status}`,
      hasValidOfflineSession: `${prevHasValidOfflineRef.current} → ${hasValidOfflineSession}`,
      isLoading: `${prevIsLoadingRef.current} → ${isLoading}`,
      isOnline,
      sessionSource,
      sessionUser: session?.user?.nombre || 'N/A'
    });
    
    prevStatusRef.current = status;
    prevHasValidOfflineRef.current = hasValidOfflineSession;
    prevIsLoadingRef.current = isLoading;
  }

  // Si no requiere autenticación, mostrar contenido directamente
  if (!requireAuth) {
    return <>{children}</>;
  }

  // Si estamos cargando (tanto sesión online como offline), mostrar loading
  if (isLoading || status === 'loading') {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="#f5f5f5"
      >
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Cargando aplicación...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isOnline ? 'Verificando autenticación...' : 'Verificando sesión offline...'}
          </Typography>
        </Paper>
      </Box>
    );
  }

  // Si no hay sesión válida (ni online ni offline) Y ya terminó de cargar
  if (!isLoading && status === 'unauthenticated' && !hasValidOfflineSession) {
    console.log('❌ [OfflineAccessGate] Sin acceso - Status:', status, 'HasValidOffline:', hasValidOfflineSession, 'IsLoading:', isLoading);
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
        bgcolor="#f5f5f5"
      >
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center', maxWidth: 400 }}>
          <Warning color="warning" sx={{ fontSize: 48, mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            Acceso no autorizado
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            {!isOnline 
              ? 'Sin conexión y no hay sesión offline válida'
              : 'Sesión expirada'
            }
          </Typography>
          <Typography variant="caption" color="text.secondary" paragraph>
            Debug: Status={status}, HasValidOffline={hasValidOfflineSession ? 'true' : 'false'}, Online={isOnline ? 'true' : 'false'}, Loading={isLoading ? 'true' : 'false'}
          </Typography>
          <Button 
            variant="contained" 
            href="/login"
            disabled={!isOnline}
          >
            {isOnline ? 'Iniciar Sesión' : 'Conexión requerida'}
          </Button>
        </Paper>
      </Box>
    );
  }

  // Si tenemos sesión válida (online u offline), mostrar contenido
  if (session) {
    // Si estamos en modo offline y es una página crítica, ya no mostramos banner adicional
    // porque el Layout ya maneja el banner de conexión globalmente
    // Simplemente mostrar el contenido
    return <>{children}</>;
  }

  // Fallback - no debería llegar aquí
  console.log('⚠️ [OfflineAccessGate] Fallback - estado desconocido');
  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      bgcolor="#f5f5f5"
    >
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Error de autenticación
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Estado de sesión desconocido
        </Typography>
        <Typography variant="caption" color="text.secondary" paragraph>
          Debug: Status={status}, HasValidOffline={hasValidOfflineSession ? 'true' : 'false'}, Session={session ? 'exists' : 'null'}
        </Typography>
        <Button variant="contained" href="/login" sx={{ mt: 2 }}>
          Ir al Login
        </Button>
      </Paper>
    </Box>
  );
}; 