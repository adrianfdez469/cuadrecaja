import {
  QAB_PROVISIONING_ORPHAN_LOG,
  QAB_PROVISIONING_ORPHAN_REASONS,
} from "@/constants/qabProvisioning";

export type IQabOrphanReason = (typeof QAB_PROVISIONING_ORPHAN_REASONS)[number];

interface IQabOrphanedTokenArgs {
  negocioId: string;
  externalId: string;
  reason: IQabOrphanReason;
}

/**
 * PURE. Builds the line written to the log. Note what it does NOT receive: the
 * token is not a parameter, so this function cannot leak it even if someone
 * tried. Criterion 5 requires the token in no log; the way to guarantee that is
 * not to review the logs, it is that the function writing them cannot know it.
 *
 * Exact format, one single line, in this order:
 *   `QAB_PROVISIONING_TOKEN_ORPHANED negocioId=<id> externalId=<id> reason=<REASON>`
 */
export function formatQabOrphanedTokenLog(args: IQabOrphanedTokenArgs): string {
  return `${QAB_PROVISIONING_ORPHAN_LOG} negocioId=${args.negocioId} externalId=${args.externalId} reason=${args.reason}`;
}

/** Writes that line with `console.error`. Its only effect. Returns nothing. */
export function recordQabOrphanedToken(args: IQabOrphanedTokenArgs): void {
  console.error(formatQabOrphanedTokenLog(args));
}
