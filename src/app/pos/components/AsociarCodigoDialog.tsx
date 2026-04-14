"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import LinkIcon from "@mui/icons-material/Link";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { asociarCodigoProducto } from "@/services/productServise";
import { normalizeSearch } from "@/utils/formatters";

interface AsociarCodigoDialogProps {
  open: boolean;
  codigo: string;
  productosTienda: IProductoTiendaV2[];
  onClose: () => void;
  onAsociado: (producto: IProductoTiendaV2, codigoNuevo: string) => void;
}

export function AsociarCodigoDialog({
  open,
  codigo,
  productosTienda,
  onClose,
  onAsociado,
}: AsociarCodigoDialogProps) {
  const [busqueda, setBusqueda] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<IProductoTiendaV2 | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resultados = useMemo(() => {
    if (!busqueda.trim()) return [];
    return productosTienda
      .filter((p) =>
        normalizeSearch(p.producto.nombre).includes(normalizeSearch(busqueda))
      )
      .slice(0, 8);
  }, [productosTienda, busqueda]);

  const handleSeleccionar = (producto: IProductoTiendaV2) => {
    setProductoSeleccionado(producto);
    setBusqueda(producto.producto.nombre);
    setError(null);
  };

  const handleConfirmar = async () => {
    if (!productoSeleccionado) return;
    setCargando(true);
    setError(null);
    try {
      await asociarCodigoProducto(productoSeleccionado.productoId, codigo);
      onAsociado(productoSeleccionado, codigo);
      handleCerrar();
    } catch (err: unknown) {
      const mensaje =
        err?.["response"]?.data?.error ||
        "No se pudo asociar el código. Intente de nuevo.";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  };

  const handleCerrar = () => {
    setBusqueda("");
    setProductoSeleccionado(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleCerrar} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <LinkIcon color="warning" />
          <Typography variant="h6">Código no reconocido</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box mb={2}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            El código escaneado no está registrado. Puedes asociarlo a un
            producto existente para agilizar futuras ventas.
          </Typography>
          <Chip
            label={codigo}
            variant="outlined"
            color="warning"
            size="small"
            sx={{ fontFamily: "monospace", mt: 0.5 }}
          />
        </Box>

        <TextField
          fullWidth
          autoFocus
          label="Buscar producto"
          placeholder="Nombre del producto..."
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            if (productoSeleccionado) setProductoSeleccionado(null);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />

        {busqueda.trim() && !productoSeleccionado && (
          <List
            dense
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              maxHeight: 240,
              overflow: "auto",
            }}
          >
            {resultados.length === 0 ? (
              <Box px={2} py={1.5}>
                <Typography variant="body2" color="text.secondary">
                  Sin resultados
                </Typography>
              </Box>
            ) : (
              resultados.map((prod) => (
                <ListItemButton
                  key={prod.id}
                  onClick={() => handleSeleccionar(prod)}
                  divider
                >
                  <ListItemText
                    primary={prod.producto.nombre}
                    secondary={`$${prod.precio} · Stock: ${prod.existencia}`}
                  />
                </ListItemButton>
              ))
            )}
          </List>
        )}

        {productoSeleccionado && (
          <Alert severity="success" sx={{ mt: 1 }}>
            Se asociará el código <strong>{codigo}</strong> a{" "}
            <strong>{productoSeleccionado.producto.nombre}</strong>
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCerrar} disabled={cargando}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={handleConfirmar}
          disabled={!productoSeleccionado || cargando}
          startIcon={cargando ? <CircularProgress size={16} /> : <LinkIcon />}
        >
          {cargando ? "Asociando..." : "Asociar código"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
