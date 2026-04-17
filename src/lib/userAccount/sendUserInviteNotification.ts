import type { NextRequest } from "next/server";
import { getAppBaseUrlFromRequest } from "@/lib/appBaseUrl";
import { ACTIVAR_USUARIO_PATH } from "@/constants/userAccount";
import { signUserInviteToken } from "@/lib/userAccount/userAccountJwt";
import { dispatchUserInviteToN8n } from "@/lib/userAccount/n8nUserWebhooks";

export async function sendUserInviteNotification(input: {
  request: NextRequest | Request;
  usuarioId: string;
  negocioId: string;
  negocioNombre: string;
  creadorNombre: string;
  creadorEmail: string;
  invitadoNombre: string;
  invitadoEmail: string;
}): Promise<void> {
  const secret = process.env.USER_ACCOUNT_JWT_SECRET?.trim();
  if (!secret) {
    console.error("❌ USER_ACCOUNT_JWT_SECRET no configurado; no se generó invitación por correo.");
    return;
  }

  const token = signUserInviteToken({
    usuarioId: input.usuarioId,
    negocioId: input.negocioId,
  });

  const base = getAppBaseUrlFromRequest(input.request);
  const activationUrl = `${base}${ACTIVAR_USUARIO_PATH}?token=${encodeURIComponent(token)}`;

  await dispatchUserInviteToN8n({
    source: "user-invite",
    timestamp: new Date().toISOString(),
    negocioId: input.negocioId,
    negocioNombre: input.negocioNombre,
    creadorNombre: input.creadorNombre,
    creadorEmail: input.creadorEmail,
    invitadoNombre: input.invitadoNombre,
    invitadoEmail: input.invitadoEmail,
    usuarioId: input.usuarioId,
    token,
    activationUrl,
  });
}
