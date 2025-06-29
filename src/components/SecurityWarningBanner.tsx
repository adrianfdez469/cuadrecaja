import { Alert, AlertTitle, Box, Button, Chip, Collapse, IconButton } from '@mui/material';
import { 
  Security, 
  Schedule, 
  Refresh,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useState } from 'react';
import { useOfflineAuth } from '@/hooks/useOfflineAuth';

export const SecurityWarningBanner: React.FC = () => {
  const { 
    securityWarnings, 
    needsReauth, 
    offlineHoursRemaining,
    isOfflineMode,
    clearOfflineSession 
  } = useOfflineAuth();
  
  const [expanded, setExpanded] = useState(false);

  // No mostrar si no hay advertencias ni necesidad de reauth
  if (securityWarnings.length === 0 && !needsReauth) {
    return null;
  }

  const handleForceReauth = () => {
    clearOfflineSession();
    window.location.href = '/login';
  };

  return (
    <Alert 
      severity={needsReauth ? "error" : "warning"}
      icon={<Security />}
      sx={{ 
        mb: 1,
        borderRadius: 2,
        '& .MuiAlert-message': { width: '100%' }
      }}
      action={
        <Box display="flex" alignItems="center" gap={1}>
          {offlineHoursRemaining > 0 && (
            <Chip
              icon={<Schedule />}
              label={`${offlineHoursRemaining.toFixed(1)}h restantes`}
              size="small"
              color={offlineHoursRemaining < 2 ? "error" : "warning"}
              variant="outlined"
            />
          )}
          {needsReauth && (
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<Refresh />}
              onClick={handleForceReauth}
            >
              Reautenticar
            </Button>
          )}
          {securityWarnings.length > 1 && (
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </Box>
      }
    >
      <AlertTitle>
        {needsReauth ? 'Reautenticación Requerida' : 'Advertencia de Seguridad'}
      </AlertTitle>
      
      {needsReauth ? (
        <Box>
          Has estado trabajando offline por mucho tiempo. Por seguridad, necesitas reautenticarte.
        </Box>
      ) : (
        <Box>
          {securityWarnings[0]}
          
          <Collapse in={expanded}>
            <Box mt={1}>
              {securityWarnings.slice(1).map((warning, index) => (
                <Box key={index} sx={{ mt: 0.5, fontSize: '0.875rem', opacity: 0.8 }}>
                  • {warning}
                </Box>
              ))}
              
              {isOfflineMode && (
                <Box mt={1} sx={{ fontSize: '0.875rem' }}>
                  <strong>Recomendaciones de seguridad:</strong>
                  <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                    <li>Reconéctate a internet lo antes posible</li>
                    <li>Verifica que no haya cambios de precios importantes</li>
                    <li>Sincroniza las ventas pendientes</li>
                  </ul>
                </Box>
              )}
            </Box>
          </Collapse>
        </Box>
      )}
    </Alert>
  );
}; 