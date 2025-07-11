import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Chip,
  Grid,
  Card,
  CardContent,
  Stack,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Close,
  Receipt,
  Person,
  CalendarToday,
  AttachMoney,
  CreditCard,
  AccountBalance,
  ShoppingCart
} from '@mui/icons-material';
import { IVenta } from '@/types/IVenta';
import { formatCurrency, formatDate, formatTimeShort } from '@/utils/formatters';

interface VentaDetailDialogProps {
  open: boolean;
  onClose: () => void;
  venta: IVenta | null;
}

const VentaDetailDialog: React.FC<VentaDetailDialogProps> = ({
  open,
  onClose,
  venta
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  if (!venta) return null;

  const InfoCard = ({ icon, title, value, color = 'primary' }: {
    icon: React.ReactNode;
    title: string;
    value: string;
    color?: 'primary' | 'success' | 'info' | 'warning';
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: isMobile ? 1 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              bgcolor: `${color}.light`,
              color: `${color}.contrastText`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 40,
              minHeight: 40,
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h6" fontWeight="bold" sx={{ wordBreak: 'break-all' }}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      fullScreen={isMobile}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={1}>
            <Receipt color="primary" />
            <Typography variant="h6">
              Detalle de Venta #{venta.id.slice(-8)}
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ p: isMobile ? 1 : 3 }}>
        {/* Información general de la venta */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<CalendarToday />}
              title="Fecha"
              value={formatDate(venta.createdAt)}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<CalendarToday />}
              title="Hora"
              value={formatTimeShort(venta.createdAt)}
              color="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<Person />}
              title="Vendedor"
              value={venta.usuario?.nombre || 'Sistema'}
              color="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <InfoCard
              icon={<ShoppingCart />}
              title="Productos"
              value={`${venta.productos?.length || 0} items`}
              color="warning"
            />
          </Grid>
        </Grid>

        {/* Resumen de pagos */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AttachMoney />
              Resumen de Pagos
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.50', borderRadius: 1 }}>
                  <CreditCard sx={{ fontSize: 32, color: 'success.main', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Efectivo
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {formatCurrency(venta.totalcash)}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'info.50', borderRadius: 1 }}>
                  <AccountBalance sx={{ fontSize: 32, color: 'info.main', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Transferencia
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="info.main">
                    {formatCurrency(venta.totaltransfer)}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'primary.50', borderRadius: 1 }}>
                  <AttachMoney sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    Total
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary.main">
                    {formatCurrency(venta.total)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Lista de productos */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShoppingCart />
              Productos Vendidos
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {!venta.productos || venta.productos.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body1" color="text.secondary">
                  No hay productos registrados para esta venta
                </Typography>
              </Box>
            ) : isMobile ? (
              // Vista móvil - Cards
              <Stack spacing={2}>
                {venta.productos.map((producto, index) => (
                  <Card key={producto.id || index} variant="outlined">
                    <CardContent sx={{ p: 2 }}>
                      <Stack spacing={1}>
                        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                          <Typography variant="subtitle2" fontWeight="medium" sx={{ flex: 1, pr: 1 }}>
                            {producto.name || `Producto ${index + 1}`}
                          </Typography>
                          <Chip
                            label={`${producto.cantidad} unid.`}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                        
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2" color="text.secondary">
                            Precio unitario: {formatCurrency(producto.price || 0)}
                          </Typography>
                          <Typography variant="body1" fontWeight="bold" color="success.main">
                            {formatCurrency((producto.price || 0) * producto.cantidad)}
                          </Typography>
                        </Box>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              // Vista desktop - Tabla
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Producto</TableCell>
                      <TableCell align="center">Cantidad</TableCell>
                      <TableCell align="right">Precio Unitario</TableCell>
                      <TableCell align="right">Subtotal</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {venta.productos.map((producto, index) => (
                      <TableRow key={producto.id || index}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {producto.name || `Producto ${index + 1}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ID: {producto.productoTiendaId}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={producto.cantidad}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {formatCurrency(producto.price || 0)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color="success.main">
                            {formatCurrency((producto.price || 0) * producto.cantidad)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3}>
                        <Typography variant="h6" fontWeight="bold">
                          Total
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="h6" fontWeight="bold" color="primary.main">
                          {formatCurrency(venta.total)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" fullWidth={isMobile}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default VentaDetailDialog; 