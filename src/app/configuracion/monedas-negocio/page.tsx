"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Add, Close, CurrencyExchange, Warning } from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/LoadingState";
import { StatusPill } from "@/components/StatusPill";

import { CurrencyCode } from "./components/CurrencyCode";
import { MonedaNegocioCard } from "./components/MonedaNegocioCard";
import { ContentCard } from "@/components/ContentCard";
import {
  getMonedasGlobales,
  habilitarMonedaNegocio,
  updateMonedaNegocio,
  deshabilitarMonedaNegocio,
} from "@/services/monedaService";
import {
  previewCambiarMonedaBase,
  ejecutarCambioMonedaBase,
} from "@/services/tasaCambioService";
import type {
  IMonedaConDenominaciones,
  INegocioMoneda,
} from "@/schemas/moneda";
import type { ICambiarMonedaBasePreview } from "@/services/tasaCambioService";

const breadcrumbs = [
  { label: "Inicio", href: "/home" },
  { label: "Configuración", href: "/configuracion" },
  { label: "Monedas del negocio" },
];

export default function MonedasNegocioPage() {
  const { user, loadingContext, monedasNegocio, monedaBase, refreshMonedas } =
    useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [monedasGlobales, setMonedasGlobales] = useState<
    IMonedaConDenominaciones[]
  >([]);
  const [loading, setLoading] = useState(true);

  const [openHabilitar, setOpenHabilitar] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [admiteEfectivo, setAdmiteEfectivo] = useState(true);
  const [admiteTransferencia, setAdmiteTransferencia] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openCambioBase, setOpenCambioBase] = useState(false);
  const [nuevaBase, setNuevaBase] = useState("");
  const [preview, setPreview] = useState<ICambiarMonedaBasePreview | null>(
    null,
  );
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);

  const negocioId = user?.negocio?.id;
  // Excluir la moneda base de la lista editable (no se puede deshabilitar ni volver a poner como base)
  const monedasExtra = monedasNegocio.filter(
    (m) => m.monedaCode !== monedaBase,
  );
  const monedasHabilitadasCodes = new Set(
    monedasNegocio.map((m) => m.monedaCode),
  );
  const monedasDisponiblesParaHabilitar = monedasGlobales.filter(
    (m) =>
      m.activo && !monedasHabilitadasCodes.has(m.code) && m.code !== monedaBase,
  );

  useEffect(() => {
    if (!loadingContext) load();
  }, [loadingContext]);

  const load = async () => {
    setLoading(true);
    try {
      setMonedasGlobales(await getMonedasGlobales());
    } catch {
      showMessage("Error al cargar monedas", "error");
    } finally {
      setLoading(false);
    }
  };

  const openHabilitarDialog = () => {
    setSelectedCode(monedasDisponiblesParaHabilitar[0]?.code ?? "");
    setAdmiteEfectivo(true);
    setAdmiteTransferencia(false);
    setOpenHabilitar(true);
  };

  const habilitar = async () => {
    if (!selectedCode) return;
    setSaving(true);
    try {
      await habilitarMonedaNegocio(negocioId, {
        monedaCode: selectedCode,
        admiteEfectivo,
        admiteTransferencia,
      });
      showMessage("Moneda habilitada", "success");
      setOpenHabilitar(false);
      await refreshMonedas();
    } catch {
      showMessage("Error al habilitar moneda", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleMoneda = async (
    m: INegocioMoneda,
    campo: "admiteEfectivo" | "admiteTransferencia",
  ) => {
    try {
      await updateMonedaNegocio(negocioId, m.monedaCode, {
        admiteEfectivo:
          campo === "admiteEfectivo" ? !m.admiteEfectivo : m.admiteEfectivo,
        admiteTransferencia:
          campo === "admiteTransferencia"
            ? !m.admiteTransferencia
            : m.admiteTransferencia,
      });
      await refreshMonedas();
    } catch {
      showMessage("Error al actualizar", "error");
    }
  };

  const deshabilitar = async (m: INegocioMoneda) => {
    try {
      await deshabilitarMonedaNegocio(negocioId, m.monedaCode);
      await refreshMonedas();
    } catch {
      showMessage("Error al deshabilitar", "error");
    }
  };

  const abrirCambioBase = async (code: string) => {
    setNuevaBase(code);
    setPreview(null);
    setOpenCambioBase(true);
    setLoadingPreview(true);
    try {
      setPreview(await previewCambiarMonedaBase(negocioId, code));
    } catch (e: unknown) {
      showMessage(
        (e as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Error al cargar preview",
        "error",
      );
      setOpenCambioBase(false);
    } finally {
      setLoadingPreview(false);
    }
  };

  const ejecutarCambio = async () => {
    setEjecutando(true);
    try {
      await ejecutarCambioMonedaBase(negocioId, nuevaBase);
      showMessage("Moneda base cambiada correctamente", "success");
      setOpenCambioBase(false);
      await refreshMonedas();
    } catch {
      showMessage("Error al cambiar moneda base", "error");
    } finally {
      setEjecutando(false);
    }
  };

  if (loadingContext || loading) {
    return (
      <PageContainer title="Monedas del negocio" breadcrumbs={breadcrumbs}>
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Monedas del negocio"
      breadcrumbs={breadcrumbs}
      titleAdornment={
        <StatusPill label={`Moneda base: ${monedaBase}`} hue="accent" />
      }
      headerActions={
        !isMobile && monedasDisponiblesParaHabilitar.length > 0 ? (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openHabilitarDialog}
          >
            Habilitar moneda
          </Button>
        ) : undefined
      }
    >
      {isMobile && monedasDisponiblesParaHabilitar.length > 0 && (
        <Button
          variant="contained"
          startIcon={<Add />}
          fullWidth
          onClick={openHabilitarDialog}
          sx={{ minHeight: 48, mb: 2.5 }}
        >
          Habilitar moneda
        </Button>
      )}

      <ContentCard>
        {/* ── Vista móvil: cards ── */}
        {isMobile ? (
          <Stack spacing={1.5}>
            <MonedaNegocioCard code={monedaBase} base />

            {monedasExtra.map((m) => (
              <MonedaNegocioCard
                key={m.monedaCode}
                code={m.monedaCode}
                moneda={m}
                onToggle={(campo) => toggleMoneda(m, campo)}
                onUsarComoBase={() => abrirCambioBase(m.monedaCode)}
                onDeshabilitar={() => deshabilitar(m)}
              />
            ))}

            {monedasNegocio.length === 0 && (
              <Alert severity="info">No hay otras monedas habilitadas.</Alert>
            )}
          </Stack>
        ) : (
          /* ── Vista desktop: tabla ── */
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Moneda</TableCell>
                  <TableCell>Efectivo</TableCell>
                  <TableCell>Transferencia</TableCell>
                  <TableCell>Moneda base</TableCell>
                  <TableCell>Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow sx={{ bgcolor: "semantic.surface.sunken" }}>
                  <TableCell>
                    <Stack direction="row" gap={1} alignItems="center">
                      <CurrencyCode code={monedaBase} base />
                      <StatusPill label="Base" hue="accent" />
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Switch checked disabled size="small" />
                  </TableCell>
                  <TableCell>
                    <Switch checked disabled size="small" />
                  </TableCell>
                  <TableCell sx={{ color: "text.disabled" }}>—</TableCell>
                  <TableCell sx={{ color: "text.disabled" }}>—</TableCell>
                </TableRow>

                {monedasExtra.map((m) => (
                  <TableRow key={m.monedaCode}>
                    <TableCell>
                      <CurrencyCode code={m.monedaCode} />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={m.admiteEfectivo}
                        onChange={() => toggleMoneda(m, "admiteEfectivo")}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={m.admiteTransferencia}
                        onChange={() => toggleMoneda(m, "admiteTransferencia")}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        startIcon={<CurrencyExchange />}
                        onClick={() => abrirCambioBase(m.monedaCode)}
                      >
                        Usar como base
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => deshabilitar(m)}
                      >
                        Deshabilitar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {monedasExtra.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No hay otras monedas habilitadas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Dialog habilitar */}
      <Dialog
        open={openHabilitar}
        onClose={() => setOpenHabilitar(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Habilitar moneda
          {isMobile && (
            <IconButton onClick={() => setOpenHabilitar(false)}>
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Moneda</InputLabel>
              <Select
                value={selectedCode}
                label="Moneda"
                onChange={(e) => setSelectedCode(e.target.value)}
              >
                {monedasDisponiblesParaHabilitar.map((m) => (
                  <MenuItem key={m.code} value={m.code}>
                    {m.code} — {m.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={admiteEfectivo}
                  onChange={(e) => setAdmiteEfectivo(e.target.checked)}
                />
              }
              label="Admite efectivo"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={admiteTransferencia}
                  onChange={(e) => setAdmiteTransferencia(e.target.checked)}
                />
              }
              label="Admite transferencia"
            />
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: "stretch",
          }}
        >
          <Button
            onClick={() => setOpenHabilitar(false)}
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={habilitar}
            disabled={saving || !selectedCode}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
          >
            {saving ? <CircularProgress size={20} /> : "Habilitar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog cambio de moneda base */}
      <Dialog
        open={openCambioBase}
        onClose={() => !ejecutando && setOpenCambioBase(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          Cambiar moneda base a {nuevaBase}
          {isMobile && (
            <IconButton
              onClick={() => setOpenCambioBase(false)}
              disabled={ejecutando}
            >
              <Close />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          {loadingPreview && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {preview && (
            <Stack gap={2} mt={1}>
              <Alert severity="warning" icon={<Warning />}>
                Esta acción convertirá{" "}
                <strong>todos los precios y costos</strong> (
                {preview.totalProductos} productos) usando la tasa:{" "}
                <strong>
                  1 {nuevaBase} = {preview.tasa} {monedaBase}
                </strong>
                . No se puede deshacer automáticamente.
              </Alert>

              <Typography variant="subtitle2">
                Vista previa — primeros {preview.preview.length} productos:
              </Typography>

              {/* En móvil: lista; en desktop: tabla */}
              {isMobile ? (
                <Stack spacing={1}>
                  {preview.preview.map((p, i) => (
                    <Card key={i} variant="outlined">
                      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          mb={0.5}
                        >
                          {p.nombre}
                        </Typography>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">
                            Antes: {p.precioAntes.toFixed(2)} {monedaBase}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="success.main"
                            fontWeight="medium"
                          >
                            Después: {p.precioDepues.toFixed(2)} {nuevaBase}
                          </Typography>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Card variant="outlined">
                  <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Producto</TableCell>
                          <TableCell>Precio antes</TableCell>
                          <TableCell>Precio después</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.preview.map((p, i) => (
                          <TableRow key={i}>
                            <TableCell>{p.nombre}</TableCell>
                            <TableCell>
                              {p.precioAntes.toFixed(2)} {monedaBase}
                            </TableCell>
                            <TableCell>
                              {p.precioDepues.toFixed(2)} {nuevaBase}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: "stretch",
          }}
        >
          <Button
            onClick={() => setOpenCambioBase(false)}
            disabled={ejecutando}
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={ejecutarCambio}
            disabled={ejecutando || loadingPreview || !preview}
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
          >
            {ejecutando ? <CircularProgress size={20} /> : "Confirmar cambio"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
