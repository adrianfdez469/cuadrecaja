"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ONBOARDING_STORAGE_KEY, TOUR_POS_VENTA } from "../constants";
import { getChainById, getTourById } from "../tours/primerosPasos";
import type {
  IPosTourContext,
  IUserOnboardingProgress,
  IUserOnboardingSettings,
  OnboardingChainId,
  OnboardingEvent,
  OnboardingStepDefinition,
  OnboardingTourId,
} from "../types";
import {
  getNextRunnableTour,
  migrateLegacyProgress,
  normalizeOnboardingSettings,
} from "../utils/onboardingSettings";
import { resolveTourSteps } from "../utils/resolveTourSteps";

const emptyProgress = (): IUserOnboardingProgress => ({
  settings: { enabled: true, toursEnabled: {} },
});

function readUserSettings(progress: IUserOnboardingProgress): IUserOnboardingSettings {
  if (progress.settings) {
    return normalizeOnboardingSettings(progress.settings);
  }
  return migrateLegacyProgress(progress);
}

function computeActiveSteps(
  tourId: OnboardingTourId | null,
  posContext: IPosTourContext | null,
): OnboardingStepDefinition[] {
  if (!tourId) return [];
  const tour = getTourById(tourId);
  if (!tour) return [];
  return resolveTourSteps(tour, posContext);
}

interface OnboardingState {
  userProgress: Record<string, IUserOnboardingProgress>;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  activeChainId: OnboardingChainId | null;
  activeTourId: OnboardingTourId | null;
  activeUserId: string | null;
  activeStepDefinitions: OnboardingStepDefinition[];
  stepIndex: number;
  run: boolean;
  demoProductName: string | null;
  eligibleTourIds: OnboardingTourId[];
  posTourContext: IPosTourContext | null;
  pendingDismissNotice: boolean;
  layoutNonce: number;

  getProgress: (userId: string) => IUserOnboardingProgress;
  getSettings: (userId: string) => IUserOnboardingSettings;
  isTourEnabled: (userId: string, tourId: OnboardingTourId) => boolean;
  isMasterEnabled: (userId: string) => boolean;

  setMasterEnabled: (userId: string, enabled: boolean) => void;
  setTourEnabled: (
    userId: string,
    tourId: OnboardingTourId,
    enabled: boolean,
  ) => void;
  disableTour: (userId: string, tourId: OnboardingTourId) => void;

  setPosTourContext: (context: IPosTourContext | null) => void;
  clearPendingDismissNotice: () => void;

  startChain: (
    userId: string,
    chainId: OnboardingChainId,
    eligibleTourIds: OnboardingTourId[],
  ) => void;
  startTour: (
    userId: string,
    chainId: OnboardingChainId,
    tourId: OnboardingTourId,
    eligibleTourIds: OnboardingTourId[],
  ) => void;
  setStepIndex: (index: number) => void;
  advanceStep: () => void;
  completeActiveTour: () => void;
  dismissActiveTour: () => void;
  signalEvent: (event: OnboardingEvent) => void;
  bumpLayoutNonce: () => void;
  stopRun: () => void;
  clearActiveSession: () => void;
  resetForDev: (userId?: string) => void;

  isBlockingActive: () => boolean;
  canNavigateTo: (path: string) => boolean;
}

export function selectIsOnboardingBlocking(state: {
  run: boolean;
  activeChainId: OnboardingChainId | null;
}): boolean {
  if (!state.run || !state.activeChainId) return false;
  const chain = getChainById(state.activeChainId);
  return chain?.blocking ?? false;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      userProgress: {},
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      activeChainId: null,
      activeTourId: null,
      activeUserId: null,
      activeStepDefinitions: [],
      stepIndex: 0,
      run: false,
      demoProductName: null,
      eligibleTourIds: [],
      posTourContext: null,
      pendingDismissNotice: false,
      layoutNonce: 0,

      getProgress: (userId) => get().userProgress[userId] ?? emptyProgress(),

      getSettings: (userId) => readUserSettings(get().getProgress(userId)),

      isTourEnabled: (userId, tourId) => {
        const settings = get().getSettings(userId);
        if (!settings.enabled) return false;
        return settings.toursEnabled[tourId] !== false;
      },

      isMasterEnabled: (userId) => get().getSettings(userId).enabled,

      setMasterEnabled: (userId, enabled) => {
        const current = get().getProgress(userId);
        const settings = readUserSettings(current);
        set({
          userProgress: {
            ...get().userProgress,
            [userId]: { settings: { ...settings, enabled } },
          },
        });
        if (!enabled) get().clearActiveSession();
      },

      setTourEnabled: (userId, tourId, enabled) => {
        const current = get().getProgress(userId);
        const settings = readUserSettings(current);
        const toursEnabled = { ...settings.toursEnabled };

        if (enabled) {
          delete toursEnabled[tourId];
        } else {
          toursEnabled[tourId] = false;
        }

        set({
          userProgress: {
            ...get().userProgress,
            [userId]: { settings: { ...settings, toursEnabled } },
          },
        });

        if (!enabled && get().activeTourId === tourId) {
          get().clearActiveSession();
        }
      },

      disableTour: (userId, tourId) => {
        get().setTourEnabled(userId, tourId, false);
      },

      setPosTourContext: (context) => {
        const state = get();
        const activeStepDefinitions = computeActiveSteps(
          state.activeTourId,
          context,
        );
        set({
          posTourContext: context,
          activeStepDefinitions,
          stepIndex: Math.min(state.stepIndex, Math.max(activeStepDefinitions.length - 1, 0)),
          layoutNonce: context?.loaded ? state.layoutNonce + 1 : state.layoutNonce,
        });
      },

      clearPendingDismissNotice: () => set({ pendingDismissNotice: false }),

      startChain: (userId, chainId, eligibleTourIds) => {
        if (!userId || eligibleTourIds.length === 0) return;
        const settings = get().getSettings(userId);
        const nextTour = getNextRunnableTour(chainId, eligibleTourIds, settings);
        if (!nextTour) return;
        get().startTour(userId, chainId, nextTour, eligibleTourIds);
      },

      startTour: (userId, chainId, tourId, eligibleTourIds) => {
        const posTourContext =
          tourId === TOUR_POS_VENTA
            ? { hasProducts: true, sampleProductName: null, loaded: false }
            : null;

        set({
          activeChainId: chainId,
          activeUserId: userId,
          eligibleTourIds,
          activeTourId: tourId,
          activeStepDefinitions: computeActiveSteps(tourId, posTourContext),
          stepIndex: 0,
          run: true,
          demoProductName: null,
          posTourContext,
        });
      },

      setStepIndex: (index) => set({ stepIndex: index }),

      advanceStep: () => {
        const { activeStepDefinitions, stepIndex } = get();
        const nextIndex = stepIndex + 1;
        if (nextIndex >= activeStepDefinitions.length) {
          get().completeActiveTour();
        } else {
          set({ stepIndex: nextIndex });
          get().bumpLayoutNonce();
        }
      },

      completeActiveTour: () => {
        const {
          activeTourId,
          activeChainId,
          activeUserId,
          eligibleTourIds,
        } = get();
        if (!activeTourId || !activeUserId) return;

        get().disableTour(activeUserId, activeTourId);

        if (!activeChainId) {
          get().clearActiveSession();
          return;
        }

        const settings = get().getSettings(activeUserId);
        const nextTour = getNextRunnableTour(
          activeChainId,
          eligibleTourIds,
          settings,
        );

        if (nextTour) {
          get().startTour(activeUserId, activeChainId, nextTour, eligibleTourIds);
        } else {
          get().clearActiveSession();
        }
      },

      dismissActiveTour: () => {
        const { activeTourId, activeUserId } = get();
        if (activeTourId && activeUserId) {
          get().disableTour(activeUserId, activeTourId);
        }
        set({ pendingDismissNotice: true });
        get().clearActiveSession();
      },

      signalEvent: (event) => {
        const state = get();
        if (!state.run || !state.activeTourId) return;

        const currentStep = state.activeStepDefinitions[state.stepIndex];
        if (!currentStep?.advanceOnEvent) return;
        if (currentStep.advanceOnEvent !== event.type) return;

        if (event.type === "product_created" && event.productName) {
          set({ demoProductName: event.productName });
        }

        get().advanceStep();
        get().bumpLayoutNonce();
      },

      bumpLayoutNonce: () =>
        set((s) => ({ layoutNonce: s.layoutNonce + 1 })),

      stopRun: () => set({ run: false }),

      clearActiveSession: () =>
        set({
          activeChainId: null,
          activeTourId: null,
          activeUserId: null,
          activeStepDefinitions: [],
          stepIndex: 0,
          run: false,
          demoProductName: null,
          eligibleTourIds: [],
          posTourContext: null,
        }),

      resetForDev: (userId) => {
        const baseReset = {
          activeChainId: null,
          activeTourId: null,
          activeUserId: null,
          activeStepDefinitions: [],
          stepIndex: 0,
          run: false,
          demoProductName: null,
          eligibleTourIds: [],
          posTourContext: null,
          pendingDismissNotice: false,
        };

        if (userId) {
          const { [userId]: _removed, ...rest } = get().userProgress;
          set({ userProgress: rest, ...baseReset });
        } else {
          set({ userProgress: {}, ...baseReset });
        }
      },

      isBlockingActive: () => selectIsOnboardingBlocking(get()),

      canNavigateTo: (path) => {
        if (!get().isBlockingActive()) return true;

        const state = get();
        const step = state.activeStepDefinitions[state.stepIndex];
        if (!step) return false;

        if (step.advanceOnPathname && path.startsWith(step.advanceOnPathname)) {
          return true;
        }
        if (step.pathname && path.startsWith(step.pathname)) {
          return true;
        }
        if (path === "/home" || path === "/ayuda") return true;

        return false;
      },
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      version: 3,
      partialize: (state) => ({ userProgress: state.userProgress }),
      migrate: (persisted: unknown) => {
        const legacy = persisted as {
          userProgress?: Record<string, IUserOnboardingProgress>;
        } | null;

        if (!legacy?.userProgress) return { userProgress: {} };

        const userProgress: Record<string, IUserOnboardingProgress> = {};
        for (const [userId, progress] of Object.entries(legacy.userProgress)) {
          userProgress[userId] = progress.settings
            ? { settings: normalizeOnboardingSettings(progress.settings) }
            : { settings: migrateLegacyProgress(progress) };
        }
        return { userProgress };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export function useOnboardingHydrated(): boolean {
  return useOnboardingStore((s) => s._hasHydrated);
}

export function exitOnboardingTour(): void {
  useOnboardingStore.getState().dismissActiveTour();
}
