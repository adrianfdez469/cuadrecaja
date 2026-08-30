"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Add, History, TrendingUp } from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/LoadingState";
import { ContentCard } from "@/components/ContentCard";
import { StatusPill } from "@/components/StatusPill";
import { TasasReferenciaCard } from "@/components/TasasReferenciaCard";
import useConfirmDialog from "@/components/confirmDialog";
import {
  getTasasCambio,
  registrarTasaCambio,
} from "@/services/tasaCambioService";
import type { ITasaCambio } from "@/schemas/tasaCambio";
import type { ITasaReferencia } from "@/schemas/tasaReferencia";

const breadcrumbs = [
  { label: "Inicio", href: "/home" },
  { label: "Configuración", href: "/configuracion" },
  { label: "Tasas de cambio" },
];

const fmtDate = (d: Date) =>
  new Date(d).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtDay = (d: Date) =>
  new Date(d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

export default function TasasCambioPage() {
  const { user, loadingContext, monedasNegocio, monedaBase, refreshMonedas } =
    useAppContext();
  const { showMessage } = useMessageContext();
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [tasas, setTasas] = useState<ITasaCambio[]>([]);
  const [vigentes, setVigentes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(0);

  const [openDialog, setOpenDialog] = useState(false);
  const [monedaCode, setMonedaCode] = useState("");
  const [tasaValor, setTasaValor] = useState("");
  const [saving, setSaving] = useState(false);

  const negocioId = user?.negocio?.id;
  const monedasDisponibles = monedasNegocio.filter(
    (m) => m.monedaCode !== "CUP" && m.activo,
  );

  useEffect(() => {
    if (!loadingContext && negocioId) load();
  }, [loadingContext, negocioId]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getTasasCambio(negocioId);
      setTasas(res.tasas);
      setVigentes(res.vigentes);
    } catch {
      showMessage("Error al cargar tasas", "error");
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setMonedaCode(monedasDisponibles[0]?.monedaCode ?? "");
    setTasaValor("");
    setOpenDialog(true);
  };

  const saveTasa = async () => {
    const val = parseFloat(tasaValor);
    if (!monedaCode || !val || val <= 0) return;
    setSaving(true);
    try {
      await registrarTasaCambio(negocioId, { monedaCode, tasa: val });
      showMessage("Tasa registrada", "success");
      setOpenDialog(false);
      await load();
      await refreshMonedas();
    } catch {
      showMessage("Error al registrar tasa", "error");
    } finally {
      setSaving(false);
    }
  };

  // `confirmDialog` es por callbacks; envolverlo en promesa permite esperar la decisión
  // del usuario y mantener el spinner del botón mientras tanto.
  const confirmar = (mensaje: string) =>
    new Promise<boolean>((resolve) => {
      confirmDialog(
        mensaje,
        () => resolve(true),
        () => resolve(false),
        { severity: "warning" },
      );
    });

  const CONSECUENCIA = "Afectará precios, vueltos y cierres a partir de ahora.";

  const aplicarReferencia = async (
    referencia: ITasaReferencia,
    vigente?: number,
  ) => {
    const cambio =
      vigente === undefined
        ? `Se registrará en ${referencia.tasa} CUP.`
        : `Pasará de ${vigente} a ${referencia.tasa} CUP.`;
    const ok = await confirmar(
      `¿Aplicar la tasa de referencia de elTOQUE para ${referencia.monedaCode}? ${cambio} ${CONSECUENCIA}`,
    );
    if (!ok) return;

    try {
      await registrarTasaCambio(negocioId, {
        monedaCode: referencia.monedaCode,
        tasa: referencia.tasa,
      });
      showMessage(`Tasa de ${referencia.monedaCode} actualizada`, "success");
      await load();
      await refreshMonedas();
    } catch {
      showMessage(
        `Error al aplicar la tasa de ${referencia.monedaCode}`,
        "error",
      );
    }
  };

  const aplicarTodasReferencias = async (referencias: ITasaReferencia[]) => {
    if (referencias.length === 0) return;

    const detalle = referencias
      .map((r) => {
        const vigente = vigentes[r.monedaCode];
        return vigente === undefined
          ? `${r.monedaCode}: ${r.tasa} CUP`
          : `${r.monedaCode}: ${vigente} → ${r.tasa} CUP`;
      })
      .join(" · ");
    const ok = await confirmar(
      `¿Aplicar las tasas de referencia de elTOQUE? ${detalle}. ${CONSECUENCIA}`,
    );
    if (!ok) return;

    // Secuencial: si una falla se puede reportar cuál, sin abortar el resto.
    const fallidas: string[] = [];
    for (const referencia of referencias) {
      try {
        await registrarTasaCambio(negocioId, {
          monedaCode: referencia.monedaCode,
          tasa: referencia.tasa,
        });
      } catch {
        fallidas.push(referencia.monedaCode);
      }
    }

    if (fallidas.length === 0) {
      showMessage(`${referencias.length} tasas actualizadas`, "success");
    } else {
      showMessage(`No se pudieron aplicar: ${fallidas.join(", ")}`, "error");
    }
    await load();
    await refreshMonedas();
  };

  if (loadingContext || loading) {
    return (
      <PageContainer title="Tasas de cambio" breadcrumbs={breadcrumbs}>
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  const tasasMostradas = tasas.filter((t) => t.monedaCode !== "CUP");
  const vigentesExternas = Object.entries(vigentes).filter(
    ([k]) => k !== "CUP",
  );

  // Solo la vigente por moneda (una fila por código)
  const vigentesRows = Object.entries(vigentes)
    .filter(([code]) => code !== "CUP")
    .map(([code, tasa]) => ({ code, tasa }));

  // Histórico agrupado por día (key = ISO date string yyyy-mm-dd)
  const porFecha: Record<string, ITasaCambio[]> = {};
  for (const t of tasasMostradas) {
    const key = new Date(t.createdAt).toISOString().slice(0, 10);
    if (!porFecha[key]) porFecha[key] = [];
    porFecha[key].push(t);
  }
  // Keys ordenados más reciente primero
  const fechasOrdenadas = Object.keys(porFecha).sort((a, b) =>
    b.localeCompare(a),
  );

  const registrarTasaButton = monedasDisponibles.length > 0 && (
    <Button
      variant="contained"
      startIcon={<Add />}
      onClick={openAdd}
      fullWidth={isMobile}
      sx={isMobile ? { minHeight: 52 } : undefined}
    >
      Registrar tasa
    </Button>
  );

  return (
    <PageContainer
      title="Tasas de cambio"
      breadcrumbs={breadcrumbs}
      titleAdornment={
        <StatusPill label={`Moneda base: ${monedaBase}`} hue="accent" />
      }
      headerActions={!isMobile ? registrarTasaButton : undefined}
    >
      {isMobile && registrarTasaButton && (
        <Box sx={{ mb: 2.5 }}>{registrarTasaButton}</Box>
      )}

      <ContentCard>
        {monedasDisponibles.length === 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Habilita otras monedas en &quot;Monedas del negocio&quot; para
            registrar tasas.
          </Alert>
        )}

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
          <Tab
            icon={<TrendingUp fontSize="small" />}
            iconPosition="start"
            label="Vigentes"
          />
          <Tab
            icon={<History fontSize="small" />}
            iconPosition="start"
            label="Histórico"
          />
        </Tabs>

        {/* ── Tab 0: Vigentes ── */}
        {tab === 0 && (
          <>
            {vigentesExternas.length > 0 && (
              <Stack direction="row" gap={1} flexWrap="wrap" mb={2}>
                {vigentesExternas.map(([code, tasa]) => (
                  <Chip
                    key={code}
                    label={`1 ${code} = ${tasa} CUP`}
                    variant="outlined"
                    size={isMobile ? "small" : "medium"}
                    sx={{
                      bgcolor: "background.paper",
                      color: "text.secondary",
                    }}
                  />
                ))}
              </Stack>
            )}

            {monedasDisponibles.length > 0 && (
              <TasasReferenciaCard
                vigentes={vigentes}
                monedasHabilitadas={monedasDisponibles.map((m) => m.monedaCode)}
                onAplicar={aplicarReferencia}
                onAplicarTodas={aplicarTodasReferencias}
              />
            )}

            {isMobile ? (
              vigentesRows.length === 0 ? (
                <Alert severity="info">No hay tasas registradas.</Alert>
              ) : (
                <Box
                  sx={{
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <Typography
                    variant="overline"
                    color="text.disabled"
                    sx={{ display: "block", px: 2, pt: 1.75, pb: 1 }}
                  >
                    Tasa vigente
                  </Typography>
                  {vigentesRows.map(({ code, tasa }) => (
                    <Stack
                      key={code}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={1.5}
                      sx={{
                        minHeight: 56,
                        px: 2,
                        borderTop: 1,
                        borderColor: "divider",
                      }}
                    >
                      <Stack direction="row" alignItems="center" gap={1.25}>
                        <Chip
                          label={code}
                          size="small"
                          sx={{ bgcolor: "semantic.surface.sunken" }}
                        />
                        <Typography variant="body2">
                          1 {code} = <strong>{tasa}</strong> CUP
                        </Typography>
                      </Stack>
                      <StatusPill
                        label="Vigente"
                        hue="positive"
                        sx={{ flexShrink: 0 }}
                      />
                    </Stack>
                  ))}
                </Box>
              )
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Moneda</TableCell>
                      <TableCell>Tasa vigente</TableCell>
                      <TableCell>Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vigentesRows.map(({ code, tasa }) => (
                      <TableRow key={code}>
                        <TableCell>
                          <Chip label={code} size="small" />
                        </TableCell>
                        <TableCell>
                          1 {code} = <strong>{tasa}</strong> CUP
                        </TableCell>
                        <TableCell>
                          <Chip label="Vigente" color="success" size="small" />
                        </TableCell>
                      </TableRow>
                    ))}
                    {vigentesRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} align="center">
                          No hay tasas registradas
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {/* ── Tab 1: Histórico agrupado por fecha ── */}
        {tab === 1 && (
          <>
            {fechasOrdenadas.length === 0 && (
              <Alert severity="info">No hay registros históricos.</Alert>
            )}
            <Stack spacing={3}>
              {fechasOrdenadas.map((fechaKey) => {
                const registros = porFecha[fechaKey];
                return (
                  <Box key={fechaKey}>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ textTransform: "capitalize", mb: 1 }}
                    >
                      {fmtDay(new Date(fechaKey + "T12:00:00"))}
                    </Typography>
                    <Divider sx={{ mb: 1.5 }} />

                    {isMobile ? (
                      <Stack spacing={1}>
                        {registros.map((t) => {
                          const esVigente = vigentes[t.monedaCode] === t.tasa;
                          return (
                            <Card key={t.id} variant="outlined">
                              <CardContent
                                sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}
                              >
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  alignItems="center"
                                >
                                  <Stack
                                    direction="row"
                                    gap={0.75}
                                    alignItems="center"
                                  >
                                    <Chip label={t.monedaCode} size="small" />
                                    {esVigente ? (
                                      <Chip
                                        label="Vigente"
                                        color="success"
                                        size="small"
                                      />
                                    ) : (
                                      <Chip
                                        label="Histórica"
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </Stack>
                                  <Typography variant="body2" fontWeight="bold">
                                    {t.tasa} CUP
                                  </Typography>
                                </Stack>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                  mt={0.5}
                                >
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {t.creadoPor?.nombre ?? "—"}
                                  </Typography>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                  >
                                    {fmtDate(t.createdAt)}
                                  </Typography>
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </Stack>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Moneda</TableCell>
                              <TableCell>Tasa</TableCell>
                              <TableCell>Registrada por</TableCell>
                              <TableCell>Hora</TableCell>
                              <TableCell>Estado</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {registros.map((t) => {
                              const esVigente =
                                vigentes[t.monedaCode] === t.tasa;
                              return (
                                <TableRow
                                  key={t.id}
                                  sx={{ opacity: esVigente ? 1 : 0.55 }}
                                >
                                  <TableCell>
                                    <Chip label={t.monedaCode} size="small" />
                                  </TableCell>
                                  <TableCell>
                                    1 {t.monedaCode} = <strong>{t.tasa}</strong>{" "}
                                    CUP
                                  </TableCell>
                                  <TableCell>
                                    {t.creadoPor?.nombre ?? "—"}
                                  </TableCell>
                                  <TableCell>
                                    {new Date(t.createdAt).toLocaleTimeString(
                                      "es-ES",
                                      { hour: "2-digit", minute: "2-digit" },
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {esVigente ? (
                                      <Chip
                                        label="Vigente"
                                        color="success"
                                        size="small"
                                      />
                                    ) : (
                                      <Chip
                                        label="Histórica"
                                        size="small"
                                        variant="outlined"
                                      />
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </Box>
                );
              })}
            </Stack>
          </>
        )}
      </ContentCard>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Registrar tasa de cambio</DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Moneda</InputLabel>
              <Select
                value={monedaCode}
                label="Moneda"
                onChange={(e) => setMonedaCode(e.target.value)}
              >
                {monedasDisponibles.map((m) => (
                  <MenuItem key={m.monedaCode} value={m.monedaCode}>
                    {m.monedaCode} — {m.moneda?.nombre}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label={`Cuántos CUP vale 1 ${monedaCode || "..."}`}
              type="number"
              value={tasaValor}
              onChange={(e) => setTasaValor(e.target.value)}
              inputProps={{ min: 0, step: 0.01 }}
              fullWidth
              helperText={
                monedaCode && tasaValor
                  ? `1 ${monedaCode} = ${tasaValor} CUP`
                  : ""
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={saveTasa} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : "Registrar"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
