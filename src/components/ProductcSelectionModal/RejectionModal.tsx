import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert
} from '@mui/material';
import { IProductoDisponible } from '../ProductSelectionModal';

interface RejectionModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => void;
  producto: IProductoDisponible | null;
  loading?: boolean;
}

export const RejectionModal: React.FC<RejectionModalProps> = ({
  open,
  onClose,
  onConfirm,
  producto,
  loading = false
}) => {
  const [motivo, setMotivo] = useState('');

  const handleConfirm = () => {
    if (motivo.trim()) {
      onConfirm(motivo);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Rechazar Entrada de Producto</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1, mb: 2 }}>
          <Typography variant="body1" gutterBottom>
            ¿Estás seguro de que deseas rechazar la entrada de este producto?
          </Typography>
          {producto && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="subtitle2"><strong>Producto:</strong> {producto.nombre}</Typography>
              <Typography variant="body2"><strong>Cantidad:</strong> {producto.existencia}</Typography>
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Esta acción devolverá los productos a la tienda original.
          </Typography>
          <TextField
            autoFocus
            label="Causa del rechazo"
            multiline
            rows={3}
            fullWidth
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Escribe el motivo del rechazo aquí..."
            required
            error={!motivo.trim() && motivo !== ''}
            helperText={!motivo.trim() && motivo !== '' ? 'El motivo es obligatorio' : ''}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button 
          onClick={handleConfirm} 
          color="error" 
          variant="contained" 
          disabled={!motivo.trim() || loading}
        >
          {loading ? 'Procesando...' : 'Confirmar Rechazo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
