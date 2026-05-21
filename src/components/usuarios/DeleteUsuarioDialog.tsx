import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import type { IUsuarioDeleteInfo } from "@/schemas/usuario";

interface Props {
  open: boolean;
  info: IUsuarioDeleteInfo | null;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteUsuarioDialog({ open, info, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: "error.main" }}>Eliminar usuario</DialogTitle>
      <DialogContent>
        {info && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2">
              ¿Estás seguro de que deseas eliminar permanentemente a{" "}
              <strong>{info.nombre}</strong> ({info.usuario})? Esta acción no se puede deshacer.
            </Typography>

            {info.locales.length > 0 && (
              <Box>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Locales asignados ({info.locales.length}):
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {info.locales.map((l) => (
                    <Chip key={l.id} label={l.nombre} size="small" color="warning" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}

            {(info.countVentas > 0 || info.countMovimientos > 0 || info.countProveedores > 0) && (
              <Box>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Registros asociados (se conservarán en el historial):
                </Typography>
                <Stack spacing={0.5}>
                  {info.countVentas > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      • {info.countVentas} venta(s) registrada(s)
                    </Typography>
                  )}
                  {info.countMovimientos > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      • {info.countMovimientos} movimiento(s) de inventario
                    </Typography>
                  )}
                  {info.countProveedores > 0 && (
                    <Typography variant="body2" color="text.secondary">
                      • {info.countProveedores} proveedor(es) vinculado(s)
                    </Typography>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button onClick={onConfirm} variant="contained" color="error">
          Eliminar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
