"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Box,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import CloseIcon from "@mui/icons-material/Close";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import dayjs from "dayjs";
import PercentageField from "@/components/PercentageField";
import MoneyField from "@/components/MoneyField";
import useConfirmDialog from "@/components/confirmDialog";
import { DiscountRuleCard } from "./components/DiscountRuleCard";

type DiscountType = "PERCENTAGE" | "FIXED" | "PROMO_CODE";
type DiscountAppliesTo = "TICKET" | "PRODUCT" | "CATEGORY" | "CUSTOMER";

// Tipos estrictos para las condiciones soportadas
interface DiscountConditions {
  code?: string;
  minTotal?: number;
  productIds?: string[];
  categoryIds?: string[];
  customerIds?: string[];
}

interface DiscountRule {
  id: string;
  name: string;
  type: DiscountType;
  value: number;
  appliesTo: DiscountAppliesTo;
  conditions?: DiscountConditions;
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
  if (!res.ok)
    throw new Error((await res.json()).error || "Error creando regla");
  return res.json();
}

async function patchRule(id: string, data: Partial<DiscountRule>) {
  const res = await fetch("/api/discounts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...data }),
  });
  if (!res.ok)
    throw new Error((await res.json()).error || "Error actualizando regla");
  return res.json();
}

async function deleteRule(id: string) {
  const res = await fetch(`/api/discounts?id=${id}`, { method: "DELETE" });
  if (!res.ok)
    throw new Error((await res.json()).error || "Error eliminando regla");
}

export default function DiscountsPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "PERCENTAGE" as DiscountType,
    value: 10 as string | number,
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
  const [options, setOptions] = useState<DiscountOptions>({
    products: [],
    categories: [],
  });
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
      const payload: Partial<DiscountRule> & {
        conditions: DiscountConditions;
        startDate?: string;
        endDate?: string;
      } = {
        name: form.name,
        type: form.type,
        value: Number(form.value),
        appliesTo: form.appliesTo,
        isActive: form.isActive,
        conditions: {
          ...(form.code ? { code: form.code } : {}),
          ...(form.minTotal ? { minTotal: Number(form.minTotal) } : {}),
          ...(form.appliesTo === "PRODUCT" && form.productIds.length > 0
            ? { productIds: form.productIds }
            : {}),
          ...(form.appliesTo === "CATEGORY" && form.categoryIds.length > 0
            ? { categoryIds: form.categoryIds }
            : {}),
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
    } catch (e: unknown) {
      if (e instanceof Error) {
        console.error(e);
        alert(e.message || "Error creando regla");
      } else {
        console.error(e);
        alert("Error creando regla");
      }
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

  const remove = async (rule: DiscountRule) => {
    confirmDialog(
      `¿Eliminar la regla "${rule.name}"? Esta acción no se puede deshacer.`,
      async () => {
        try {
          await deleteRule(rule.id);
          await load();
        } catch (e) {
          console.error(e);
          alert("No se pudo eliminar");
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const handleOpenNewRule = async () => {
    setOpenDialog(true);
    try {
      setLoadingOptions(true);
      const res = await fetch("/api/discounts/options");
      if (res.ok) {
        const data = await res.json();
        setOptions(data);
      }
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleOpenEditRule = async (rule: DiscountRule) => {
    setEditingId(rule.id);
    const cond: DiscountConditions =
      (rule.conditions as DiscountConditions) || {};
    setForm({
      name: rule.name,
      type: rule.type,
      value: rule.value,
      appliesTo: rule.appliesTo,
      code: cond.code || "",
      minTotal: cond.minTotal?.toString?.() || "",
      startDate: rule.startDate
        ? dayjs(rule.startDate).format("YYYY-MM-DD")
        : "",
      endDate: rule.endDate ? dayjs(rule.endDate).format("YYYY-MM-DD") : "",
      isActive: rule.isActive,
      productIds: cond.productIds || [],
      categoryIds: cond.categoryIds || [],
    });
    try {
      setLoadingOptions(true);
      const res = await fetch("/api/discounts/options");
      if (res.ok) setOptions(await res.json());
    } finally {
      setLoadingOptions(false);
    }
    setOpenDialog(true);
  };

  const headerActions = !isMobile ? (
    <Button
      variant="contained"
      startIcon={<AddIcon />}
      onClick={handleOpenNewRule}
    >
      Nueva Regla
    </Button>
  ) : undefined;

  return (
    <PageContainer
      title="Descuentos"
      subtitle="Reglas de descuento aplicables en el punto de venta"
      headerActions={headerActions}
    >
      {isMobile && (
        <Box sx={{ mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenNewRule}
            fullWidth
          >
            Nueva Regla
          </Button>
        </Box>
      )}

      {isMobile ? (
        <Stack spacing={1.5}>
          {loading ? (
            <LoadingState variant="list" count={3} />
          ) : rules.length === 0 ? (
            <EmptyState
              title="Todavía no hay reglas de descuento"
              description="Creá una regla para aplicar descuentos automáticos por producto, categoría o monto en el punto de venta."
              icon={
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: "#F4F2FB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "inherit",
                    color: "#5B4CA8",
                  }}
                >
                  <LocalOfferIcon sx={{ fontSize: "inherit" }} />
                </Box>
              }
            />
          ) : (
            rules.map((r) => (
              <DiscountRuleCard
                key={r.id}
                rule={r}
                onEdit={handleOpenEditRule}
                onDelete={remove}
                onToggleActive={toggleActive}
                isMobile={true}
              />
            ))
          )}
        </Stack>
      ) : (
        <ContentCard title="Descuentos">
          {loading ? (
            <LoadingState variant="list" count={3} />
          ) : rules.length === 0 ? (
            <EmptyState
              title="Todavía no hay reglas de descuento"
              description="Creá una regla para aplicar descuentos automáticos por producto, categoría o monto en el punto de venta."
              icon={
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    backgroundColor: "#F4F2FB",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "inherit",
                    color: "#5B4CA8",
                  }}
                >
                  <LocalOfferIcon sx={{ fontSize: "inherit" }} />
                </Box>
              }
            />
          ) : (
            <Grid container spacing={2}>
              {rules.map((r) => (
                <DiscountRuleCard
                  key={r.id}
                  rule={r}
                  onEdit={handleOpenEditRule}
                  onDelete={remove}
                  onToggleActive={toggleActive}
                />
              ))}
            </Grid>
          )}
        </ContentCard>
      )}

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {editingId ? "Editar Regla de Descuento" : "Nueva Regla de Descuento"}
          {isMobile && (
            <IconButton onClick={() => setOpenDialog(false)}>
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          <Grid container mt={1} spacing={3}>
            <Grid item xs={12}>
              <TextField
                label="Nombre"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                fullWidth
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo</InputLabel>
                <Select
                  label="Tipo"
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as DiscountType,
                    }))
                  }
                >
                  <MenuItem value="PERCENTAGE">Porcentaje</MenuItem>
                  <MenuItem value="FIXED">Monto fijo</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              {form.type === "PERCENTAGE" ? (
                <PercentageField
                  label="Porcentaje"
                  value={form.value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: e.target.value }))
                  }
                  fullWidth
                  size="small"
                />
              ) : (
                <MoneyField
                  label="Monto"
                  value={form.value}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, value: e.target.value }))
                  }
                  fullWidth
                  size="small"
                />
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Ámbito</InputLabel>
                <Select
                  label="Ámbito"
                  value={form.appliesTo}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      appliesTo: e.target.value as DiscountAppliesTo,
                    }))
                  }
                >
                  <MenuItem value="TICKET">Ticket</MenuItem>
                  <MenuItem value="PRODUCT">Producto</MenuItem>
                  <MenuItem value="CATEGORY">Categoría</MenuItem>
                  <MenuItem value="CUSTOMER">Cliente</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Código promocional (opcional)"
                value={form.code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, code: e.target.value }))
                }
                fullWidth
                size="small"
              />
            </Grid>

            {/* Selección de Productos/Categorías según ámbito */}
            {form.appliesTo === "PRODUCT" && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel id="product-select-label">Productos</InputLabel>
                  <Select
                    labelId="product-select-label"
                    multiple
                    value={form.productIds}
                    label="Productos"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        productIds: e.target.value as string[],
                      }))
                    }
                    disabled={loadingOptions}
                    renderValue={(selected) =>
                      (selected as string[])
                        .map(
                          (id) =>
                            options.products.find((p) => p.id === id)?.nombre ||
                            id,
                        )
                        .join(", ")
                    }
                  >
                    {loadingOptions && (
                      <MenuItem disabled value="__loading__">
                        Cargando opciones…
                      </MenuItem>
                    )}
                    {options.products.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {loadingOptions && (
                  <Typography variant="caption" color="text.secondary">
                    Cargando opciones de productos…
                  </Typography>
                )}
              </Grid>
            )}
            {form.appliesTo === "CATEGORY" && (
              <Grid item xs={12}>
                <FormControl fullWidth size="small">
                  <InputLabel id="category-select-label">Categorías</InputLabel>
                  <Select
                    labelId="category-select-label"
                    multiple
                    value={form.categoryIds}
                    label="Categorías"
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        categoryIds: e.target.value as string[],
                      }))
                    }
                    disabled={loadingOptions}
                    renderValue={(selected) =>
                      (selected as string[])
                        .map(
                          (id) =>
                            options.categories.find((c) => c.id === id)
                              ?.nombre || id,
                        )
                        .join(", ")
                    }
                  >
                    {loadingOptions && (
                      <MenuItem disabled value="__loading__">
                        Cargando opciones…
                      </MenuItem>
                    )}
                    {options.categories.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.nombre}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {loadingOptions && (
                  <Typography variant="caption" color="text.secondary">
                    Cargando opciones de categorías…
                  </Typography>
                )}
              </Grid>
            )}

            <Grid item xs={12} sm={6}>
              <TextField
                label="Inicio"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value }))
                }
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fin"
                type="date"
                value={form.endDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, endDate: e.target.value }))
                }
                fullWidth
                size="small"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Monto mínimo (opcional)"
                type="number"
                value={form.minTotal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minTotal: e.target.value }))
                }
                fullWidth
                size="small"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isActive: e.target.checked }))
                    }
                    color="primary"
                  />
                }
                label={form.isActive ? "Activo" : "Inactivo"}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions
          sx={{
            flexDirection: isMobile ? "column-reverse" : "row",
            alignItems: "stretch",
          }}
        >
          <Button
            onClick={() => setOpenDialog(false)}
            fullWidth={isMobile}
            sx={{ minHeight: isMobile ? 44 : undefined }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            variant="contained"
            disabled={
              saving ||
              !form.name ||
              (loadingOptions &&
                (form.appliesTo === "PRODUCT" || form.appliesTo === "CATEGORY"))
            }
            fullWidth={isMobile}
            size={isMobile ? "large" : "medium"}
            sx={{ minHeight: isMobile ? 56 : undefined }}
          >
            {editingId ? "Actualizar" : "Guardar"}
          </Button>
        </DialogActions>
      </Dialog>

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
