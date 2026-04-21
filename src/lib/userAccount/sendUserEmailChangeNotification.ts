import type { NextRequest } from "next/server";
import { getAppBaseUrlFromRequest } from "@/lib/appBaseUrl";
import { ACTIVAR_CAMBIO_CORREO_PATH } from "@/constants/userAccount";
import { signUserEmailChangeToken } from "@/lib/userAccount/userAccountJwt";
import { dispatchUserEmailChangeToN8n } from "@/lib/userAccount/n8nUserWebhooks";

export async function sendUserEmailChangeNotification(input: {
  request: NextRequest | Request;
  usuarioId: string;
  usuarioNombre: string;
  negocioId: string;
  negocioNombre: string;
  requestedByNombre: string;
  requestedByEmail: string;
  previousEmail: string;
  newEmail: string;
}): Promise<void> {
  const secret = process.env.USER_ACCOUNT_JWT_SECRET?.trim();
  if (!secret) {
    console.error(
      "❌ USER_ACCOUNT_JWT_SECRET no configurado; no se generó activación de cambio de correo."
    );
    return;
  }

  const token = signUserEmailChangeToken({
    usuarioId: input.usuarioId,
    negocioId: input.negocioId,
    currentEmail: input.previousEmail,
    newEmail: input.newEmail,
  });

  const base = getAppBaseUrlFromRequest(input.request);
  const activationUrl = `${base}${ACTIVAR_CAMBIO_CORREO_PATH}?token=${encodeURIComponent(token)}`;

  await dispatchUserEmailChangeToN8n({
    source: "user-email-change",
    timestamp: new Date().toISOString(),
    negocioId: input.negocioId,
    negocioNombre: input.negocioNombre,
    requestedByNombre: input.requestedByNombre,
    requestedByEmail: input.requestedByEmail,
    usuarioId: input.usuarioId,
    usuarioNombre: input.usuarioNombre,
    previousEmail: input.previousEmail,
    newEmail: input.newEmail,
    token,
    activationUrl,
  });
}
