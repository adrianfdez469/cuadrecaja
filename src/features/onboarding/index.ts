export {
  OnboardingProvider,
  useOnboardingNavigation,
} from "./components/OnboardingProvider";
export {
  useOnboardingStore,
  useOnboardingHydrated,
  selectIsOnboardingBlocking,
  exitOnboardingTour,
} from "./store/onboardingStore";
export { useOnboardingProductDemo } from "./hooks/useOnboardingProductDemo";
export {
  PRODUCTO_PRUEBA_NOMBRE,
  PRODUCTO_PRUEBA_SUGERENCIAS,
  ONBOARDING_CHAIN_PRIMEROS_PASOS,
} from "./constants";
export type { OnboardingEvent, OnboardingTourId, OnboardingChainId } from "./types";
