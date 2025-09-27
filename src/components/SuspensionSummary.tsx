'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Button,
  Grid,
  CircularProgress,
  Alert,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Block,
  Warning,
  CheckCircle,
  Business,
  Refresh,
  PlayArrow
} from '@mui/icons-material';
import { useAppContext } from '@/context/AppContext';
import { useMessageContext } from '@/context/MessageContext';
import axios from 'axios';

interface SuspensionStats {
  total: number;
  active: number;
  expired: number;
  suspended: number;
  gracePeriod: number;
}

export default function SuspensionSummary() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user, gotToPath } = useAppContext();
  const { showMessage } = useMessageContext();
  
  const [stats, setStats] = useState<SuspensionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);

  // Solo mostrar para SUPER_ADMIN
  if (!user || user.rol !== 'SUPER_ADMIN') {
    return null;
  }

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/subscription/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error al obtener estadísticas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleExecuteVerification = async () => {
    setExecuting(true);
    try {
      await axios.post('/api/subscription/auto-suspend');
      showMessage('Verificación de suspensiones ejecutada', 'success');
      fetchStats(); // Recargar estadísticas
    } catch (error) {
      console.error('Error al ejecutar verificación:', error);
      showMessage('Error al ejecutar verificación', 'error');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="100px">
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Cargando estadísticas...
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const hasIssues = stats.expired > 0 || stats.suspended > 0;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Business color="primary" />
            <Typography variant="h6">
              Estado de Suscripciones
            </Typography>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              startIcon={<Refresh />}
              onClick={fetchStats}
              disabled={loading}
            >
              Actualizar
            </Button>
            
            <Button
              size="small"
              variant="contained"
              startIcon={executing ? <CircularProgress size={16} /> : <PlayArrow />}
              onClick={handleExecuteVerification}
              disabled={executing}
            >
              {executing ? 'Ejecutando...' : 'Verificar'}
            </Button>
          </Stack>
        </Stack>

        {hasIssues && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Hay {stats.expired + stats.suspended} negocio(s) que requieren atención
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Negocios
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="success.main">
                {stats.active}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Activos
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="warning.main">
                {stats.expired}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                En Gracia
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="error.main">
                {stats.suspended}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Suspendidos
              </Typography>
            </Box>
          </Grid>
        </Grid>

        {hasIssues && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Acciones recomendadas:
            </Typography>
            
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {stats.expired > 0 && (
                <Chip
                  icon={<Warning />}
                  label={`${stats.expired} en período de gracia`}
                  color="warning"
                  size="small"
                  variant="outlined"
                />
              )}
              
              {stats.suspended > 0 && (
                <Chip
                  icon={<Block />}
                  label={`${stats.suspended} suspendidos`}
                  color="error"
                  size="small"
                  variant="outlined"
                />
              )}
            </Stack>
            
            <Button
              variant="outlined"
              size="small"
              startIcon={<Business />}
              onClick={() => gotToPath('/configuracion/suspensiones')}
              sx={{ mt: 1 }}
            >
              Gestionar Suspensiones
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
