import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function useLandingNavigation() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  const navigateTo = useCallback(
    (path: string) => {
      if (isPending) return;
      setPendingPath(path);
      startTransition(() => {
        router.push(path);
      });
    },
    [router, isPending],
  );

  const isNavigatingTo = useCallback(
    (path: string) => isPending && pendingPath === path,
    [isPending, pendingPath],
  );

  return {
    navigateTo,
    isNavigatingTo,
    isNavigating: isPending,
  };
}
