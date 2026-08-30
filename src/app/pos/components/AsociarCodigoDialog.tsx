"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import LinkIcon from "@mui/icons-material/Link";
import CloseIcon from "@mui/icons-material/Close";
import { IProductoTiendaPos } from "@/schemas/producto";
import { asociarCodigoProducto } from "@/services/productServise";
import { normalizeSearch } from "@/utils/formatters";
import { MultiCurrencyAmount } from "@/components/MultiCurrencyAmount";
import { useAppContext } from "@/context/AppContext";
import { convertToBase } from "@/lib/currency";
import SelectableTextField from "@/components/SelectableTextField";

interface AsociarCodigoDialogProps {
  open: boolean;
  codigo: string;
  productosTienda: IProductoTiendaPos[];
  onClose: () => void;
  onAsociado: (producto: IProductoTiendaPos, codigoNuevo: string) => void;
}

export function AsociarCodigoDialog({
  open,
  codigo,
  productosTienda,
  onClose,
  onAsociado,
}: AsociarCodigoDialogProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [busqueda, setBusqueda] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] =
    useState<IProductoTiendaPos | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { tasasVigentes, monedaBase } = useAppContext();

  const resultados = useMemo(() => {
    if (!busqueda.trim()) return [];
    return productosTienda
      .filter((p) =>
        normalizeSearch(p.producto.nombre).includes(normalizeSearch(busqueda)),
      )
      .slice(0, 8);
  }, [productosTienda, busqueda]);

  const handleSeleccionar = (producto: IProductoTiendaPos) => {
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

  const body = (
    <>
      <Box mb={2}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          El código escaneado no está registrado. Puedes asociarlo a un producto
          existente para agilizar futuras ventas.
        </Typography>
        <Chip
          label={codigo}
          variant="outlined"
          color="warning"
          size="small"
          sx={{ fontFamily: "monospace", mt: 0.5 }}
        />
      </Box>

      <SelectableTextField
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
                  secondary={
                    <Box
                      component="span"
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.25,
                        mt: 0.25,
                      }}
                    >
                      <MultiCurrencyAmount
                        amount={convertToBase(
                          prod.precio,
                          prod.monedaPrecioCode ?? monedaBase,
                          tasasVigentes,
                          monedaBase,
                        )}
                        variant="compact"
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        component="span"
                      >
                        Stock: {prod.existencia}
                      </Typography>
                    </Box>
                  }
                  secondaryTypographyProps={{ component: "div" }}
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
    </>
  );

  const cancelarButton = (
    <Button
      onClick={handleCerrar}
      disabled={cargando}
      fullWidth={isMobile}
      sx={{ minHeight: isMobile ? 44 : undefined }}
    >
      Cancelar
    </Button>
  );

  const asociarButton = (
    <Button
      variant="contained"
      onClick={handleConfirmar}
      disabled={!productoSeleccionado || cargando}
      fullWidth={isMobile}
      size={isMobile ? "large" : "medium"}
      sx={{ minHeight: isMobile ? 56 : undefined }}
      startIcon={cargando ? <CircularProgress size={16} /> : <LinkIcon />}
    >
      {cargando ? "Asociando..." : "Asociar código"}
    </Button>
  );

  if (isMobile) {
    // Hoja del POS: mismo objeto que SalesDrawer/UserSalesDrawer —
    // radio de 16px arriba, cabecera en versalitas.
    return (
      <Drawer
        anchor="bottom"
        open={open}
        onClose={handleCerrar}
        PaperProps={{
          sx: { borderRadius: "16px 16px 0 0" },
        }}
      >
        <Box
          sx={{
            width: "100vw",
            pb: "calc(8px + env(safe-area-inset-bottom))",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 2,
              pt: 2,
              pb: 1.5,
            }}
          >
            <Typography
              sx={{
                fontSize: "11.5px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "text.secondary",
              }}
            >
              Código no reconocido
            </Typography>
            <IconButton onClick={handleCerrar} disabled={cargando}>
              <CloseIcon />
            </IconButton>
          </Box>
          <Box sx={{ px: 2 }}>{body}</Box>
          <Box
            sx={{
              display: "grid",
              gap: "9px",
              px: 2,
              pt: 2,
            }}
          >
            {asociarButton}
            {cancelarButton}
          </Box>
        </Box>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={handleCerrar} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <LinkIcon color="warning" />
          <Typography variant="h6">Código no reconocido</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>{body}</DialogContent>

      <DialogActions>
        {cancelarButton}
        {asociarButton}
      </DialogActions>
    </Dialog>
  );
}
