import { NextResponse } from "next/server";
import { CLIENTES_EXTRA_COPY } from "@/constants/clientes";

/**
 * The 500 of the five routes of `api/clientes/**`.
 *
 * Both the body and the log line are fixed constants: a runtime message quotes the data that
 * broke it (E-031). Only the driver's error code goes out — it names the failure without
 * naming the row. A `route.ts` cannot export a helper of its own, so the two route files share
 * this one instead of writing the same three lines twice.
 */
export function clienteInternalErrorResponse(
  where: string,
  error: unknown,
): NextResponse {
  const code = (error as { code?: string })?.code;
  console.error(`${where} failed${code ? ` (code ${code})` : ""}`);
  return NextResponse.json(
    { error: CLIENTES_EXTRA_COPY.errorInterno },
    { status: 500 },
  );
}

/** The Prisma code for "the row the write addressed was not there". */
export const RECORD_NOT_FOUND_CODE = "P2025";

export function isRecordNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === RECORD_NOT_FOUND_CODE
  );
}
