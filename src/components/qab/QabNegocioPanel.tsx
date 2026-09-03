"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  LinearProgress,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { AppDialog } from "@/components/AppDialog";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { SectionLabel } from "@/components/SectionLabel";
import { StatusPill } from "@/components/StatusPill";
import { QabProvisioningNotice } from "@/components/qab/QabProvisioningNotice";
import type { QabNoticeOutcome } from "@/components/qab/QabProvisioningNotice";
import { QabTokenRescueDisclosure } from "@/components/qab/QabTokenRescueDisclosure";
import { resolveQabSyncState } from "@/components/qab/qabSyncState";
import { useMessageContext } from "@/context/MessageContext";
import {
  QabProvisioningError,
  isQabNetworkFailure,
} from "@/services/qabNegocioService";
import type {
  INegocioQabSettingsItem,
  IQabAutoProvisioningUnavailableReason,
} from "@/schemas/qabNegocio";
import type { INegocioQabProvisioningResult } from "@/schemas/qabProvisioning";
import { touch } from "@/theme/tokens";
import { formatDateTime, getRelativeDate } from "@/utils/formatters";

export type QabNegocioPanelProps = Readonly<{
  open: boolean;
  onClose: () => void;
  negocio: { id: string; nombre: string };
  settings?: INegocioQabSettingsItem;
  loading: boolean;
  loadError: boolean;
  autoProvisioningAvailable: boolean;
  autoProvisioningUnavailableReason: IQabAutoProvisioningUnavailableReason | null;
  onReload: () => Promise<void>;
  onToggle: (negocioId: string, enabled: boolean) => Promise<void>;
  onProvision: (negocioId: string) => Promise<INegocioQabProvisioningResult>;
  onSaveToken: (negocioId: string, token: string) => Promise<void>;
}>;

const UNAVAILABLE_REASON_TEXT: Record<IQabAutoProvisioningUnavailableReason, string> = {
  SECRET_NOT_SET:
    "Este servidor no tiene configurado su secreto de aprovisionamiento, así que el alta automática no se puede ofrecer.",
  SECRET_INVALID:
    "El secreto de aprovisionamiento de este servidor está configurado pero no sirve, así que el alta automática no se puede ofrecer.",
  BASE_URL_NOT_SET:
    "Este servidor no tiene configurada la dirección de QAB (QAB_API_BASE_URL), así que el alta automática no se puede ofrecer.",
  BASE_URL_INVALID:
    "La dirección de QAB configurada en este servidor no sirve, así que el alta automática no se puede ofrecer.",
};

/**
 * The «Tienda online» panel: state first, then the controls, then what the last
 * action produced, and the rescue path last of all.
 *
 * It declares no breakpoint of its own - the only thresholds that touch it are
 * the `down("md")` the screen already had and the `down("sm")` `AppDialog`
 * carries inside for its full-screen behaviour on phones.
 *
 * No `CircularProgress` anywhere: what is in flight is said with the text of the
 * button, its disabled state, and an indeterminate bar under the credential
 * block. A spinner only says "wait"; the text says what is being waited on and
 * why the window must not be closed.
 */
export function QabNegocioPanel({
  open,
  onClose,
  negocio,
  settings,
  loading,
  loadError,
  autoProvisioningAvailable,
  autoProvisioningUnavailableReason,
  onReload,
  onToggle,
  onProvision,
  onSaveToken,
}: QabNegocioPanelProps) {
  const { showMessage } = useMessageContext();

  const [provisioning, setProvisioning] = useState(false);
  const [togglePending, setTogglePending] = useState(false);
  const [outcome, setOutcome] = useState<QabNoticeOutcome | null>(null);
  const [offline, setOffline] = useState(false);
  const [unexpected, setUnexpected] = useState(false);
  const [rescueOpen, setRescueOpen] = useState(false);

  // Every panel opens clean: the result of the previous session's last action is
  // not the state of this business now.
  useEffect(() => {
    if (!open) return;
    setOutcome(null);
    setOffline(false);
    setUnexpected(false);
    setRescueOpen(false);
  }, [open, negocio.id]);

  const handleClose = () => {
    if (provisioning) return;
    onClose();
  };

  const handleToggle = async (enabled: boolean) => {
    if (togglePending) return;
    setTogglePending(true);
    try {
      await onToggle(negocio.id, enabled);
    } catch {
      // The Switch is driven by the stored value, so it visibly falls back to
      // where it was: it is never left showing something that was not saved.
      showMessage("No se pudo guardar el cambio de tienda online.", "error");
    } finally {
      setTogglePending(false);
    }
  };

  const handleProvision = async () => {
    if (provisioning) return;
    setProvisioning(true);
    setOutcome(null);
    setOffline(false);
    setUnexpected(false);
    try {
      const result = await onProvision(negocio.id);
      setOutcome({ kind: "result", result: result.result });
    } catch (error) {
      if (error instanceof QabProvisioningError) {
        setOutcome({
          kind: "error",
          code: error.code,
          qabError: error.qabError,
          retryable: error.retryable,
        });
      } else if (isQabNetworkFailure(error)) {
        setOffline(true);
      } else {
        setUnexpected(true);
      }
    } finally {
      setProvisioning(false);
    }
  };

  const handleCopyNegocioId = async () => {
    try {
      await navigator.clipboard.writeText(negocio.id);
      showMessage("Id del negocio copiado.", "success");
    } catch {
      showMessage(`Id del negocio: ${negocio.id}`, "info");
    }
  };

  const handleSaveToken = async (token: string) => {
    await onSaveToken(negocio.id, token);
    setOutcome(null);
    setOffline(false);
    setUnexpected(false);
    showMessage("Credencial guardada.", "success");
  };

  return (
    <AppDialog
      open={open}
      onClose={handleClose}
      title="Tienda online"
      subtitle={negocio.nombre}
      cancelLabel="Cerrar"
      busy={provisioning}
    >
      {loadError ? (
        <ErrorState
          kind="error"
          title="No se pudo cargar el estado de tienda online"
          description="La lista de negocios sigue funcionando; solo falta este bloque."
          onRetry={() => void onReload()}
        />
      ) : loading || !settings ? (
        <LoadingState variant="text" count={3} />
      ) : (
        <Stack spacing={2.5}>
          <StateBlock settings={settings} />

          <Box>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
              component="label"
              sx={{ minHeight: touch.row, width: "100%", cursor: "pointer" }}
            >
              <Typography variant="body1">Tienda online habilitada</Typography>
              <Switch
                color="primary"
                checked={settings.tiendaOnlineHabilitada}
                disabled={togglePending || provisioning}
                onChange={(event) => void handleToggle(event.target.checked)}
              />
            </Stack>
            <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
              Con el interruptor apagado, este negocio no entra en la sincronización ni
              acumula cambios pendientes, aunque tenga credencial.
            </Typography>
          </Box>

          <Box>
            <SectionLabel>Credencial de QAB</SectionLabel>
            <Stack spacing={1}>
              {settings.qabTokenConfigurado ? (
                <>
                  <StatusPill
                    label="Guardada"
                    hue="positive"
                    sx={{ alignSelf: "flex-start" }}
                  />
                  {settings.qabTokenActualizadoAt && (
                    <Box>
                      <Typography variant="body2">
                        Guardada el {formatDateTime(settings.qabTokenActualizadoAt)}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "semantic.text.secondary" }}
                      >
                        {getRelativeDate(settings.qabTokenActualizadoAt)}
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <>
                  <StatusPill
                    label="Sin credencial"
                    hue="neutral"
                    sx={{ alignSelf: "flex-start" }}
                  />
                  <Typography variant="body2">
                    Todavía no hay ninguna credencial guardada para este negocio.
                  </Typography>
                </>
              )}

              <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
                cuadrecaja no muestra el valor de la credencial en ningún momento, ni
                completo ni en fragmentos. Nadie —tampoco vos— necesita verlo para operar
                esta pantalla.
              </Typography>

              {provisioning && (
                <Box>
                  <LinearProgress
                    sx={{
                      height: 4,
                      "& .MuiLinearProgress-bar": {
                        bgcolor: "semantic.sync.syncing.main",
                      },
                    }}
                  />
                  <Typography
                    variant="body2"
                    sx={{ color: "semantic.text.secondary", mt: 0.5 }}
                  >
                    Hablando con QAB. No cierres esta ventana.
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>

          {autoProvisioningAvailable ? (
            settings.qabTokenConfigurado ? (
              <Box>
                <Button
                  variant="outlined"
                  onClick={() => void handleProvision()}
                  disabled={provisioning}
                  sx={{ minHeight: touch.min }}
                >
                  {provisioning ? "Comprobando…" : "Comprobar el alta en QAB"}
                </Button>
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary", mt: 0.5 }}
                >
                  No crea una credencial nueva ni reemplaza la guardada: esta vía no rota
                  nunca.
                </Typography>
              </Box>
            ) : (
              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={() => void handleProvision()}
                disabled={provisioning}
                sx={{ minHeight: touch.comfortable }}
              >
                {provisioning ? "Dando de alta…" : "Dar de alta en QAB"}
              </Button>
            )
          ) : (
            <Alert severity="warning">
              {autoProvisioningUnavailableReason
                ? UNAVAILABLE_REASON_TEXT[autoProvisioningUnavailableReason]
                : "El alta automática no se puede ofrecer en este servidor."}{" "}
              Mientras tanto, la vía de rescate de más abajo es el único camino disponible
              acá.
            </Alert>
          )}

          {offline && (
            <ErrorState
              kind="offline"
              title="Sin conexión"
              description="No se pudo salir a la red para hablar con QAB. Volvé a intentarlo cuando la conexión vuelva."
            />
          )}

          {unexpected && (
            <Alert severity="error">
              La respuesta del servidor no se pudo interpretar. Cerrá esta ventana,
              actualizá la lista y volvé a intentarlo.
            </Alert>
          )}

          {outcome && (
            <QabProvisioningNotice
              outcome={outcome}
              negocioId={negocio.id}
              onRetry={() => void handleProvision()}
              onOpenRescue={() => setRescueOpen(true)}
              onReload={() => void onReload()}
              onCopyNegocioId={() => void handleCopyNegocioId()}
            />
          )}

          <QabTokenRescueDisclosure
            open={rescueOpen}
            onOpenChange={setRescueOpen}
            hasCredential={settings.qabTokenConfigurado}
            onSave={handleSaveToken}
            disabled={provisioning}
          />
        </Stack>
      )}
    </AppDialog>
  );
}

function StateBlock({ settings }: Readonly<{ settings: INegocioQabSettingsItem }>) {
  const state = resolveQabSyncState(settings);

  if (state === "SYNCING") {
    return (
      <StateLine
        text="Este negocio sincroniza con QAB."
        background="semantic.sync.online.surface"
        color="semantic.sync.online.main"
      />
    );
  }

  if (state === "MISSING_CREDENTIAL") {
    return (
      <StateLine
        text="No sincroniza: falta la credencial de QAB."
        background="semantic.sync.offline.surface"
        color="semantic.sync.offline.main"
      />
    );
  }

  return (
    <StateLine
      text={
        settings.qabTokenConfigurado
          ? "La tienda online está apagada. Al encenderla, sincronizará."
          : "No sincroniza: la tienda online está apagada."
      }
      background="semantic.hue.neutral.surface"
      color="semantic.hue.neutral.main"
    />
  );
}

function StateLine({
  text,
  background,
  color,
}: Readonly<{ text: string; background: string; color: string }>) {
  return (
    <Box sx={{ bgcolor: background, color, borderRadius: 1.5, px: 2, py: 1.5 }}>
      <Typography variant="body1" fontWeight={600} sx={{ color: "inherit" }}>
        {text}
      </Typography>
    </Box>
  );
}

export default QabNegocioPanel;
