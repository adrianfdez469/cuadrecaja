"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ONBOARDING_STORAGE_KEY } from "../constants";
import { getChainById, getTourById } from "../tours/primerosPasos";
import type {
  OnboardingChainId,
  OnboardingEvent,
  OnboardingTourId,
} from "../types";

export interface IUserOnboardingProgress {
  completedTours: Record<string, boolean>;
  completedChains: Record<string, boolean>;
  /** El usuario cerró la guía voluntariamente (no equivale a completada) */
  dismissedChains?: Record<string, boolean>;
}

const emptyProgress = (): IUserOnboardingProgress => ({
  completedTours: {},
  completedChains: {},
  dismissedChains: {},
});

interface OnboardingState {
  /** Progreso por usuario (id de Usuario) */
  userProgress: Record<string, IUserOnboardingProgress>;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;

  activeChainId: OnboardingChainId | null;
  activeTourId: OnboardingTourId | null;
  activeUserId: string | null;
  stepIndex: number;
  run: boolean;
  demoProductName: string | null;
  eligibleTourIds: OnboardingTourId[];
  /** Fuerza recálculo de posición del tooltip (menú, acordeones, etc.) */
  layoutNonce: number;

  getProgress: (userId: string) => IUserOnboardingProgress;
  isTourCompleted: (userId: string, tourId: string) => boolean;
  isChainCompleted: (userId: string, chainId: string) => boolean;
  isChainDismissed: (userId: string, chainId: string) => boolean;

  markTourCompleted: (userId: string, tourId: OnboardingTourId) => void;
  markChainCompleted: (userId: string, chainId: OnboardingChainId) => void;
  dismissActiveChain: (userId: string, chainId: OnboardingChainId) => void;

  startChain: (
    userId: string,
    chainId: OnboardingChainId,
    eligibleTourIds: OnboardingTourId[]
  ) => void;
  setStepIndex: (index: number) => void;
  advanceStep: () => void;
  completeActiveTour: () => void;
  signalEvent: (event: OnboardingEvent) => void;
  bumpLayoutNonce: () => void;
  stopRun: () => void;
  clearActiveSession: () => void;
  resetForDev: (userId?: string) => void;

  isBlockingActive: () => boolean;
  canNavigateTo: (path: string) => boolean;
}

/** Selector reactivo: el Layout debe suscribirse a esto, no a la función isBlockingActive */
export function selectIsOnboardingBlocking(state: {
  run: boolean;
  activeChainId: OnboardingChainId | null;
}): boolean {
  if (!state.run || !state.activeChainId) return false;
  const chain = getChainById(state.activeChainId);
  return chain?.blocking ?? false;
}

/** Cierra el tour y desbloquea la aplicación */
export function exitOnboardingTour(): void {
  const state = useOnboardingStore.getState();
  if (state.activeUserId && state.activeChainId) {
    state.dismissActiveChain(state.activeUserId, state.activeChainId);
  } else {
    state.clearActiveSession();
  }
}

function getNextIncompleteTour(
  chainId: OnboardingChainId,
  eligibleTourIds: OnboardingTourId[],
  completedTours: Record<string, boolean>
): OnboardingTourId | null {
  const chain = getChainById(chainId);
  if (!chain) return null;

  for (const tourId of chain.tourIds) {
    if (!eligibleTourIds.includes(tourId)) continue;
    if (!completedTours[tourId]) return tourId;
  }
  return null;
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
      stepIndex: 0,
      run: false,
      demoProductName: null,
      eligibleTourIds: [],
      layoutNonce: 0,

      getProgress: (userId) => get().userProgress[userId] ?? emptyProgress(),

      isTourCompleted: (userId, tourId) =>
        Boolean(get().getProgress(userId).completedTours[tourId]),

      isChainCompleted: (userId, chainId) =>
        Boolean(get().getProgress(userId).completedChains[chainId]),

      isChainDismissed: (userId, chainId) =>
        Boolean(get().getProgress(userId).dismissedChains?.[chainId]),

      markTourCompleted: (userId, tourId) => {
        const current = get().getProgress(userId);
        set({
          userProgress: {
            ...get().userProgress,
            [userId]: {
              ...current,
              completedTours: { ...current.completedTours, [tourId]: true },
            },
          },
        });
      },

      markChainCompleted: (userId, chainId) => {
        const current = get().getProgress(userId);
        set({
          userProgress: {
            ...get().userProgress,
            [userId]: {
              ...current,
              completedChains: { ...current.completedChains, [chainId]: true },
            },
          },
          activeChainId: null,
          activeTourId: null,
          activeUserId: null,
          run: false,
          stepIndex: 0,
        });
      },

      dismissActiveChain: (userId, chainId) => {
        const current = get().getProgress(userId);
        set({
          userProgress: {
            ...get().userProgress,
            [userId]: {
              ...current,
              dismissedChains: {
                ...current.dismissedChains,
                [chainId]: true,
              },
            },
          },
          activeChainId: null,
          activeTourId: null,
          activeUserId: null,
          stepIndex: 0,
          run: false,
          demoProductName: null,
          eligibleTourIds: [],
        });
      },

      startChain: (userId, chainId, eligibleTourIds) => {
        if (!userId || eligibleTourIds.length === 0) return;
        if (get().isChainCompleted(userId, chainId)) return;
        if (get().isChainDismissed(userId, chainId)) return;

        const progress = get().getProgress(userId);
        const nextTour = getNextIncompleteTour(
          chainId,
          eligibleTourIds,
          progress.completedTours
        );
        if (!nextTour) {
          get().markChainCompleted(userId, chainId);
          return;
        }

        set({
          activeChainId: chainId,
          activeUserId: userId,
          eligibleTourIds,
          activeTourId: nextTour,
          stepIndex: 0,
          run: true,
          demoProductName: null,
        });
      },

      setStepIndex: (index) => set({ stepIndex: index }),

      advanceStep: () => {
        const { activeTourId, stepIndex } = get();
        if (!activeTourId) return;
        const tour = getTourById(activeTourId);
        if (!tour) return;

        const nextIndex = stepIndex + 1;
        if (nextIndex >= tour.steps.length) {
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

        set((state) => {
          const current = state.userProgress[activeUserId] ?? emptyProgress();
          const completedTours = {
            ...current.completedTours,
            [activeTourId]: true,
          };
          const userProgress = {
            ...state.userProgress,
            [activeUserId]: { ...current, completedTours },
          };

          if (!activeChainId) {
            return {
              userProgress,
              run: false,
              activeTourId: null,
              activeUserId: null,
              stepIndex: 0,
              activeChainId: null,
              eligibleTourIds: [],
            };
          }

          const nextTour = getNextIncompleteTour(
            activeChainId,
            eligibleTourIds,
            completedTours
          );

          if (nextTour) {
            return {
              userProgress,
              activeChainId,
              activeUserId,
              eligibleTourIds,
              activeTourId: nextTour,
              stepIndex: 0,
              run: true,
            };
          }

          return {
            userProgress: {
              ...userProgress,
              [activeUserId]: {
                ...current,
                completedTours,
                completedChains: {
                  ...current.completedChains,
                  [activeChainId]: true,
                },
              },
            },
            activeChainId: null,
            activeTourId: null,
            activeUserId: null,
            stepIndex: 0,
            run: false,
            eligibleTourIds: [],
          };
        });
      },

      signalEvent: (event) => {
        const state = get();
        if (!state.run || !state.activeTourId) return;

        const tour = getTourById(state.activeTourId);
        if (!tour) return;

        const currentStep = tour.steps[state.stepIndex];
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
          stepIndex: 0,
          run: false,
          demoProductName: null,
          eligibleTourIds: [],
        }),

      resetForDev: (userId) => {
        if (userId) {
          const { [userId]: _removed, ...rest } = get().userProgress;
          set({
            userProgress: rest,
            activeChainId: null,
            activeTourId: null,
            activeUserId: null,
            stepIndex: 0,
            run: false,
            demoProductName: null,
            eligibleTourIds: [],
          });
        } else {
          set({
            userProgress: {},
            activeChainId: null,
            activeTourId: null,
            activeUserId: null,
            stepIndex: 0,
            run: false,
            demoProductName: null,
            eligibleTourIds: [],
          });
        }
      },

      isBlockingActive: () => selectIsOnboardingBlocking(get()),

      canNavigateTo: (path) => {
        if (!get().isBlockingActive()) return true;

        const { activeTourId, stepIndex } = get();
        if (!activeTourId) return false;

        const tour = getTourById(activeTourId);
        const step = tour?.steps[stepIndex];
        if (!step) return false;

        if (step.advanceOnPathname && path.startsWith(step.advanceOnPathname)) {
          return true;
        }
        if (step.pathname && path.startsWith(step.pathname)) {
          return true;
        }
        if (path === "/home") return true;

        return false;
      },
    }),
    {
      name: ONBOARDING_STORAGE_KEY,
      version: 2,
      partialize: (state) => ({
        userProgress: state.userProgress,
      }),
      migrate: (persisted: unknown) => {
        const legacy = persisted as {
          completedTours?: Record<string, boolean>;
          completedChains?: Record<string, boolean>;
          userProgress?: Record<string, IUserOnboardingProgress>;
        } | undefined;

        if (legacy?.userProgress) {
          return { userProgress: legacy.userProgress };
        }

        // Formato v1 global: no heredar a usuarios nuevos
        return { userProgress: {} };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/** Esperar hidratación de persist antes de decidir auto-inicio */
export function useOnboardingHydrated(): boolean {
  return useOnboardingStore((s) => s._hasHydrated);
}
