import permisosCatalog from "@/constants/permisos/permisos.json";
import {
  ONBOARDING_CHAIN_PRIMEROS_PASOS,
  TOUR_GESTION_INVENTARIO,
  TOUR_POS_VENTA,
} from "../constants";
import { getChainById } from "../tours/primerosPasos";
import type {
  IUserOnboardingProgress,
  IUserOnboardingSettings,
  OnboardingChainId,
  OnboardingTourId,
} from "../types";

export const DEFAULT_ONBOARDING_SETTINGS: IUserOnboardingSettings = {
  enabled: true,
  toursEnabled: {},
};

export function normalizeOnboardingSettings(
  settings?: IUserOnboardingSettings | null,
): IUserOnboardingSettings {
  if (!settings) return { ...DEFAULT_ONBOARDING_SETTINGS };
  return {
    enabled: settings.enabled !== false,
    toursEnabled: { ...settings.toursEnabled },
  };
}

export function migrateLegacyProgress(
  progress: IUserOnboardingProgress,
): IUserOnboardingSettings {
  const settings = normalizeOnboardingSettings(progress.settings);

  for (const [tourId, done] of Object.entries(progress.completedTours ?? {})) {
    if (done) {
      settings.toursEnabled[tourId as OnboardingTourId] = false;
    }
  }

  if (progress.dismissedChains?.[ONBOARDING_CHAIN_PRIMEROS_PASOS]) {
    const chain = getChainById(ONBOARDING_CHAIN_PRIMEROS_PASOS);
    for (const tourId of chain?.tourIds ?? []) {
      settings.toursEnabled[tourId] = false;
    }
  }

  return settings;
}

export function isTourEnabledForUser(
  settings: IUserOnboardingSettings,
  tourId: OnboardingTourId,
): boolean {
  if (!settings.enabled) return false;
  return settings.toursEnabled[tourId] !== false;
}

export function getNextRunnableTour(
  chainId: OnboardingChainId,
  eligibleTourIds: OnboardingTourId[],
  settings: IUserOnboardingSettings,
): OnboardingTourId | null {
  const chain = getChainById(chainId);
  if (!chain || !settings.enabled) return null;

  for (const tourId of chain.tourIds) {
    if (!eligibleTourIds.includes(tourId)) continue;
    if (!isTourEnabledForUser(settings, tourId)) continue;

    const inventoryPending =
      eligibleTourIds.includes(TOUR_GESTION_INVENTARIO) &&
      isTourEnabledForUser(settings, TOUR_GESTION_INVENTARIO);

    if (tourId === TOUR_POS_VENTA && inventoryPending) {
      continue;
    }

    return tourId;
  }

  return null;
}

export function getPermisoLabel(permission: string): string {
  const entry = (permisosCatalog as Record<string, { descripcion?: string }>)[
    permission
  ];
  return entry?.descripcion ?? permission;
}
