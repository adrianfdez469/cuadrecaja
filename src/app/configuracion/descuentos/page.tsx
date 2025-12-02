"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/EditOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import CloseIcon from "@mui/icons-material/CloseOutlined";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import dayjs from "dayjs";

type DiscountType = "PERCENTAGE" | "FIXED" | "PROMO_CODE";
type DiscountAppliesTo = "TICKET" | "PRODUCT" | "CATEGORY" | "CUSTOMER";

interface DiscountRule {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  appliesTo: DiscountAppliesTo;
  conditions?: any;
  startDate?: string | null;
  endDate?: string | null;
  isActive: boolean;
  createdAt?: string;
}

interface DiscountOptions {
  products: { id: string; nombre: string }[];
  categories: { id: string; nombre: string }[];
}

async function fetchRules(): Promise<DiscountRule[]> {
  const res = await fetch("/api/discounts", { cache: "no-store" });
  if (!res.ok) throw new Error("Error cargando reglas");
  return res.json();
}

async function createRule(data: Partial<DiscountRule>) {
  const res = await fetch("/api/discounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Error creando regla");
  return res.json();
}

async function patchRule(id: string, data: Partial<DiscountRule>) {
  const res = await fetch("/api/discounts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Error actualizando regla");
  return res.json();
}

async function deleteRule(id: string) {
  const res = await fetch(`/api/discounts?id=${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error((await res.json()).error || "Error eliminando regla");
}

export default function DiscountsPage() {
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "PERCENTAGE" as DiscountType,
    value: 10,
    appliesTo: "TICKET" as DiscountAppliesTo,
    code: "",
    minTotal: "",
    startDate: "",
    endDate: "",
    isActive: true,
    // selección específica según ámbito
    productIds: [] as string[],
    categoryIds: [] as string[],
  });
  const [options, setOptions] = useState<DiscountOptions>({ products: [], categories: [] });
  const [loadingOptions, setLoadingOptions] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchRules();
      setRules(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setForm({
      name: "",
      type: "PERCENTAGE",
      value: 10,
      appliesTo: "TICKET",
      code: "",
      minTotal: "",
      startDate: "",
      endDate: "",
      isActive: true,
      productIds: [],
      categoryIds: [],
    });
    setEditingId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        value: Number(form.value),
        appliesTo: form.appliesTo,
        isActive: form.isActive,
        conditions: {
          ...(form.code ? { code: form.code } : {}),
          ...(form.minTotal ? { minTotal: Number(form.minTotal) } : {}),
          ...(form.appliesTo === 'PRODUCT' && form.productIds.length > 0 ? { productIds: form.productIds } : {}),
          ...(form.appliesTo === 'CATEGORY' && form.categoryIds.length > 0 ? { categoryIds: form.categoryIds } : {}),
        },
      };
      if (form.startDate) payload.startDate = form.startDate;
      if (form.endDate) payload.endDate = form.endDate;
      if (editingId) {
        await patchRule(editingId, payload);
      } else {
        await createRule(payload);
      }
      setOpenDialog(false);
      resetForm();
      await load();
    } catch (e) {
      console.error(e);
      alert((e as any)?.message || "Error creando regla");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: DiscountRule) => {
    try {
      await patchRule(rule.id, { isActive: !rule.isActive });
      await load();
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el estado");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar esta regla?")) return;
    try {
      await deleteRule(id);
      await load();
    } catch (e) {
      console.error(e);
      alert("No se pudo eliminar");
    }
  };

  return (
    <Box p={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
        <Stack direction="row" spacing={1} alignItems="center">
          <LocalOfferIcon />
          <Typography variant="h5">Descuentos</Typography>
        </Stack>
        <Button variant="contained" startIcon={<AddIcon />} onClick={async () => {
          // cargar opciones al abrir
          setOpenDialog(true);
          try {
            setLoadingOptions(true);
            const res = await fetch('/api/discounts/options');
            if (res.ok) {
              const data = await res.json();
              setOptions(data);
            }
          } finally {
            setLoadingOptions(false);
          }
        }}>
          Nueva Regla
        </Button>
      </Stack>

      <Card>
        <CardContent>
          {loading ? (
            <Typography>Cargando…</Typography>
          ) : rules.length === 0 ? (
            <Typography>No hay reglas de descuento aún.</Typography>
          ) : (
            <Grid container spacing={2}>
              {rules.map((r) => {
                const conditions = r.conditions || {};
                return (
                  <Grid item xs={12} md={6} lg={4} key={r.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Stack direction="row" justifyContent="space-between" alignItems="start" mb={1}>
                          <Typography variant="h6">{r.name}</Typography>
                          <Stack direction="row" spacing={1}>
                            <IconButton onClick={() => toggleActive(r)} size="small" title={r.isActive ? "Desactivar" : "Activar"}>
                              {r.isActive ? <CheckIcon color="success" /> : <CloseIcon color="error" />}
                            </IconButton>
                            <IconButton
                              onClick={async () => {
                                // Preparar edición
                                setEditingId(r.id);
                                const cond: any = r.conditions || {};
                                setForm({
                                  name: r.name,
                                  type: r.type,
                                  value: r.value,
                                  appliesTo: r.appliesTo,
                                  code: cond.code || "",
                                  minTotal: cond.minTotal?.toString?.() || "",
                                  startDate: r.startDate ? dayjs(r.startDate).format("YYYY-MM-DD") : "",
                                  endDate: r.endDate ? dayjs(r.endDate).format("YYYY-MM-DD") : "",
                                  isActive: r.isActive,
                                  productIds: cond.productIds || [],
                                  categoryIds: cond.categoryIds || [],
                                });
                                // cargar opciones para edición
                                try {
                                  setLoadingOptions(true);
                                  const res = await fetch('/api/discounts/options');
                                  if (res.ok) setOptions(await res.json());
                                } finally {
                                  setLoadingOptions(false);
                                }
                                setOpenDialog(true);
                              }}
                              size="small"
                              title="Editar"
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton onClick={() => remove(r.id)} size="small" color="error" title="Eliminar">
                              <DeleteIcon />
                            </IconButton>
                          </Stack>
                        </Stack>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Tipo: {r.type} · Ámbito: {r.appliesTo}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          Valor: {r.type === "PERCENTAGE" ? `${r.value}%` : `${r.value}`}
                        </Typography>
                        {(conditions?.code || conditions?.minTotal) && (
                          <Typography variant="body2" color="text.secondary">
                            Condiciones: {conditions?.code ? `código "${conditions.code}"` : ""}
                            {conditions?.code && conditions?.minTotal ? " · " : ""}
                            {conditions?.minTotal ? `mínimo ${conditions.minTotal}` : ""}
                          </Typography>
                        )}
                        <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                          Vigencia: {r.startDate ? dayjs(r.startDate).format("YYYY-MM-DD") : "—"} a {r.endDate ? dayjs(r.endDate).format("YYYY-MM-DD") : "—"}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingId ? "Editar Regla de Descuento" : "Nueva Regla de Descuento"}</DialogTitle>
        <DialogContent>
          <Stack mt={1} spacing={2}>
            <TextField
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Tipo</InputLabel>
                  <Select
                    label="Tipo"
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as DiscountType }))}
                  >
                    <MenuItem value="PERCENTAGE">Porcentaje</MenuItem>
                    <MenuItem value="FIXED">Monto fijo</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label={form.type === "PERCENTAGE" ? "Porcentaje (%)" : "Monto"}
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Ámbito</InputLabel>
                  <Select
                    label="Ámbito"
                    value={form.appliesTo}
                    onChange={(e) => setForm((f) => ({ ...f, appliesTo: e.target.value as DiscountAppliesTo }))}
                  >
                    <MenuItem value="TICKET">Ticket</MenuItem>
                    <MenuItem value="PRODUCT">Producto</MenuItem>
                    <MenuItem value="CATEGORY">Categoría</MenuItem>
                    <MenuItem value="CUSTOMER">Cliente</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <Typography>Inactivo</Typography>
                  <Switch
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <Typography>Activo</Typography>
                </Stack>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Código promocional (opcional)"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Monto mínimo (opcional)"
                  type="number"
                  value={form.minTotal}
                  onChange={(e) => setForm((f) => ({ ...f, minTotal: e.target.value }))}
                  fullWidth
                />
              </Grid>
              {/* Selección de Productos/Categorías según ámbito */}
              {form.appliesTo === 'PRODUCT' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel id="product-select-label">Productos</InputLabel>
                    <Select
                      labelId="product-select-label"
                      multiple
                      value={form.productIds}
                      label="Productos"
                      onChange={(e) => setForm((f) => ({ ...f, productIds: (e.target.value as string[]) }))}
                      renderValue={(selected) => (selected as string[]).map(id => options.products.find(p => p.id === id)?.nombre || id).join(', ')}
                    >
                      {options.products.map((p) => (
                        <MenuItem key={p.id} value={p.id}>{p.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              {form.appliesTo === 'CATEGORY' && (
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel id="category-select-label">Categorías</InputLabel>
                    <Select
                      labelId="category-select-label"
                      multiple
                      value={form.categoryIds}
                      label="Categorías"
                      onChange={(e) => setForm((f) => ({ ...f, categoryIds: (e.target.value as string[]) }))}
                      renderValue={(selected) => (selected as string[]).map(id => options.categories.find(c => c.id === id)?.nombre || id).join(', ')}
                    >
                      {options.categories.map((c) => (
                        <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Inicio"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Fin"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving || !form.name}>
            {editingId ? "Actualizar" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
