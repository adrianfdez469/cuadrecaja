import type { INegocioQabSettingsItem } from "@/schemas/qabNegocio";

/**
 * What a business's QAB block MEANS, which is not the same as what it stores.
 * Three states, not two, and the middle one is the point: the switch is on and
 * there is no credential, so the cron skips that business in silence.
 *
 * The three labels are different words, not three colours: the distinction must
 * survive someone who cannot tell amber from grey.
 */
export type QabSyncState = "SYNCING" | "MISSING_CREDENTIAL" | "OFF";

export function resolveQabSyncState(settings: INegocioQabSettingsItem): QabSyncState {
  if (!settings.tiendaOnlineHabilitada) return "OFF";
  return settings.qabTokenConfigurado ? "SYNCING" : "MISSING_CREDENTIAL";
}

/**
 * The anomaly of the design contract: online store on, no credential. It is what
 * replaces persisting the orphan state - derived, visible without pressing
 * anything, and it never goes stale.
 */
export function isQabAnomaly(settings: INegocioQabSettingsItem): boolean {
  return resolveQabSyncState(settings) === "MISSING_CREDENTIAL";
}

export function countQabAnomalies(
  settingsByNegocioId: ReadonlyMap<string, INegocioQabSettingsItem>,
): number {
  let count = 0;
  for (const settings of settingsByNegocioId.values()) {
    if (isQabAnomaly(settings)) count += 1;
  }
  return count;
}
