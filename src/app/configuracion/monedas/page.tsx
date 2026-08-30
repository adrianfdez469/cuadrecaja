"use client";

import { Fragment, useEffect, useState } from "react";
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
  IconButton,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Add, Edit, ExpandLess, ExpandMore } from "@mui/icons-material";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { PageContainer } from "@/components/PageContainer";
import { LoadingState } from "@/components/LoadingState";
import { ContentCard } from "@/components/ContentCard";
import useConfirmDialog from "@/components/confirmDialog";
import {
  getMonedasGlobales,
  createMoneda,
  updateMoneda,
  deactivateMoneda,
  createDenominacion,
  deleteDenominacion,
} from "@/services/monedaService";
import type {
  IMonedaConDenominaciones,
  IDenominacionBillete,
} from "@/schemas/moneda";

const breadcrumbs = [
  { label: "Inicio", href: "/home" },
  { label: "Configuración", href: "/configuracion" },
  { label: "Monedas" },
];

export default function MonedasPage() {
  const router = useRouter();
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [monedas, setMonedas] = useState<IMonedaConDenominaciones[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState<string | null>(null);

  const [openMonedaDialog, setOpenMonedaDialog] = useState(false);
  const [editingMoneda, setEditingMoneda] =
    useState<IMonedaConDenominaciones | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [newSimbolo, setNewSimbolo] = useState("");
  const [savingMoneda, setSavingMoneda] = useState(false);

  const [openDenomDialog, setOpenDenomDialog] = useState(false);
  const [denomMonedaCode, setDenomMonedaCode] = useState("");
  const [newDenomValor, setNewDenomValor] = useState("");
  const [savingDenom, setSavingDenom] = useState(false);

  useEffect(() => {
    if (!loadingContext && user?.rol !== "SUPER_ADMIN") {
      showMessage("Acceso denegado", "error");
      router.push("/home");
    }
  }, [user, loadingContext, router, showMessage]);

  useEffect(() => {
    if (user?.rol === "SUPER_ADMIN") load();
  }, [user]);

  const load = async () => {
    setLoading(true);
    try {
      setMonedas(await getMonedasGlobales());
    } catch {
      showMessage("Error al cargar monedas", "error");
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingMoneda(null);
    setNewCode("");
    setNewNombre("");
    setNewSimbolo("");
    setOpenMonedaDialog(true);
  };

  const openEdit = (m: IMonedaConDenominaciones) => {
    setEditingMoneda(m);
    setNewCode(m.code);
    setNewNombre(m.nombre);
    setNewSimbolo(m.simbolo);
    setOpenMonedaDialog(true);
  };

  const saveMoneda = async () => {
    if (!newCode.trim() || !newNombre.trim() || !newSimbolo.trim()) return;
    setSavingMoneda(true);
    try {
      if (editingMoneda) {
        await updateMoneda(editingMoneda.code, {
          nombre: newNombre,
          simbolo: newSimbolo,
        });
        showMessage("Moneda actualizada", "success");
      } else {
        await createMoneda({
          code: newCode.toUpperCase(),
          nombre: newNombre,
          simbolo: newSimbolo,
        });
        showMessage("Moneda creada", "success");
      }
      setOpenMonedaDialog(false);
      load();
    } catch {
      showMessage("Error al guardar moneda", "error");
    } finally {
      setSavingMoneda(false);
    }
  };

  const toggleActivo = async (m: IMonedaConDenominaciones) => {
    try {
      if (m.activo) {
        await deactivateMoneda(m.code);
      } else {
        await updateMoneda(m.code, { activo: true });
      }
      load();
    } catch {
      showMessage("Error al cambiar estado", "error");
    }
  };

  const openAddDenom = (code: string) => {
    setDenomMonedaCode(code);
    setNewDenomValor("");
    setOpenDenomDialog(true);
  };

  const saveDenom = async () => {
    const val = parseFloat(newDenomValor);
    if (!val || val <= 0) return;
    setSavingDenom(true);
    try {
      await createDenominacion(denomMonedaCode, { valor: val });
      showMessage("Denominación agregada", "success");
      setOpenDenomDialog(false);
      load();
    } catch {
      showMessage("Error al agregar denominación", "error");
    } finally {
      setSavingDenom(false);
    }
  };

  const removeDenom = async (code: string, denom: IDenominacionBillete) => {
    try {
      await deleteDenominacion(code, denom.id);
      load();
    } catch {
      showMessage("Error al eliminar denominación", "error");
    }
  };

  const handleRemoveDenom = (code: string, denom: IDenominacionBillete) => {
    confirmDialog(
      `¿Eliminar la denominación ${denom.valor}?`,
      () => removeDenom(code, denom),
      undefined,
      { severity: "error" },
    );
  };

  const toggle = (code: string) =>
    setExpandedCode((prev) => (prev === code ? null : code));

  if (loadingContext || loading) {
    return (
      <PageContainer title="Monedas del sistema" breadcrumbs={breadcrumbs}>
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Monedas del sistema" breadcrumbs={breadcrumbs}>
      <ContentCard>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h6">Monedas del sistema</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openCreate}
            size={isMobile ? "small" : "medium"}
          >
            {isMobile ? "Nueva" : "Nueva moneda"}
          </Button>
        </Stack>

        {/* ── Vista móvil: cards ──
            Las denominaciones ya no se despliegan/colapsan: se muestran
            como resumen de solo lectura ("N denominaciones") y se editan
            con la acción con nombre, que abre el mismo diálogo con
            confirmación que ya usa el desktop. */}
        {isMobile ? (
          <Stack spacing={1.5}>
            {monedas.map((m) => (
              <Box
                key={m.code}
                sx={{
                  bgcolor: "background.paper",
                  border: 1,
                  borderColor: "divider",
                  borderRadius: 3,
                  p: 2,
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                >
                  <Chip
                    label={m.code}
                    size="small"
                    sx={{
                      bgcolor: "semantic.hue.accent.surface",
                      color: "semantic.hue.accent.main",
                    }}
                  />
                  <Stack direction="row" alignItems="center" gap={0.5}>
                    <Switch
                      checked={m.activo}
                      onChange={() => toggleActivo(m)}
                    />
                    <Tooltip title="Editar moneda">
                      <IconButton onClick={() => openEdit(m)}>
                        <Edit fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1 }}
                >
                  {m.nombre} · {m.simbolo}
                </Typography>

                <Box
                  sx={{
                    mt: 1.5,
                    pt: 1.5,
                    borderTop: 1,
                    borderColor: "divider",
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {m.denominaciones.length === 1
                      ? "1 denominación"
                      : `${m.denominaciones.length} denominaciones`}
                  </Typography>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => openAddDenom(m.code)}
                    sx={{ mt: 0.5, px: 0 }}
                  >
                    Editar denominaciones
                  </Button>
                </Box>
              </Box>
            ))}
            {monedas.length === 0 && (
              <Alert severity="info">No hay monedas configuradas.</Alert>
            )}
          </Stack>
        ) : (
          /* ── Vista desktop: tabla ── */
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Código</TableCell>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Símbolo</TableCell>
                  <TableCell>Activa</TableCell>
                  <TableCell>Denominaciones</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {monedas.map((m) => (
                  <Fragment key={m.code}>
                    <TableRow>
                      <TableCell>
                        <Chip label={m.code} size="small" />
                      </TableCell>
                      <TableCell>{m.nombre}</TableCell>
                      <TableCell>{m.simbolo}</TableCell>
                      <TableCell>
                        <Switch
                          checked={m.activo}
                          onChange={() => toggleActivo(m)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" alignItems="center" gap={0.5}>
                          <Typography variant="body2">
                            {m.denominaciones.length} denominaciones
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={() => toggle(m.code)}
                          >
                            {expandedCode === m.code ? (
                              <ExpandLess fontSize="small" />
                            ) : (
                              <ExpandMore fontSize="small" />
                            )}
                          </IconButton>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Editar">
                          <IconButton size="small" onClick={() => openEdit(m)}>
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                    {expandedCode === m.code && (
                      <TableRow key={`${m.code}-denoms`}>
                        <TableCell
                          colSpan={6}
                          sx={{ bgcolor: "semantic.hue.accent.surface", py: 1 }}
                        >
                          <Stack
                            direction="row"
                            gap={1}
                            flexWrap="wrap"
                            alignItems="center"
                          >
                            {m.denominaciones.map((d) => (
                              <Chip key={d.id} label={d.valor} size="small" />
                            ))}
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<Edit />}
                              onClick={() => openAddDenom(m.code)}
                            >
                              Editar denominaciones
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
                {monedas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      No hay monedas configuradas
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </ContentCard>

      {/* Dialog moneda */}
      <Dialog
        open={openMonedaDialog}
        onClose={() => setOpenMonedaDialog(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>
          {editingMoneda ? "Editar moneda" : "Nueva moneda"}
        </DialogTitle>
        <DialogContent>
          <Stack gap={2} mt={1}>
            <TextField
              label="Código (ej. USD)"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              disabled={!!editingMoneda}
              inputProps={{ maxLength: 10 }}
              fullWidth
            />
            <TextField
              label="Nombre"
              value={newNombre}
              onChange={(e) => setNewNombre(e.target.value)}
              fullWidth
            />
            <TextField
              label="Símbolo"
              value={newSimbolo}
              onChange={(e) => setNewSimbolo(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMonedaDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={saveMoneda}
            disabled={savingMoneda}
          >
            {savingMoneda ? <CircularProgress size={20} /> : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog denominación */}
      <Dialog
        open={openDenomDialog}
        onClose={() => setOpenDenomDialog(false)}
        maxWidth="xs"
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Editar denominaciones — {denomMonedaCode}</DialogTitle>
        <DialogContent>
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
            {monedas
              .find((m) => m.code === denomMonedaCode)
              ?.denominaciones.map((d) => (
                <Chip
                  key={d.id}
                  label={d.valor}
                  size="small"
                  onDelete={() => handleRemoveDenom(denomMonedaCode, d)}
                />
              ))}
          </Stack>
          <TextField
            label="Nueva denominación"
            type="number"
            value={newDenomValor}
            onChange={(e) => setNewDenomValor(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDenomDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={saveDenom}
            disabled={savingDenom}
          >
            {savingDenom ? <CircularProgress size={20} /> : "Agregar"}
          </Button>
        </DialogActions>
      </Dialog>
      {ConfirmDialogComponent}
    </PageContainer>
  );
}
