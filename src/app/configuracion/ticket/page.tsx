"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  Alert,
  Divider,
  Grid2 as Grid,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Save, Receipt } from "@mui/icons-material";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { usePermisos } from "@/utils/permisos_front";
import {
  getTicketPlantilla,
  updateTicketPlantilla,
} from "@/services/ticketPlantillaService";
import {
  DEFAULT_TICKET_PLANTILLA,
  IUpdateTicketPlantilla,
} from "@/schemas/ticketPlantilla";
import { TICKET_FOOTER_URL } from "@/constants/ticket";
import { buildTicketPayload } from "@/features/printing/lib/buildTicketPayload";
import { usePrintTemplateCache } from "@/features/printing/store/printTemplateCache";
import { TicketPreviewDialog } from "@/features/printing/components/TicketPreviewDialog";
import { TicketPreviewContent } from "@/features/printing/components/TicketPreviewContent";
import { Sale } from "@/store/salesStore";

const SAMPLE_SALE: Sale = {
  identifier: "preview-0000-4000-8000-000000000099",
  tiendaId: "",
  cierreId: "preview",
  usuarioId: "preview",
  total: 315,
  totalcash: 265,
  totaltransfer: 50,
  productos: [
    {
      cantidad: 3,
      productoTiendaId: "pt1",
      productId: "p1",
      name: "PRODUCTO LARGO NOMBRE QUE CONTINUA AQUI",
      price: 75,
    },
    {
      cantidad: 1,
      productoTiendaId: "pt2",
      productId: "p2",
      name: "Refresco Cola 2L",
      price: 100,
    },
  ],
  synced: true,
  syncState: "synced",
  createdAt: Date.now(),
  wasOffline: false,
  syncAttempts: 0,
  discountCodes: ["PROMO10"],
  discountTotal: 10,
  monedaCobro: "CUP",
  tasaSnapshot: { USD: 120 },
  pagosDetalle: [
    { tipo: "cash", moneda: "USD", monto: 2, equivalenteBase: 240 },
    { tipo: "cash", moneda: "CUP", monto: 25, equivalenteBase: 25 },
    { tipo: "transfer", moneda: "CUP", monto: 50, equivalenteBase: 50 },
  ],
  vueltoDetalle: [{ moneda: "CUP", monto: 10 }],
};

export default function TicketConfigPage() {
  const { user, monedaBase } = useAppContext();
  const { showMessage } = useMessageContext();
  const { verificarPermiso } = usePermisos();
  const setPlantillaCache = usePrintTemplateCache((s) => s.setPlantilla);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState<IUpdateTicketPlantilla>(
    DEFAULT_TICKET_PLANTILLA,
  );

  const tiendaId = user?.localActual?.id;
  const canEdit = verificarPermiso("configuracion.ticket.editar");

  useEffect(() => {
    if (!tiendaId || !canEdit) {
      setLoading(false);
      return;
    }
    loadPlantilla();
  }, [tiendaId, canEdit]);

  const loadPlantilla = async () => {
    if (!tiendaId) return;
    setLoading(true);
    try {
      const data = await getTicketPlantilla(tiendaId);
      setForm({
        pie: data.pie,
        mostrarNegocio: data.mostrarNegocio ?? true,
        mostrarTienda: data.mostrarTienda ?? true,
        mostrarCajero: data.mostrarCajero,
        mostrarDescuentos: data.mostrarDescuentos,
        mostrarPropina: data.mostrarPropina ?? true,
        mostrarMultimoneda: data.mostrarMultimoneda,
        mostrarTasas: data.mostrarTasas ?? false,
        mostrarTotalesSecundarios: data.mostrarTotalesSecundarios ?? true,
        marcarLineasVacias: data.marcarLineasVacias ?? true,
        anchoPapel: data.anchoPapel === 80 ? 80 : 58,
        logoUrl: data.logoUrl,
      });
      setPlantillaCache(tiendaId, data);
    } catch {
      showMessage("Error al cargar plantilla de ticket", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tiendaId) return;
    setSaving(true);
    try {
      const saved = await updateTicketPlantilla(tiendaId, form);
      setPlantillaCache(tiendaId, saved);
      showMessage("Plantilla de ticket guardada", "success");
    } catch {
      showMessage("Error al guardar plantilla", "error");
    } finally {
      setSaving(false);
    }
  };

  const previewPayload = useMemo(() => {
    if (!user?.localActual) return null;
    const base = monedaBase ?? user.negocio.monedaBase ?? "CUP";
    const plantilla = {
      tiendaId: tiendaId ?? "",
      ...form,
    };
    return buildTicketPayload(
      { ...SAMPLE_SALE, tiendaId: tiendaId ?? "", monedaCobro: base },
      plantilla,
      {
        tiendaNombre: user.localActual.nombre,
        negocioNombre: user.negocio.nombre,
        cajeroNombre: user.nombre,
        monedaBase: base,
      },
    );
  }, [form, user, tiendaId, monedaBase]);

  if (!canEdit) {
    return (
      <PageContainer title="Ticket de venta">
        <Alert severity="warning">
          No tiene permiso para configurar tickets.
        </Alert>
      </PageContainer>
    );
  }

  if (!tiendaId) {
    return (
      <PageContainer title="Ticket de venta">
        <Alert severity="info">
          Seleccione una tienda activa para configurar el ticket.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Ticket de venta"
      subtitle={`Plantilla para: ${user.localActual.nombre}`}
    >
      <ContentCard>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {/* Left column: Form */}
            <Grid size={{ xs: 12, md: isMobile ? 12 : 7 }} sx={{ minWidth: 0 }}>
              <Stack spacing={2}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "11.5px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "text.secondary",
                    mt: 1,
                  }}
                >
                  Cabecera
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarNegocio}
                      onChange={(e) =>
                        setForm({ ...form, mostrarNegocio: e.target.checked })
                      }
                    />
                  }
                  label="Mostrar nombre del negocio"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarTienda}
                      onChange={(e) =>
                        setForm({ ...form, mostrarTienda: e.target.checked })
                      }
                    />
                  }
                  label="Mostrar nombre de la tienda"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarCajero}
                      onChange={(e) =>
                        setForm({ ...form, mostrarCajero: e.target.checked })
                      }
                    />
                  }
                  label="Mostrar cajero"
                />

                <Divider />

                <TextField
                  label="Pie personalizado"
                  value={form.pie ?? ""}
                  onChange={(e) =>
                    setForm({ ...form, pie: e.target.value || null })
                  }
                  multiline
                  minRows={2}
                  placeholder="GRACIAS POR SU COMPRA"
                  helperText="Si está vacío se usa el texto predeterminado"
                  fullWidth
                />
                <Alert severity="info" icon={<Receipt fontSize="small" />}>
                  Al final de todo ticket se imprimirá siempre:{" "}
                  <strong>{TICKET_FOOTER_URL}</strong>
                </Alert>

                <FormControl fullWidth size="small">
                  <InputLabel>Ancho de papel</InputLabel>
                  <Select
                    value={form.anchoPapel}
                    label="Ancho de papel"
                    onChange={(e) =>
                      setForm({
                        ...form,
                        anchoPapel: Number(e.target.value) as 58 | 80,
                      })
                    }
                  >
                    <MenuItem value={58}>58 mm</MenuItem>
                    <MenuItem value={80}>80 mm</MenuItem>
                  </Select>
                </FormControl>

                <Typography
                  variant="caption"
                  sx={{
                    fontSize: "11.5px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "text.secondary",
                    mt: 1,
                  }}
                >
                  Contenido Opcional
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarTasas}
                      onChange={(e) =>
                        setForm({ ...form, mostrarTasas: e.target.checked })
                      }
                    />
                  }
                  label="Mostrar tasas de cambio (solo monedas usadas en la venta)"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarDescuentos}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mostrarDescuentos: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Mostrar descuentos"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarPropina}
                      onChange={(e) =>
                        setForm({ ...form, mostrarPropina: e.target.checked })
                      }
                    />
                  }
                  label="Mostrar propina"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarMultimoneda}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mostrarMultimoneda: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Mostrar pagos y vuelto por moneda"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.mostrarTotalesSecundarios}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          mostrarTotalesSecundarios: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Mostrar totales en monedas secundarias"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={form.marcarLineasVacias}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          marcarLineasVacias: e.target.checked,
                        })
                      }
                    />
                  }
                  label="Marcar renglones vacíos con caracteres"
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: -1 }}
                >
                  Actívelo solo si su impresora no avanza el papel en renglones
                  en blanco. Agrega un carácter en los bordes de los renglones
                  de avance para forzar el salto de línea.
                </Typography>

                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setPreviewOpen(true)}
                  >
                    Vista previa ampliada
                  </Button>
                </Stack>
              </Stack>
            </Grid>

            {/* Right column: Preview */}
            {!isMobile && (
              <Grid
                size={{ xs: 12, md: 5 }}
                sx={{
                  minWidth: 0,
                  position: "sticky",
                  top: 20,
                  height: "fit-content",
                }}
              >
                {previewPayload ? (
                  <Box
                    sx={{
                      maxWidth: 420,
                      bgcolor: "background.paper",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "divider",
                      p: 2,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: "11.5px",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "text.secondary",
                        display: "block",
                        mb: 1.5,
                      }}
                    >
                      Vista Previa
                    </Typography>
                    <Box sx={{ overflow: "auto", maxHeight: "60vh" }}>
                      <TicketPreviewContent payload={previewPayload} />
                    </Box>
                  </Box>
                ) : null}
              </Grid>
            )}
          </Grid>
        )}
      </ContentCard>

      <TicketPreviewDialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        payload={previewPayload}
      />
    </PageContainer>
  );
}
