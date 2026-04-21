import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  USER_ACCOUNT_JWT_INVITE_EXPIRES_IN,
  USER_ACCOUNT_JWT_RESET_EXPIRES_IN,
} from "@/constants/userAccount";

const basePayloadSchema = z.object({
  sub: z.string().uuid(),
  negocioId: z.string().uuid(),
});

const invitePayloadSchema = basePayloadSchema.extend({
  typ: z.literal("invite"),
});

const resetPayloadSchema = basePayloadSchema.extend({
  typ: z.literal("password_reset"),
});

const emailChangePayloadSchema = basePayloadSchema.extend({
  typ: z.literal("email_change"),
  currentEmail: z.string().email(),
  newEmail: z.string().email(),
});

export type UserAccountJwtVerified =
  | z.infer<typeof invitePayloadSchema>
  | z.infer<typeof resetPayloadSchema>
  | z.infer<typeof emailChangePayloadSchema>;

function requireUserAccountSecret(): string {
  const secret = process.env.USER_ACCOUNT_JWT_SECRET;
  if (!secret?.trim()) {
    throw new Error("USER_ACCOUNT_JWT_SECRET no está configurado");
  }
  return secret;
}

export function signUserInviteToken(input: {
  usuarioId: string;
  negocioId: string;
}): string {
  const secret = requireUserAccountSecret();
  return jwt.sign(
    { typ: "invite" as const, sub: input.usuarioId, negocioId: input.negocioId },
    secret,
    { expiresIn: USER_ACCOUNT_JWT_INVITE_EXPIRES_IN }
  );
}

export function signUserPasswordResetToken(input: {
  usuarioId: string;
  negocioId: string;
}): string {
  const secret = requireUserAccountSecret();
  return jwt.sign(
    {
      typ: "password_reset" as const,
      sub: input.usuarioId,
      negocioId: input.negocioId,
    },
    secret,
    { expiresIn: USER_ACCOUNT_JWT_RESET_EXPIRES_IN }
  );
}

export function verifyUserAccountToken(token: string): UserAccountJwtVerified {
  const secret = requireUserAccountSecret();
  const decoded = jwt.verify(token, secret);
  const parsed = z
    .union([invitePayloadSchema, resetPayloadSchema, emailChangePayloadSchema])
    .parse(decoded);
  return parsed;
}

export function signUserEmailChangeToken(input: {
  usuarioId: string;
  negocioId: string;
  currentEmail: string;
  newEmail: string;
}): string {
  const secret = requireUserAccountSecret();
  return jwt.sign(
    {
      typ: "email_change" as const,
      sub: input.usuarioId,
      negocioId: input.negocioId,
      currentEmail: input.currentEmail,
      newEmail: input.newEmail,
    },
    secret,
    { expiresIn: USER_ACCOUNT_JWT_INVITE_EXPIRES_IN }
  );
}
