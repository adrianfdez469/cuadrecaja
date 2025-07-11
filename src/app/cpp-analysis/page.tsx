"use client";

import { useState, useEffect } from "react";
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Grid, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from "@mui/material";
import { 
  TrendingUp, 
  TrendingDown, 
  Analytics, 
  Warning, 
  History,
  ExpandMore,
  CloudSync
} from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { formatCurrency } from '@/utils/formatters';
import { fetchCPPAnalisis, fetchCPPDesviaciones } from "@/services/cppService";

interface CPPAnalysis {
  productoId: string;
  productoNombre: string;
  costoActual: number;
  existenciaActual: number;
  valorInventarioActual: number;
  totalCompras: number;
  promedioCompras: number;
  ultimaCompra: Date | null;
  // 🆕 Nuevos campos para datos históricos
  comprasConCPP: number;
  comprasSinCPP: number;
  porcentajeConfiabilidad: number;
  ultimoCostoUnitario: number | null;
}

interface CPPDesviacion extends CPPAnalysis {
  diferenciaPorcentaje: number;
  diferenciaMonto: number;
}

interface ReporteMigracion {
  movimientosEncontrados: number;
  movimientosProcesados: number;
  errores: number;
  detalles: string[];
}

export default function CPPAnalysisPage() {
  const [tabValue, setTabValue] = useState(0);
  const [analisis, setAnalisis] = useState<CPPAnalysis[]>([]);
  const [desviaciones, setDesviaciones] = useState<CPPDesviacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrationDialog, setMigrationDialog] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationReport, setMigrationReport] = useState<ReporteMigracion | null>(null);
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();

  const fetchAnalisis = async () => {
    if (!user?.localActual?.id) return;
    
    try {
      setLoading(true);
      // const [analisisRes, desviacionesRes] = await Promise.all([
      //   fetch(`/api/cpp/${user.localActual.id}?tipo=analisis`),
      //   fetch(`/api/cpp/${user.localActual.id}?tipo=desviaciones&umbral=10`)
      // ]);

      // if (analisisRes.ok && desviacionesRes.ok) {
      //   const analisisData = await analisisRes.json();
      //   const desviacionesData = await desviacionesRes.json();
        
      //   setAnalisis(analisisData);
      //   setDesviaciones(desviacionesData);
      // } else {
      //   showMessage("Error al cargar análisis de CPP", "error");
      // }

      const [analisisRes, desviacionesRes] = await Promise.all([
        fetchCPPAnalisis(user.localActual.id),
        fetchCPPDesviaciones(user.localActual.id, 0)
      ]);
      
      
        
        setAnalisis(analisisRes);
        setDesviaciones(desviacionesRes);
      
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error al cargar análisis de CPP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleMigrationPreview = async () => {
    if (!user?.localActual?.id) return;
    
    try {
      setMigrationLoading(true);
      const response = await fetch(`/api/cpp/${user.localActual.id}/migrate`);
      
      if (response.ok) {
        const data = await response.json();
        setMigrationReport(data.reporte);
        setMigrationDialog(true);
      } else {
        showMessage("Error al obtener vista previa de migración", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error al obtener vista previa de migración", "error");
    } finally {
      setMigrationLoading(false);
    }
  };

  const handleMigrationExecute = async () => {
    if (!user?.localActual?.id) return;
    
    try {
      setMigrationLoading(true);
      const response = await fetch(`/api/cpp/${user.localActual.id}/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dryRun: false })
      });
      
      if (response.ok) {
        const data = await response.json();
        setMigrationReport(data.reporte);
        showMessage("Migración completada exitosamente", "success");
        
        // Refrescar análisis
        fetchAnalisis();
      } else {
        showMessage("Error al ejecutar migración", "error");
      }
    } catch (error) {
      console.error("Error:", error);
      showMessage("Error al ejecutar migración", "error");
    } finally {
      setMigrationLoading(false);
    }
  };

  useEffect(() => {
    if (!loadingContext) {
      fetchAnalisis();
    }
  }, [loadingContext, user?.localActual?.id]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading || loadingContext) {
    return (
      <PageContainer
        title="Análisis de Costo Promedio Ponderado"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Análisis CPP' }
        ]}
      >
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
          <Typography variant="body2" sx={{ mt: 2, ml: 2 }}>
            Cargando análisis...
          </Typography>
        </Box>
      </PageContainer>
    );
  }

  if (!user?.localActual?.id) {
    return (
      <PageContainer
        title="Análisis de Costo Promedio Ponderado"
        breadcrumbs={[
          { label: 'Inicio', href: '/' },
          { label: 'Análisis CPP' }
        ]}
      >
        <Alert severity="warning">
          <Typography variant="h6" gutterBottom>
            No hay tienda seleccionada
          </Typography>
          <Typography variant="body1">
            Para ver el análisis de CPP, necesitas tener una tienda seleccionada.
          </Typography>
        </Alert>
      </PageContainer>
    );
  }

  const totalValorInventario = analisis.reduce((sum, item) => sum + item.valorInventarioActual, 0);
  const productosConDesviacion = desviaciones.length;
  
  // 🆕 Calcular estadísticas de confiabilidad
  const productosConDatosHistoricos = analisis.filter(a => a.comprasSinCPP > 0).length;
  const promedioConfiabilidad = analisis.length > 0 
    ? analisis.reduce((sum, a) => sum + a.porcentajeConfiabilidad, 0) / analisis.length 
    : 0;

  return (
    <PageContainer
      title="Análisis de Costo Promedio Ponderado"
      breadcrumbs={[
        { label: 'Inicio', href: '/' },
        { label: 'Análisis CPP' }
      ]}
    >
      {/* 🆕 Alerta sobre datos históricos */}
      {productosConDatosHistoricos > 0 && (
        <Alert 
          severity="info" 
          sx={{ mb: 3 }}
          action={
            <Button 
              color="inherit" 
              size="small" 
              onClick={handleMigrationPreview}
              disabled={migrationLoading}
              startIcon={<CloudSync />}
            >
              {migrationLoading ? 'Cargando...' : 'Migrar Datos'}
            </Button>
          }
        >
          <Typography variant="subtitle2" gutterBottom>
            Datos Históricos Detectados
          </Typography>
          <Typography variant="body2">
            Se encontraron {productosConDatosHistoricos} productos con movimientos sin datos CPP. 
            Esto puede afectar la precisión del análisis. Considera migrar los datos históricos.
          </Typography>
        </Alert>
      )}

      {/* Resumen General */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Analytics color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{analisis.length}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Productos Analizados
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <TrendingUp color="success" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{formatCurrency(totalValorInventario)}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Valor Total Inventario
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Warning color="warning" sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{productosConDesviacion}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Productos con Desviación
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <History color={promedioConfiabilidad > 80 ? "success" : "warning"} sx={{ mr: 2 }} />
                <Box>
                  <Typography variant="h6">{promedioConfiabilidad.toFixed(1)}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Confiabilidad Promedio
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs para diferentes vistas */}
      <ContentCard>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Análisis General" />
          <Tab label="Productos con Desviación" />
          <Tab label="Confiabilidad de Datos" />
        </Tabs>

        {/* Tab 1: Análisis General */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="right">Existencia</TableCell>
                    <TableCell align="right">Costo Actual</TableCell>
                    <TableCell align="right">Promedio Cambios en Costo</TableCell>
                    <TableCell align="right">Valor Inventario</TableCell>
                    <TableCell align="right">Ultimo Mov. Cambio Costo</TableCell>
                    <TableCell align="center">Confiabilidad</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analisis.map((item) => (
                    <TableRow key={item.productoId}>
                      <TableCell>{item.productoNombre}</TableCell>
                      <TableCell align="right">{item.existenciaActual}</TableCell>
                      <TableCell align="right">{formatCurrency(item.costoActual)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.promedioCompras)}</TableCell>
                      <TableCell align="right">{formatCurrency(item.valorInventarioActual)}</TableCell>
                      <TableCell align="right">
                        {item.ultimaCompra ? new Date(item.ultimaCompra).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={`${item.porcentajeConfiabilidad.toFixed(0)}%`}
                          color={item.porcentajeConfiabilidad > 80 ? "success" : item.porcentajeConfiabilidad > 50 ? "warning" : "error"}
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Tab 2: Productos con Desviación */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            {desviaciones.length === 0 ? (
              <Alert severity="success">
                <Typography variant="h6" gutterBottom>
                  ¡Excelente! No hay productos con desviaciones significativas
                </Typography>
                <Typography variant="body1">
                  Todos los productos tienen costos actuales consistentes con sus promedios de compra.
                </Typography>
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="right">Costo Actual</TableCell>
                      <TableCell align="right">Ultimo Mov. Cambio Costo</TableCell>
                      <TableCell align="right">Variación</TableCell>
                      <TableCell align="right">% Diferencia</TableCell>
                      <TableCell align="right">Promedio Cambios en Costo</TableCell>
                      <TableCell align="right">Impacto en Inventario</TableCell>
                      <TableCell align="center">Confiabilidad</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {desviaciones.map((item) => (
                      <TableRow key={item.productoId}>
                        <TableCell>{item.productoNombre}</TableCell>
                        <TableCell align="right">{formatCurrency(item.costoActual)}</TableCell>
                        <TableCell align="right">{formatCurrency(item.ultimoCostoUnitario)}</TableCell>
                        
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end">
                            {item.diferenciaMonto > 0 ? (
                              <TrendingUp color="error" sx={{ mr: 1 }} />
                            ) : (
                              <TrendingDown color="success" sx={{ mr: 1 }} />
                            )}
                            {formatCurrency(Math.abs(item.diferenciaMonto))}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${item.diferenciaPorcentaje.toFixed(1)}%`}
                            color={item.diferenciaPorcentaje > 25 ? "error" : "warning"}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">{formatCurrency(item.promedioCompras)}</TableCell>
                        
                        <TableCell align="right">
                          {formatCurrency(Math.abs(item.diferenciaMonto) * item.existenciaActual)}
                        </TableCell>
                        <TableCell align="center">
                          <Chip 
                            label={`${item.porcentajeConfiabilidad.toFixed(0)}%`}
                            color={item.porcentajeConfiabilidad > 80 ? "success" : item.porcentajeConfiabilidad > 50 ? "warning" : "error"}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Tab 3: Confiabilidad de Datos */}
        {tabValue === 2 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Estado de Confiabilidad de Datos CPP
            </Typography>
            
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="success.main">
                      {analisis.filter(a => a.porcentajeConfiabilidad === 100).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Productos con Datos Completos
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="warning.main">
                      {analisis.filter(a => a.porcentajeConfiabilidad > 50 && a.porcentajeConfiabilidad < 100).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Productos con Datos Parciales
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} md={4}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" color="error.main">
                      {analisis.filter(a => a.porcentajeConfiabilidad <= 50).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Productos con Datos Insuficientes
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Producto</TableCell>
                    <TableCell align="center">Compras con CPP</TableCell>
                    <TableCell align="center">Compras sin CPP</TableCell>
                    <TableCell align="center">Total Compras</TableCell>
                    <TableCell align="center">Confiabilidad</TableCell>
                    <TableCell align="center">Estado</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {analisis
                    .sort((a, b) => a.porcentajeConfiabilidad - b.porcentajeConfiabilidad)
                    .map((item) => (
                    <TableRow key={item.productoId}>
                      <TableCell>{item.productoNombre}</TableCell>
                      <TableCell align="center">{item.comprasConCPP}</TableCell>
                      <TableCell align="center">{item.comprasSinCPP}</TableCell>
                      <TableCell align="center">{item.comprasConCPP + item.comprasSinCPP}</TableCell>
                      <TableCell align="center">
                        <Box display="flex" alignItems="center" justifyContent="center">
                          <LinearProgress 
                            variant="determinate" 
                            value={item.porcentajeConfiabilidad} 
                            sx={{ width: 60, mr: 1 }}
                            color={item.porcentajeConfiabilidad > 80 ? "success" : item.porcentajeConfiabilidad > 50 ? "warning" : "error"}
                          />
                          <Typography variant="body2">
                            {item.porcentajeConfiabilidad.toFixed(0)}%
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={
                            item.porcentajeConfiabilidad === 100 ? "Completo" :
                            item.porcentajeConfiabilidad > 50 ? "Parcial" : "Insuficiente"
                          }
                          color={
                            item.porcentajeConfiabilidad === 100 ? "success" :
                            item.porcentajeConfiabilidad > 50 ? "warning" : "error"
                          }
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </ContentCard>

      {/* Dialog de Migración */}
      <Dialog 
        open={migrationDialog} 
        onClose={() => setMigrationDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <CloudSync sx={{ mr: 2 }} />
            Migración de Datos Históricos CPP
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {migrationReport && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Resumen de Migración
                </Typography>
                <Typography variant="body2">
                  Se procesarán {migrationReport.movimientosEncontrados} movimientos históricos sin datos CPP.
                  Estos se marcarán como datos históricos para mantener la consistencia del sistema.
                </Typography>
              </Alert>

              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="subtitle1">
                    Ver Detalles ({migrationReport.movimientosEncontrados} movimientos)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {migrationReport.detalles.map((detalle, index) => (
                      <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                        {detalle}
                      </Typography>
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>

              {migrationReport.movimientosProcesados > 0 && (
                <Alert severity="success" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">
                    Migración Completada
                  </Typography>
                  <Typography variant="body2">
                    Se procesaron {migrationReport.movimientosProcesados} movimientos exitosamente.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setMigrationDialog(false)}>
            Cancelar
          </Button>
          {migrationReport && migrationReport.movimientosEncontrados > 0 && migrationReport.movimientosProcesados === 0 && (
            <Button 
              onClick={handleMigrationExecute}
              variant="contained"
              disabled={migrationLoading}
              startIcon={migrationLoading ? <CircularProgress size={20} /> : <CloudSync />}
            >
              {migrationLoading ? 'Procesando...' : 'Ejecutar Migración'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
} 