"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LinkIcon from "@mui/icons-material/Link";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";
import { usePermisos } from "@/utils/permisos_front";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import useConfirmDialog from "@/components/confirmDialog";
import {
  IGastoTienda,
  IGastoPlantilla,
  ICreateGastoTienda,
  ICreateGastoPlantilla,
  IAssignPlantilla,
} from "@/schemas/gastos";
import {
  getGastosTienda,
  createGastoTienda,
  updateGastoTienda,
  deleteGastoTienda,
  assignPlantilla,
  getPlantillas,
} from "@/services/gastoService";
import GastoTiendaTable from "./components/GastoTiendaTable";
import GastoTiendaCard from "./components/GastoTiendaCard";
import GastoFormDialog from "./components/GastoFormDialog";
import AssignPlantillaDialog from "./components/AssignPlantillaDialog";

export default function GastosPage() {
  const { user, loadingContext } = useAppContext();
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { verificarPermiso } = usePermisos();

  const canView = verificarPermiso("operaciones.gastos.ver");
  const canManage = verificarPermiso("operaciones.gastos.gestionar");

  const [gastos, setGastos] = useState<IGastoTienda[]>([]);
  const [plantillas, setPlantillas] = useState<IGastoPlantilla[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<IGastoTienda | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  const { confirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  const tiendaId = user?.localActual?.id ?? "";

  const categoriasExistentes = [...new Set(gastos.map((g) => g.categoria))];

  const loadGastos = useCallback(async () => {
    if (!tiendaId) return;
    setLoading(true);
    try {
      const data = await getGastosTienda(tiendaId);
      setGastos(data);
    } catch {
      showMessage("Error al cargar gastos", "error");
    } finally {
      setLoading(false);
    }
  }, [tiendaId, showMessage]);

  const loadPlantillas = useCallback(async () => {
    try {
      const data = await getPlantillas();
      setPlantillas(data);
    } catch {
      // silencioso, solo necesitamos plantillas para asignar
    }
  }, []);

  useEffect(() => {
    if (!loadingContext && canView) {
      loadGastos();
      loadPlantillas();
    }
  }, [loadingContext, canView, loadGastos, loadPlantillas]);

  const handleSaveGasto = async (data: ICreateGastoTienda | ICreateGastoPlantilla) => {
    try {
      if (editTarget) {
        await updateGastoTienda(tiendaId, editTarget.id, data as ICreateGastoTienda);
        showMessage("Gasto actualizado", "success");
      } else {
        await createGastoTienda(tiendaId, data as ICreateGastoTienda);
        showMessage("Gasto creado", "success");
      }
      await loadGastos();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showMessage(msg ?? "Error al guardar gasto", "error");
      throw err;
    }
  };

  const handleToggleActivo = async (gasto: IGastoTienda) => {
    try {
      await updateGastoTienda(tiendaId, gasto.id, { activo: !gasto.activo });
      await loadGastos();
    } catch {
      showMessage("Error al actualizar estado", "error");
    }
  };

  const handleDelete = (gasto: IGastoTienda) => {
    confirmDialog(
      `¿Eliminar el gasto "${gasto.nombre}"? Si tiene historial en cierres anteriores, se desactivará en lugar de eliminarse.`,
      async () => {
        try {
          await deleteGastoTienda(tiendaId, gasto.id);
          showMessage("Gasto eliminado", "success");
          await loadGastos();
        } catch (err: unknown) {
          const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
          showMessage(msg ?? "Error al eliminar gasto", "error");
        }
      }
    );
  };

  const handleAssign = async (data: IAssignPlantilla) => {
    try {
      await assignPlantilla(tiendaId, data);
      showMessage("Plantilla asignada", "success");
      await loadGastos();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      showMessage(msg ?? "Error al asignar plantilla", "error");
      throw err;
    }
  };

  if (!loadingContext && !canView) {
    return (
      <PageContainer title="Gastos">
        <Alert severity="error">No tienes permisos para ver esta sección.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Gastos">
      <ContentCard
        title="Gastos de la tienda"
        subtitle="Gastos recurrentes y configuraciones aplicadas a los cierres de período"
        headerActions={
          canManage ? (
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                startIcon={<LinkIcon />}
                variant="outlined"
                size="small"
                onClick={() => setAssignOpen(true)}
              >
                Asignar plantilla
              </Button>
              <Button
                startIcon={<AddIcon />}
                variant="contained"
                size="small"
                onClick={() => {
                  setEditTarget(null);
                  setFormOpen(true);
                }}
              >
                Nuevo gasto
              </Button>
            </Stack>
          ) : undefined
        }
      >
        {loading ? (
          <Box py={4} textAlign="center">
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            {isMobile ? (
              <Stack spacing={1.5} sx={{ p: 0.5 }}>
                {gastos.length === 0 ? (
                  <Box py={4} textAlign="center">
                    <ReceiptLongIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
                    <Typography color="text.secondary">No hay gastos configurados</Typography>
                    {canManage && (
                      <Typography variant="caption" color="text.secondary">
                        Crea un gasto con el botón &quot;Nuevo gasto&quot; o asigna una plantilla del negocio.
                      </Typography>
                    )}
                  </Box>
                ) : (
                  gastos.map((g) => (
                    <GastoTiendaCard
                      key={g.id}
                      gasto={g}
                      canManage={canManage}
                      onEdit={(gasto) => {
                        setEditTarget(gasto);
                        setFormOpen(true);
                      }}
                      onDelete={handleDelete}
                      onToggleActivo={handleToggleActivo}
                    />
                  ))
                )}
              </Stack>
            ) : (
              <GastoTiendaTable
                gastos={gastos}
                canManage={canManage}
                onEdit={(gasto) => {
                  setEditTarget(gasto);
                  setFormOpen(true);
                }}
                onDelete={handleDelete}
                onToggleActivo={handleToggleActivo}
              />
            )}
          </>
        )}
      </ContentCard>

      <GastoFormDialog
        open={formOpen}
        mode="tienda"
        initial={editTarget}
        categoriasExistentes={categoriasExistentes}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSave={handleSaveGasto}
      />

      <AssignPlantillaDialog
        open={assignOpen}
        plantillas={plantillas}
        onClose={() => setAssignOpen(false)}
        onAssign={handleAssign}
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
