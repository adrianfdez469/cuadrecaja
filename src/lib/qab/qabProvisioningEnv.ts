import {
  QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS,
  QAB_BEARER_VALUE_PATTERN,
  QAB_PROVISIONING_CREDENTIAL_PATH,
  QAB_PROVISIONING_SECRET_MIN_LENGTH,
} from "@/constants/qabProvisioning";
import { QabConfigError, resolveQabBaseUrl } from "@/lib/qab/qabEnv";
import type { IQabAutoProvisioningUnavailableReason } from "@/schemas/qabNegocio";

/**
 * This module is the ONLY reader of the integrator secret in the whole
 * repository. The per-business `qabToken` is read only by `loadQabTokens`
 * (`src/lib/qab/outboxDrain.ts`). No module reads both. See ADR 0026.
 */
const PROVISIONING_SECRET_ENV_KEY = "QAB_PROVISIONING_SECRET";

/** Thrown when the integrator secret is present but unusable. */
export class QabProvisioningConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QabProvisioningConfigError";
  }
}

/**
 * PURE (takes the environment as an argument, like `resolveQabBaseUrl`).
 *
 *  - absent or blank after trimming -> `null` ("not configured", not an error: ADR 0014)
 *  - present but shorter than QAB_PROVISIONING_SECRET_MIN_LENGTH, or carrying a
 *    character that does not satisfy QAB_BEARER_VALUE_PATTERN -> throws
 *    `QabProvisioningConfigError`
 *  - otherwise -> the trimmed secret
 *
 * The exception message NEVER contains the value nor any fragment of it.
 */
export function resolveQabProvisioningSecret(env?: NodeJS.ProcessEnv): string | null {
  const source = env ?? process.env;
  const raw = source[PROVISIONING_SECRET_ENV_KEY];
  if (raw === undefined) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.length < QAB_PROVISIONING_SECRET_MIN_LENGTH) {
    throw new QabProvisioningConfigError(
      `${PROVISIONING_SECRET_ENV_KEY} is shorter than ${QAB_PROVISIONING_SECRET_MIN_LENGTH} characters`,
    );
  }

  if (!QAB_BEARER_VALUE_PATTERN.test(trimmed)) {
    throw new QabProvisioningConfigError(
      `${PROVISIONING_SECRET_ENV_KEY} must be one line of printable ASCII, without spaces`,
    );
  }

  return trimmed;
}

/** PURE. `true` only if the secret can safely build a Bearer header. */
export function isUsableQabProvisioningSecret(
  secret: string | null | undefined,
): boolean {
  if (typeof secret !== "string") return false;
  if (secret.length < QAB_PROVISIONING_SECRET_MIN_LENGTH) return false;
  return QAB_BEARER_VALUE_PATTERN.test(secret);
}

/** PURE. baseUrl + QAB_PROVISIONING_CREDENTIAL_PATH. */
export function qabProvisioningCredentialUrl(baseUrl: string): string {
  return `${baseUrl}${QAB_PROVISIONING_CREDENTIAL_PATH}`;
}

/** What one of the two variables is: absent, unusable, or fine. Never throws. */
interface IEnvProbe {
  value: string | null;
  invalid: boolean;
}

function probeSecret(env?: NodeJS.ProcessEnv): IEnvProbe {
  try {
    return { value: resolveQabProvisioningSecret(env), invalid: false };
  } catch (error) {
    if (error instanceof QabProvisioningConfigError) {
      return { value: null, invalid: true };
    }
    throw error;
  }
}

function probeBaseUrl(env?: NodeJS.ProcessEnv): IEnvProbe {
  try {
    return { value: resolveQabBaseUrl(env), invalid: false };
  } catch (error) {
    if (error instanceof QabConfigError) {
      return { value: null, invalid: true };
    }
    throw error;
  }
}

/**
 * PURE. Resolves BOTH variables and says whether automatic provisioning can be
 * offered. This is what feeds `autoProvisioningAvailable` of the list. Never throws.
 *
 * The precedence when more than one reason holds is NOT written here: it is the
 * declaration order of `QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS`, which this
 * function walks in order. One source, so an `if` chain here cannot drift away
 * from the constant. With both variables broken, the secret's reason wins,
 * because the secret is what the provisioning route checks first.
 */
export function resolveAutoProvisioningAvailability(env?: NodeJS.ProcessEnv): {
  available: boolean;
  reason: IQabAutoProvisioningUnavailableReason | null;
} {
  const secret = probeSecret(env);
  const baseUrl = probeBaseUrl(env);

  const holds: Record<IQabAutoProvisioningUnavailableReason, boolean> = {
    SECRET_NOT_SET: !secret.invalid && secret.value === null,
    SECRET_INVALID: secret.invalid,
    BASE_URL_NOT_SET: !baseUrl.invalid && baseUrl.value === null,
    BASE_URL_INVALID: baseUrl.invalid,
  };

  for (const reason of QAB_AUTO_PROVISIONING_UNAVAILABLE_REASONS) {
    if (holds[reason]) return { available: false, reason };
  }

  return { available: true, reason: null };
}
