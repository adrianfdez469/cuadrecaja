import { z } from "zod";
import { TENANT_RELATION_PATH } from "@/constants/tenantScope";

export const ROUTE_GUARD_VERBS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
] as const;

/** The THREE categories of acceptance criterion 1, literal. No fourth one is added. */
export const ROUTE_GUARD_CLASSIFICATIONS = [
  "protegida",
  "publica",
  "desprotegida",
] as const;

/** Inside `protegida`, WHY it is. A nuance, not a fourth category. */
export const ROUTE_GUARD_KINDS = [
  "tenant", // scoped by the session's negocioId
  "superadmin", // hasSuperAdminPrivileges() over platform data
  // No tenant row addressable by a foreign id: either the verb touches none at all, or its
  // `where` is built only from the session's `negocioId`, with no id coming from the request.
  "sin-fila",
] as const;

/** Why a verb requires no permission (ADR 0078). */
export const ROUTE_GUARD_PERMISSION_GAPS = [
  "justificado", // written reason, like the one in assertNegocioConfigReadAccess
  "deuda-f021", // debt deliberately taken on by F-021
  "no-aplica", // the verb touches no tenant row
] as const;

export const routeGuardEntrySchema = z
  .object({
    /** Path relative to `src/app/api/`, ending in `/route.ts`. */
    route: z.string().min(1),
    verb: z.enum(ROUTE_GUARD_VERBS),
    clasificacion: z.enum(ROUTE_GUARD_CLASSIFICATIONS),
    kind: z.enum(ROUTE_GUARD_KINDS).nullable(),
    /** The reason in ONE line. Never empty, in any category (criteria 1 and 4). */
    motivo: z.string().min(1),
    /** The helper that protects it, by its exact name. */
    helper: z.string().min(1).nullable(),
    tenantModel: z
      .enum(Object.keys(TENANT_RELATION_PATH) as [string, ...string[]])
      .nullable(),
    /** Where the axis id comes from: `"path:tiendaId"`, `"query:tiendaId"`, `"body:localId"`, or null. */
    tenantParam: z.string().min(1).nullable(),
    permiso: z.string().min(1).nullable(),
    permisoAusenteMotivo: z.enum(ROUTE_GUARD_PERMISSION_GAPS).nullable(),
    /** Criterion 4: every `publica` entry declares it, and it is `false`. */
    devuelveDatosDeNegocio: z.boolean(),
    /** `"F-021"` on the verbs this feature corrects; `null` on the rest. */
    corregidaPor: z.string().min(1).nullable(),
  })
  .superRefine((entry, ctx) => {
    // 1. protegida => kind and helper are present.
    if (entry.clasificacion === "protegida") {
      if (entry.kind === null) {
        ctx.addIssue({
          code: "custom",
          path: ["kind"],
          message: "A `protegida` entry must declare its `kind`",
        });
      }
      if (entry.helper === null) {
        ctx.addIssue({
          code: "custom",
          path: ["helper"],
          message: "A `protegida` entry must name its `helper`",
        });
      }
    }

    // 2. kind === "tenant" => tenantModel and tenantParam are present (criterion 8).
    if (entry.kind === "tenant") {
      if (entry.tenantModel === null) {
        ctx.addIssue({
          code: "custom",
          path: ["tenantModel"],
          message: "A `tenant` entry must declare its `tenantModel`",
        });
      }
      if (entry.tenantParam === null) {
        ctx.addIssue({
          code: "custom",
          path: ["tenantParam"],
          message: "A `tenant` entry must declare its `tenantParam`",
        });
      }
    }

    // 3. kind !== "tenant" => tenantModel is null.
    if (entry.kind !== "tenant" && entry.tenantModel !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["tenantModel"],
        message: "Only a `tenant` entry may declare a `tenantModel`",
      });
    }

    // 4. permiso === null <=> permisoAusenteMotivo !== null (ADR 0078).
    if (entry.permiso === null && entry.permisoAusenteMotivo === null) {
      ctx.addIssue({
        code: "custom",
        path: ["permisoAusenteMotivo"],
        message: "A verb without `permiso` must declare why (ADR 0078)",
      });
    }
    if (entry.permiso !== null && entry.permisoAusenteMotivo !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["permisoAusenteMotivo"],
        message: "A verb with `permiso` must not declare a permission gap",
      });
    }

    // 5. publica => devuelveDatosDeNegocio === false (criterion 4).
    if (
      entry.clasificacion === "publica" &&
      entry.devuelveDatosDeNegocio !== false
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["devuelveDatosDeNegocio"],
        message: "A `publica` entry may never return data of a `Negocio`",
      });
    }

    // 6. desprotegida => corregidaPor === null.
    if (entry.clasificacion === "desprotegida" && entry.corregidaPor !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["corregidaPor"],
        message: "A `desprotegida` entry cannot claim to have been corrected",
      });
    }
  });

export const routeGuardInventorySchema = z
  .array(routeGuardEntrySchema)
  .superRefine((entries, ctx) => {
    // 7. The (route, verb) pair is unique across the whole array.
    const seen = new Set<string>();

    entries.forEach((entry, index) => {
      const key = `${entry.route}#${entry.verb}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [index],
          message: `Duplicate inventory entry for ${key}`,
        });
      }
      seen.add(key);
    });
  });

export type IRouteGuardEntry = z.infer<typeof routeGuardEntrySchema>;
export type IRouteGuardInventory = z.infer<typeof routeGuardInventorySchema>;
export type IRouteGuardVerb = (typeof ROUTE_GUARD_VERBS)[number];
