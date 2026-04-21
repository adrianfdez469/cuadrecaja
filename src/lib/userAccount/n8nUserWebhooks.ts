type InviteWebhookBody = {
  source: "user-invite";
  timestamp: string;
  negocioId: string;
  negocioNombre: string;
  creadorNombre: string;
  creadorEmail: string;
  invitadoNombre: string;
  invitadoEmail: string;
  usuarioId: string;
  token: string;
  activationUrl: string;
};

type ResetWebhookBody = {
  source: "user-password-reset";
  timestamp: string;
  negocioId: string;
  negocioNombre: string;
  usuarioNombre: string;
  email: string;
  usuarioId: string;
  token: string;
  resetUrl: string;
};

type EmailChangeWebhookBody = {
  source: "user-email-change";
  timestamp: string;
  negocioId: string;
  negocioNombre: string;
  requestedByNombre: string;
  requestedByEmail: string;
  usuarioId: string;
  usuarioNombre: string;
  previousEmail: string;
  newEmail: string;
  token: string;
  activationUrl: string;
};

function buildN8nUrl(webhookEnv: string | undefined, apiKeyEnv: string | undefined): string | null {
  const webhookUrl = webhookEnv?.trim();
  if (!webhookUrl) return null;
  const apiKey = apiKeyEnv?.trim() ?? "";
  return apiKey ? `${webhookUrl}${apiKey}` : webhookUrl;
}

export async function dispatchUserInviteToN8n(payload: InviteWebhookBody): Promise<void> {
  const url = buildN8nUrl(
    process.env.N8N_USER_INVITE_WEBHOOK,
    process.env.N8N_USER_INVITE_API_KEY
  );
  if (!url) {
    console.warn("⚠️ N8N_USER_INVITE_WEBHOOK no configurado");
    return;
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Webhook N8N invitación usuario:", response.status, text);
    }
  } catch (e) {
    console.error("❌ Error al enviar webhook N8N invitación usuario:", e);
  }
}

export async function dispatchUserPasswordResetToN8n(payload: ResetWebhookBody): Promise<void> {
  const url = buildN8nUrl(
    process.env.N8N_USER_PASSWORD_RESET_WEBHOOK,
    process.env.N8N_USER_PASSWORD_RESET_API_KEY
  );
  if (!url) {
    console.warn("⚠️ N8N_USER_PASSWORD_RESET_WEBHOOK no configurado");
    return;
  }
  try {
    const body = JSON.stringify(payload);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Webhook N8N reset contraseña:", response.status, text);
    }
  } catch (e) {
    console.error("❌ Error al enviar webhook N8N reset contraseña:", e);
  }
}

export async function dispatchUserEmailChangeToN8n(
  payload: EmailChangeWebhookBody
): Promise<void> {
  const url = buildN8nUrl(
    process.env.N8N_USER_EMAIL_CHANGE_WEBHOOK,
    process.env.N8N_USER_EMAIL_CHANGE_API_KEY
  );
  if (!url) {
    console.warn("⚠️ N8N_USER_EMAIL_CHANGE_WEBHOOK no configurado");
    return;
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const text = await response.text();
      console.error("❌ Webhook N8N cambio correo usuario:", response.status, text);
    }
  } catch (e) {
    console.error("❌ Error al enviar webhook N8N cambio correo usuario:", e);
  }
}
