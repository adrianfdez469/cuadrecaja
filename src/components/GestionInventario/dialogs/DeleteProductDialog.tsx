import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import type { IProductoDeleteInfo } from "@/schemas/producto";

interface Props {
  open: boolean;
  info: IProductoDeleteInfo | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProductDialog({
  open,
  info,
  loading,
  onClose,
  onConfirm,
}: Props) {
  const tiendaActual = info?.stores.find((s) => s.isCurrentTienda);
  const otrosRegistros = info?.stores.filter((s) => !s.isCurrentTienda) ?? [];
  const esConsignacionActual = !!tiendaActual?.esConsignacion;
  const tieneDeudaPendiente = !!(
    tiendaActual?.montoPendiente && tiendaActual.montoPendiente > 0
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ color: "error.main" }}>
        {esConsignacionActual ? "Eliminar consignación" : "Eliminar producto"}
      </DialogTitle>
      <DialogContent>
        {loading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!loading && info && tiendaActual && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {esConsignacionActual ? (
              <Alert severity="error">
                ¿Estás seguro de que deseas eliminar la consignación de{" "}
                <strong>{info.nombre}</strong> con{" "}
                {tiendaActual.proveedorNombre ?? "este proveedor"}? El producto
                seguirá disponible en esta tienda (si tiene stock propio u otras
                consignaciones) y en las demás tiendas donde esté presente —
                solo se elimina esta consignación.
              </Alert>
            ) : (
              <Alert severity="error">
                ¿Estás seguro de que deseas eliminar{" "}
                <strong>{info.nombre}</strong> de esta tienda? El producto
                seguirá disponible en las demás tiendas donde esté presente.
              </Alert>
            )}

            {info.stores.length > 0 && (
              <Box>
                <Typography variant="body2" fontWeight="medium" gutterBottom>
                  Tiendas donde está presente ({info.stores.length}):
                </Typography>
                <Stack spacing={1}>
                  {info.stores.map((s) => (
                    <Box
                      key={s.tiendaId}
                      display="flex"
                      alignItems="center"
                      justifyContent="space-between"
                      sx={{
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: s.isCurrentTienda
                          ? "error.main"
                          : "divider",
                        bgcolor: s.isCurrentTienda
                          ? "action.selected"
                          : undefined,
                      }}
                    >
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">
                          {s.tiendaNombre}
                        </Typography>
                        {s.isCurrentTienda && (
                          <Chip
                            label="Esta tienda"
                            size="small"
                            color="error"
                            variant="filled"
                          />
                        )}
                        {s.esConsignacion && (
                          <Chip
                            label={`Consignación${s.proveedorNombre ? `: ${s.proveedorNombre}` : ""}`}
                            size="small"
                            color="warning"
                            variant="outlined"
                          />
                        )}
                      </Stack>
                      <Typography
                        variant="body2"
                        fontWeight="medium"
                        color={
                          s.existencia > 0 ? "error.main" : "text.secondary"
                        }
                      >
                        Cantidad: {s.existencia}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            )}

            {tieneDeudaPendiente && tiendaActual && (
              <Alert severity="error">
                No se puede eliminar: hay{" "}
                {(tiendaActual.montoPendiente ?? 0).toFixed(2)} pendiente de
                liquidar con {tiendaActual.proveedorNombre ?? "el proveedor"}{" "}
                por este producto. Liquida ese saldo antes de eliminar la
                consignación.
              </Alert>
            )}

            {!tieneDeudaPendiente &&
              tiendaActual &&
              tiendaActual.existencia > 0 &&
              (esConsignacionActual ? (
                <Alert severity="error">
                  Esta consignación tiene existencia de{" "}
                  {tiendaActual.existencia}. Al eliminarla, la cantidad se
                  ajustará a 0 (quedará registrada la devolución) y luego se
                  eliminará solo esta consignación.
                </Alert>
              ) : (
                <Alert severity="error">
                  Este producto tiene existencia de {tiendaActual.existencia} en
                  esta tienda. Al eliminarlo, la cantidad se ajustará a 0
                  (quedará registrado el movimiento correspondiente) y luego se
                  eliminará solo de esta tienda.
                </Alert>
              ))}

            {otrosRegistros.length > 0 && (
              <Alert severity="info">
                No se verá afectado en {otrosRegistros.length} otro(s)
                registro(s) de este producto donde también está presente.
              </Alert>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={loading || !info || tieneDeudaPendiente}
        >
          Eliminar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
