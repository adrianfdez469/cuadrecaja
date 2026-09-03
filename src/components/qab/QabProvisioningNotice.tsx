"use client";

import { Alert, AlertTitle, Button, Stack, Typography } from "@mui/material";
import type { AlertColor } from "@mui/material";
import {
  QAB_PROVISIONING_ORPHAN_LOG,
  QAB_PROVISIONING_RESULTS,
} from "@/constants/qabProvisioning";
import { touch } from "@/theme/tokens";
import type { IQabProvisioningUpstreamCode } from "@/lib/qab/qabProvisioningClient";
import type { INegocioQabProvisioningError } from "@/schemas/qabProvisioning";

type QabProvisioningResultValue = (typeof QAB_PROVISIONING_RESULTS)[number];

/**
 * What the panel has to say about the last action. Either one of the three
 * `result` values of a 200, or one normalised failure.
 */
export type QabNoticeOutcome =
  | { kind: "result"; result: QabProvisioningResultValue }
  | {
      kind: "error";
      code: INegocioQabProvisioningError["error"];
      qabError: IQabProvisioningUpstreamCode | null;
      retryable: boolean;
    };

export type QabProvisioningNoticeProps = Readonly<{
  outcome: QabNoticeOutcome;
  negocioId: string;
  /** Only ever rendered when the outcome declares itself retryable. */
  onRetry: () => void;
  onOpenRescue: () => void;
  onReload: () => void;
  onCopyNegocioId: () => void;
}>;

interface NoticeCopy {
  severity: AlertColor;
  title: string;
  paragraphs: string[];
}

const ROTATION_EXIT =
  "Para salir de aquí hay un solo camino: pedile al equipo de QAB una rotación con corte de este negocio y pegá acá la credencial nueva. Mientras tanto, este negocio no sincroniza; el resto de la plataforma no está afectado.";

/**
 * The nineteen outcomes, one by one. This component IS acceptance criterion 8:
 * no two rows say the same thing, none of them is presented as a generic error,
 * and «Reintentar» exists only where the server said the call is retryable.
 *
 * `CONFIRMED_ORPHANED` never shares a screen with `ALREADY_MINTED`: it arrives
 * with a 200 because the route worked, not because everything is fine.
 */
const RESULT_COPY: Record<QabProvisioningResultValue, NoticeCopy> = {
  MINTED: {
    severity: "success",
    title: "Negocio dado de alta en QAB",
    paragraphs: [
      "La credencial se acuñó y quedó guardada. Nadie la vio, y no se muestra en ninguna parte.",
    ],
  },
  ALREADY_MINTED: {
    severity: "info",
    title: "Este negocio ya tenía credencial en QAB",
    paragraphs: [
      "QAB no acuñó ninguna credencial nueva y la que cuadrecaja tenía guardada no se tocó. Es lo esperado: esta vía nunca rota una credencial existente.",
    ],
  },
  CONFIRMED_ORPHANED: {
    severity: "error",
    title: "QAB tiene la credencial de este negocio, y cuadrecaja no",
    paragraphs: [
      "QAB confirma que este negocio ya tiene credencial de su lado, y acá no hay ninguna guardada. Quiere decir que se acuñó en algún momento y se perdió: esa vía la entrega una sola vez, así que volver a pulsar va a devolver exactamente esto mismo.",
      "Salida, la misma de siempre: pedile al equipo de QAB una rotación con corte de este negocio y pegá acá la credencial nueva. Mientras tanto, este negocio no sincroniza.",
      "Quedó registrado en el servidor con la razón CONFIRMED_ORPHANED.",
    ],
  },
};

const UPSTREAM_COPY: Record<IQabProvisioningUpstreamCode, NoticeCopy> = {
  INVALID_BODY: {
    severity: "error",
    title: "QAB rechazó los datos de este negocio",
    paragraphs: [
      "QAB no aceptó el identificador o el nombre que cuadrecaja le envió. Revisá el nombre del negocio (máximo 200 caracteres) e intentá de nuevo desde el principio.",
    ],
  },
  UNAUTHORIZED: {
    severity: "error",
    title: "QAB no reconoció el secreto de aprovisionamiento",
    paragraphs: [
      "El secreto con el que este servidor de cuadrecaja se identifica ante QAB no es el que QAB espera. No es un problema de tu usuario: seguís conectado y no hay nada que hacer con tu cuenta.",
      "Hay que revisar el secreto de aprovisionamiento de este despliegue con el equipo de QAB.",
    ],
  },
  BUSINESS_INACTIVE: {
    severity: "error",
    title: "El negocio está dado de baja en QAB",
    paragraphs: [
      "El negocio está dado de baja en QAB, y esta ruta no lo reactiva. Pedile al equipo de QAB que lo reactive; hasta entonces no se puede acuñar su credencial.",
    ],
  },
  METHOD_NOT_ALLOWED: {
    severity: "error",
    title: "La dirección de QAB no responde a esta operación",
    paragraphs: [
      "La dirección configurada en QAB_API_BASE_URL contestó, pero no ofrece la ruta de aprovisionamiento. Suele significar que apunta a un despliegue de QAB anterior a la versión 10.",
    ],
  },
  PROVISIONING_NOT_CONFIGURED: {
    severity: "warning",
    title: "Falta el secreto de aprovisionamiento del lado de QAB",
    paragraphs: [
      "QAB respondió que no tiene configurado su secreto de aprovisionamiento. No es un problema de este servidor: hay que pedirle al equipo de QAB que lo configure.",
    ],
  },
  TOKEN_COLLISION: {
    severity: "warning",
    title: "QAB no pudo acuñar la credencial",
    paragraphs: [
      "Hubo una colisión interna al acuñar. No quedó nada escrito en ninguno de los dos lados, así que volver a intentarlo es seguro.",
    ],
  },
  TRANSPORT: {
    severity: "warning",
    title: "No se pudo hablar con QAB",
    paragraphs: [
      "La petición no llegó a completarse. Si QAB llegó a acuñar la credencial, cuadrecaja no la recibió. Reintentá: si se acuñó, el reintento te lo va a decir con claridad.",
    ],
  },
  INVALID_RESPONSE_BODY: {
    severity: "warning",
    title: "QAB respondió algo que cuadrecaja no entiende",
    paragraphs: [
      "La respuesta no tiene la forma del contrato. Puede volver a intentarse; si se repite, es un aviso para el equipo de QAB.",
    ],
  },
  UNEXPECTED_STATUS: {
    severity: "warning",
    title: "QAB respondió de una forma no prevista",
    paragraphs: [
      "El contrato no describe esta respuesta. Puede volver a intentarse; si se repite, es un aviso para el equipo de QAB.",
    ],
  },
  EXTERNAL_ID_MISMATCH: {
    severity: "error",
    title: "QAB devolvió una credencial que no es de este negocio",
    paragraphs: [
      "cuadrecaja no guardó nada: escribir en un negocio la credencial de otro es el fallo que esta comprobación existe para impedir. Quedó registrado en el servidor; avisá al equipo de QAB antes de volver a intentarlo.",
    ],
  },
};

const OWN_COPY: Record<INegocioQabProvisioningError["error"], NoticeCopy> = {
  PROVISIONING_SECRET_NOT_SET: {
    severity: "warning",
    title: "Falta el secreto de aprovisionamiento en este servidor",
    paragraphs: [
      "Este despliegue de cuadrecaja no tiene configurado su secreto de aprovisionamiento, así que no se llamó a QAB. Mientras tanto, la única vía es pegar una credencial a mano.",
    ],
  },
  QAB_API_BASE_URL_NOT_SET: {
    severity: "warning",
    title: "Falta la dirección de QAB en este servidor",
    paragraphs: [
      "Este despliegue no tiene configurada QAB_API_BASE_URL, así que no se llamó a QAB.",
    ],
  },
  QAB_CONFIG_INVALID: {
    severity: "error",
    title: "La configuración de QAB de este servidor no sirve",
    paragraphs: [
      "Alguno de los dos valores de configuración está presente pero es inservible. No se llamó a QAB. Hay que revisarlo en el despliegue.",
    ],
  },
  NEGOCIO_NOT_FOUND: {
    severity: "error",
    title: "Este negocio ya no existe",
    paragraphs: [
      "Alguien lo borró mientras tenías la pantalla abierta. Actualizá la lista.",
    ],
  },
  FORBIDDEN: {
    severity: "error",
    title: "Tu usuario no puede dar de alta negocios en QAB",
    paragraphs: ["Esta acción es solo para superadministradores."],
  },
  QAB_TOKEN_ORPHANED: {
    severity: "error",
    title: "La credencial se acuñó en QAB y no se pudo guardar acá",
    paragraphs: [
      "QAB creó la credencial de este negocio y cuadrecaja no llegó a guardarla. Esa vía entrega la credencial una sola vez, así que volver a intentarlo no la recupera.",
      ROTATION_EXIT,
      `Quedó registrado en el servidor: se busca por ${QAB_PROVISIONING_ORPHAN_LOG} junto al id de este negocio.`,
    ],
  },
  QAB_PROVISIONING_UPSTREAM: {
    // Never rendered: an upstream failure always carries its `qabError`, and the
    // ten of them have their own copy above.
    severity: "error",
    title: "QAB no pudo completar el alta",
    paragraphs: ["QAB devolvió un fallo que cuadrecaja no pudo clasificar."],
  },
};

function resolveCopy(outcome: QabNoticeOutcome): NoticeCopy {
  if (outcome.kind === "result") return RESULT_COPY[outcome.result];
  if (outcome.qabError !== null) return UPSTREAM_COPY[outcome.qabError];
  return OWN_COPY[outcome.code];
}

/** The two outcomes whose only way out is a conversation with the other team. */
function isOrphanOutcome(outcome: QabNoticeOutcome): boolean {
  if (outcome.kind === "result") return outcome.result === "CONFIRMED_ORPHANED";
  return outcome.code === "QAB_TOKEN_ORPHANED" && outcome.qabError === null;
}

export function QabProvisioningNotice({
  outcome,
  negocioId,
  onRetry,
  onOpenRescue,
  onReload,
  onCopyNegocioId,
}: QabProvisioningNoticeProps) {
  const copy = resolveCopy(outcome);
  const retryable = outcome.kind === "error" && outcome.retryable;
  const orphaned = isOrphanOutcome(outcome);
  const missing =
    outcome.kind === "error" &&
    outcome.qabError === null &&
    outcome.code === "NEGOCIO_NOT_FOUND";

  return (
    <Alert severity={copy.severity} sx={{ mt: 2 }} data-negocio-id={negocioId}>
      <AlertTitle>{copy.title}</AlertTitle>

      <Stack spacing={1}>
        {copy.paragraphs.map((paragraph) => (
          <Typography key={paragraph} variant="body2">
            {paragraph}
          </Typography>
        ))}

        {(retryable || orphaned || missing) && (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {retryable && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={onRetry}
                sx={{ minHeight: touch.min }}
              >
                Reintentar
              </Button>
            )}
            {orphaned && (
              <>
                <Button
                  variant="outlined"
                  color="inherit"
                  onClick={onCopyNegocioId}
                  sx={{ minHeight: touch.min }}
                >
                  Copiar el id del negocio
                </Button>
                <Button
                  variant="text"
                  color="inherit"
                  onClick={onOpenRescue}
                  sx={{ minHeight: touch.min }}
                >
                  Pegar una credencial a mano
                </Button>
              </>
            )}
            {missing && (
              <Button
                variant="outlined"
                color="inherit"
                onClick={onReload}
                sx={{ minHeight: touch.min }}
              >
                Actualizar
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Alert>
  );
}

export default QabProvisioningNotice;
