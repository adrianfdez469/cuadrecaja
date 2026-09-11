"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  IconButton,
  Stack,
  Tooltip,
} from "@mui/material";
import { useMediaQuery, useTheme } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import { PageContainer } from "@/components/PageContainer";
import { ContentCard } from "@/components/ContentCard";
import { StatStrip } from "@/components/StatStrip";
import { EmptyState } from "@/components/EmptyState";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { ActionSheet } from "@/components/ActionSheet";
import useConfirmDialog from "@/components/confirmDialog";
import { useMessageContext } from "@/context/MessageContext";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { usePermisos } from "@/utils/permisos_front";
import { touch } from "@/theme";
import {
  CLIENTES_COPY,
  CLIENTES_DOM,
  CLIENTES_LIST_LIMIT,
  CLIENTES_PERMISO_CONFIGURACION,
  CLIENTE_SELECTOR_MAX_WIDTH,
} from "@/constants/clientes";
import {
  clienteDeactivateQuestion,
  clienteListSubtitle,
} from "@/lib/clientes/clienteCopy";
import { useClientesStore } from "@/store/clientesStore";
import {
  createCliente,
  deleteCliente,
  getClienteById,
  getClientes,
  updateCliente,
} from "@/services/clienteService";
import { ClienteAutocomplete } from "@/components/clientes/ClienteAutocomplete";
import { ClienteFormDialog } from "@/components/clientes/ClienteFormDialog";
import { ClienteSheet } from "@/components/clientes/ClienteSheet";
import { ClientesMobileList } from "@/components/clientes/ClientesMobileList";
import { ClientesTable } from "@/components/clientes/ClientesTable";
import type { ICreateCliente } from "@/schemas/cliente";
import type {
  IClienteConSaldo,
  IClienteOption,
} from "@/schemas/clienteSaldo";

/** The message an Axios rejection carries in its body, when it carries one. */
function serverErrorMessage(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: unknown } } })?.response
    ?.data;
  return typeof data?.error === "string" && data.error !== ""
    ? data.error
    : null;
}

/**
 * `/configuracion/clientes` — the CRUD, and the screen where BOTH selection surfaces are
 * mounted and verified (ADR 0113). The recovery panel of who owes what is `/cuentas-por-cobrar`
 * and belongs to F-035: this screen never says «por cobrar».
 *
 * It consumes `clienteService` directly for its table, because it needs `descripcion` and
 * `direccion` to edit and the selector never needs them. It does not use `useClienteSearch`
 * for that.
 */
export default function ClientesConfiguracionPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const { showMessage } = useMessageContext();
  const { ConfirmDialogComponent, confirmDialog } = useConfirmDialog();
  const { isOnline } = useNetworkStatus();
  const { verificarPermiso } = usePermisos();
  const forgetCliente = useClientesStore((state) => state.forget);

  const canWrite = verificarPermiso(CLIENTES_PERMISO_CONFIGURACION);

  const [clientes, setClientes] = useState<IClienteConSaldo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const [selected, setSelected] = useState<IClienteOption | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<IClienteConSaldo | null>(
    null,
  );
  const [selectedLoading, setSelectedLoading] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<IClienteConSaldo | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionsFor, setActionsFor] = useState<IClienteConSaldo | null>(null);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getClientes({ limit: CLIENTES_LIST_LIMIT });
      setClientes(rows);
      setLoadFailed(false);
    } catch {
      // Fixed copy only: an exception message quotes the data that broke it (E-031).
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // A cliente picked in either surface may be outside the first page of the list — the
  // selector searches the server and can find the 700th of a business with more than
  // CLIENTES_LIST_LIMIT. Without this, picking them would leave the list empty with no
  // explanation. It is the only place F-033 exercises GET /api/clientes/[id].
  useEffect(() => {
    if (!selected) {
      setSelectedDetail(null);
      setSelectedLoading(false);
      return;
    }
    if (clientes.some((cliente) => cliente.id === selected.id)) {
      setSelectedDetail(null);
      setSelectedLoading(false);
      return;
    }

    let cancelled = false;
    setSelectedLoading(true);
    getClienteById(selected.id)
      .then((cliente) => {
        if (!cancelled) setSelectedDetail(cliente);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetail(null);
      })
      .finally(() => {
        if (!cancelled) setSelectedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, clientes]);

  const visibles = useMemo(() => {
    if (!selected) return clientes;
    const inList = clientes.find((cliente) => cliente.id === selected.id);
    if (inList) return [inList];
    return selectedDetail ? [selectedDetail] : [];
  }, [selected, clientes, selectedDetail]);

  const conSaldo = clientes.filter((cliente) => cliente.saldo > 0).length;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (cliente: IClienteConSaldo) => {
    setEditing(cliente);
    setFormOpen(true);
  };

  const submitForm = async (values: ICreateCliente) => {
    setSaving(true);
    try {
      if (editing) {
        await updateCliente(editing.id, values);
        showMessage(CLIENTES_COPY.actualizado, "success");
      } else {
        const response = await createCliente(values);
        // The screen says «created» or «reactivated» because the POST SAYS which one it was;
        // it is never inferred from `deletedAt` having become null (E-013).
        showMessage(
          response.action === "REACTIVATE"
            ? CLIENTES_COPY.reactivado
            : CLIENTES_COPY.creado,
          "success",
        );
      }
      setFormOpen(false);
      setEditing(null);
      await fetchClientes();
    } catch (error) {
      showMessage(
        serverErrorMessage(error) ?? CLIENTES_COPY.errorTitulo,
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const deactivate = (cliente: IClienteConSaldo) => {
    confirmDialog(
      clienteDeactivateQuestion(cliente.nombre),
      async () => {
        try {
          await deleteCliente(cliente.id);
          forgetCliente(cliente.id);
          if (selected?.id === cliente.id) setSelected(null);
          showMessage(CLIENTES_COPY.desactivado, "success");
          await fetchClientes();
        } catch (error) {
          // The 409 reaches the screen intact — the axios interceptor only rewrites 403s —
          // and it is shown VERBATIM: reformatting the figure would be a second rendering of
          // the same number (E-030).
          showMessage(
            serverErrorMessage(error) ?? CLIENTES_COPY.errorTitulo,
            "error",
          );
        }
      },
      undefined,
      { severity: "error" },
    );
  };

  const headerActions = (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {!isMobile && canWrite && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
        >
          {CLIENTES_COPY.nuevoCliente}
        </Button>
      )}
      <Tooltip title={CLIENTES_COPY.recargar}>
        <IconButton
          aria-label={CLIENTES_COPY.recargar}
          onClick={fetchClientes}
          disabled={loading}
        >
          <RefreshIcon />
        </IconButton>
      </Tooltip>
    </Stack>
  );

  const renderList = () => {
    if (loading || selectedLoading) {
      return (
        <Box sx={{ p: isMobile ? 1.5 : 3 }}>
          <LoadingState
            variant={isMobile ? "list" : "table"}
            count={selectedLoading ? 1 : 6}
            columns={4}
          />
        </Box>
      );
    }

    if (loadFailed) {
      // Without a connection this screen cannot list: the full list is the server's. The
      // selector, which reads the cache, stays mounted and usable above it.
      return isOnline ? (
        <ErrorState
          kind="error"
          title={CLIENTES_COPY.errorTitulo}
          description={CLIENTES_COPY.errorDescripcion}
          onRetry={fetchClientes}
        />
      ) : (
        <ErrorState
          kind="offline"
          description={CLIENTES_COPY.listaSinConexion}
          onRetry={fetchClientes}
        />
      );
    }

    if (visibles.length === 0) {
      return selected ? (
        <EmptyState
          variant="no-results"
          size="compact"
          title={CLIENTES_COPY.sinResultadosTitulo}
          description={CLIENTES_COPY.sinResultadosDescripcion}
          action={{
            label: CLIENTES_COPY.verTodos,
            onClick: () => setSelected(null),
          }}
        />
      ) : (
        <EmptyState
          variant="empty"
          size="compact"
          title={CLIENTES_COPY.vacioTitulo}
          description={CLIENTES_COPY.vacioDescripcion}
          action={
            canWrite
              ? { label: CLIENTES_COPY.nuevoCliente, onClick: openCreate }
              : undefined
          }
        />
      );
    }

    return isMobile ? (
      <ClientesMobileList
        clientes={visibles}
        onOpenActions={canWrite ? setActionsFor : undefined}
      />
    ) : (
      <ClientesTable
        clientes={visibles}
        onEdit={canWrite ? openEdit : undefined}
        onDeactivate={canWrite ? deactivate : undefined}
      />
    );
  };

  return (
    <PageContainer
      title={CLIENTES_COPY.pageTitle}
      subtitle={CLIENTES_COPY.pageSubtitle}
      breadcrumbs={[
        { label: CLIENTES_COPY.breadcrumbInicio, href: "/home" },
        { label: CLIENTES_COPY.breadcrumbConfiguracion, href: "/configuracion" },
        { label: CLIENTES_COPY.pageTitle },
      ]}
      headerActions={headerActions}
    >
      {isMobile && canWrite && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          fullWidth
          onClick={openCreate}
          sx={{ minHeight: touch.comfortable, mb: 2 }}
        >
          {CLIENTES_COPY.nuevoCliente}
        </Button>
      )}

      {/* Rendered only from 600px up, never merely hidden: `textContent` reads through
          `display: none`. Below that the two figures travel in the card's subtitle. */}
      {!isMobile && (
        <StatStrip
          variant="card"
          stats={[
            { label: CLIENTES_COPY.statTotal, value: clientes.length },
            {
              label: CLIENTES_COPY.statConSaldo,
              value: conSaldo,
              ...(conSaldo > 0 && { tone: "negative" as const }),
            },
          ]}
        />
      )}

      <Box
        component="section"
        aria-label={CLIENTES_COPY.seccionEtiqueta}
        className={CLIENTES_DOM.section}
      >
        <Box
          className={CLIENTES_DOM.selector}
          sx={{ mb: 2, maxWidth: { sm: CLIENTE_SELECTOR_MAX_WIDTH } }}
        >
          {isMobile ? (
            <ButtonBase
              className={CLIENTES_DOM.searchTrigger}
              onClick={() => setSheetOpen(true)}
              sx={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-start",
                gap: 1.25,
                minHeight: touch.comfortable,
                px: 1.75,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "semantic.surface.border",
                bgcolor: "semantic.surface.raised",
                color: "semantic.text.secondary",
                fontSize: "0.9375rem",
                textAlign: "left",
              }}
            >
              <SearchIcon fontSize="small" />
              {selected ? selected.nombre : CLIENTES_COPY.selectorBuscarAbrir}
            </ButtonBase>
          ) : (
            <ClienteAutocomplete value={selected} onChange={setSelected} />
          )}

          {selected && (
            <Button
              variant="text"
              onClick={() => setSelected(null)}
              sx={{ mt: 1, minHeight: touch.min }}
            >
              {CLIENTES_COPY.verTodos}
            </Button>
          )}
        </Box>

        <ContentCard
          title={CLIENTES_COPY.listaTitulo}
          subtitle={clienteListSubtitle({
            total: clientes.length,
            conSaldo,
            withSaldo: isMobile,
          })}
          noPadding
        >
          {renderList()}
        </ContentCard>
      </Box>

      {isMobile && (
        <ClienteSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          selectedId={selected?.id ?? null}
          onSelect={(cliente) => {
            setSelected(cliente);
            // A row the sheet just created is not in the list yet.
            fetchClientes();
          }}
        />
      )}

      {canWrite && (
        <ClienteFormDialog
          open={formOpen}
          cliente={editing}
          saving={saving}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSubmit={submitForm}
        />
      )}

      <ActionSheet
        open={actionsFor !== null}
        onClose={() => setActionsFor(null)}
        title={actionsFor?.nombre ?? ""}
        items={
          actionsFor
            ? [
                {
                  key: "edit",
                  icon: <EditIcon />,
                  label: CLIENTES_COPY.editarCliente,
                  onClick: () => openEdit(actionsFor),
                },
                {
                  key: "deactivate",
                  icon: <DeleteIcon />,
                  label: CLIENTES_COPY.desactivarCliente,
                  danger: true,
                  onClick: () => deactivate(actionsFor),
                },
              ]
            : []
        }
      />

      {ConfirmDialogComponent}
    </PageContainer>
  );
}
