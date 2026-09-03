/**
 * Shared plumbing of the four F-003 routes.
 *
 * The dominant pattern of `src/app/api/negocio/` is the opposite of this one:
 * its five sibling routes call `console.error(error)` with the whole object. In
 * these four routes that is forbidden - a Prisma or Axios error drags query
 * parameters, headers and request bodies along with it, and one of these routes
 * takes a secret in the clear.
 */

/** Every F-003 route answers with this. None of them is cacheable. */
export const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * Logs ONLY `error.name` and `error.message`. Never the whole error object,
 * never the incoming request body, never the body of the request to QAB, and
 * never a Zod `issues` array.
 */
export function logRouteError(error: unknown): void {
  if (error instanceof Error) {
    console.error(`${error.name}: ${error.message}`);
    return;
  }
  console.error(typeof error);
}
