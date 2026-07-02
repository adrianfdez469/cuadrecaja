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
import { ticketPayloadToTextLines } from "@/features/printing/lib/escpos/encoder";
import { usePrintTemplateCache } from "@/features/printing/store/printTemplateCache";
import { TicketPreviewDialog } from "@/features/printing/components/TicketPreviewDialog";
import { Sale } from "@/store/salesStore";

const SAMPLE_SALE: Sale = {
  identifier: "preview-0000-4000-8000-000000000099",
  tiendaId: "",
  cierreId: "preview",
  usuarioId: "preview",
  total: 325,
  totalcash: 275,
  totaltransfer: 50,
  productos: [
    {
      cantidad: 2,
      productoTiendaId: "pt1",
      productId: "p1",
      name: "Pasta de Dientes Artesanal Caribe Bello",
      price: 75,
    },
    {
      cantidad: 1,
      productoTiendaId: "pt2",
      productId: "p2",
      name: "Refresco Cola 2L",
      price: 175,
    },
  ],
  synced: true,
  syncState: "synced",
  createdAt: Date.now(),
  wasOffline: false,
  syncAttempts: 0,
  discountCodes: ["PROMO10"],
};

export default function TicketConfigPage() {
  const { user, monedaBase } = useAppContext();
  const { showMessage } = useMessageContext();
  const { verificarPermiso } = usePermisos();
  const setPlantillaCache = usePrintTemplateCache((s) => s.setPlantilla);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState<IUpdateTicketPlantilla>(DEFAULT_TICKET_PLANTILLA);

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
        encabezado: data.encabezado,
        pie: data.pie,
        mostrarCajero: data.mostrarCajero,
        mostrarDescuentos: data.mostrarDescuentos,
        mostrarMultimoneda: data.mostrarMultimoneda,
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
    const plantilla = {
      tiendaId: tiendaId ?? "",
      ...form,
    };
    return buildTicketPayload(
      { ...SAMPLE_SALE, tiendaId: tiendaId ?? "" },
      plantilla,
      {
        tiendaNombre: user.localActual.nombre,
        negocioNombre: user.negocio.nombre,
        cajeroNombre: user.nombre,
        monedaBase: monedaBase ?? user.negocio.monedaBase ?? "CUP",
      },
    );
  }, [form, user, tiendaId, monedaBase]);

  const inlinePreview = previewPayload
    ? ticketPayloadToTextLines(previewPayload)
    : [];

  if (!canEdit) {
    return (
      <PageContainer title="Ticket de venta">
        <Alert severity="warning">No tiene permiso para configurar tickets.</Alert>
      </PageContainer>
    );
  }

  if (!tiendaId) {
    return (
      <PageContainer title="Ticket de venta">
        <Alert severity="info">Seleccione una tienda activa para configurar el ticket.</Alert>
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
          <Stack spacing={2}>
            <TextField
              label="Encabezado"
              value={form.encabezado ?? ""}
              onChange={(e) => setForm({ ...form, encabezado: e.target.value || null })}
              multiline
              minRows={2}
              helperText="Máx. 2 líneas en el ticket impreso"
              fullWidth
            />
            <TextField
              label="Pie personalizado"
              value={form.pie ?? ""}
              onChange={(e) => setForm({ ...form, pie: e.target.value || null })}
              multiline
              minRows={2}
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
            <FormControlLabel
              control={
                <Switch
                  checked={form.mostrarDescuentos}
                  onChange={(e) =>
                    setForm({ ...form, mostrarDescuentos: e.target.checked })
                  }
                />
              }
              label="Mostrar descuentos"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.mostrarMultimoneda}
                  onChange={(e) =>
                    setForm({ ...form, mostrarMultimoneda: e.target.checked })
                  }
                />
              }
              label="Mostrar desglose multimoneda"
            />
            <TextField
              label="URL del logo (opcional)"
              value={form.logoUrl ?? ""}
              onChange={(e) =>
                setForm({ ...form, logoUrl: e.target.value || null })
              }
              fullWidth
              size="small"
            />

            <Box
              sx={{
                bgcolor: "grey.100",
                p: 1.5,
                borderRadius: 1,
                fontFamily: "monospace",
                fontSize: 12,
              }}
            >
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                Vista previa compacta
              </Typography>
              {inlinePreview.map((line, i) => (
                <Typography key={i} variant="body2" sx={{ fontFamily: "inherit" }}>
                  {line}
                </Typography>
              ))}
            </Box>

            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
              <Button variant="outlined" onClick={() => setPreviewOpen(true)}>
                Vista previa ampliada
              </Button>
            </Stack>
          </Stack>
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
