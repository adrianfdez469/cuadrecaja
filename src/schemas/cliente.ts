import { z } from "zod";
import {
  CONTROL_CHARACTERS_MESSAGE,
  hasControlCharacters,
} from "@/utils/printableText";
import {
  CLIENTE_TELEFONO_MESSAGE,
  isValidClienteTelefono,
} from "@/lib/clientes/clienteTelefono";

export const clienteSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, "El nombre es requerido").max(200, "Máximo 200 caracteres"),
  descripcion: z.string().max(300, "Máximo 300 caracteres").nullable().optional(),
  direccion: z.string().max(300, "Máximo 300 caracteres").nullable().optional(),
  telefono: z.string().max(40, "Máximo 40 caracteres").nullable().optional(),
  negocioId: z.string().uuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable().optional(),
});

export const createClienteSchema = z.object({
  nombre: z
    .string()
    .min(1, "El nombre es requerido")
    .max(200, "Máximo 200 caracteres")
    // Same bound and same reason as multimonedaExtrasSchema.clienteNombre: this column is
    // printed on a receipt, and the ESC/POS encoder does not escape ticket text (ADR 0120).
    // This is the OTHER writer of Cliente.nombre; closing one door and not the other would
    // fix nothing.
    .refine((value) => !hasControlCharacters(value), {
      message: CONTROL_CHARACTERS_MESSAGE,
    }),
  // descripcion and direccion: same bounds as clienteSchema.
  descripcion: z.string().max(300, "Máximo 300 caracteres").optional(),
  direccion: z.string().max(300, "Máximo 300 caracteres").optional(),
  // telefono: comma-separated phone numbers only (optional leading `+` per number). The
  // rule lives in ONE place — src/lib/clientes/clienteTelefono.ts — so both writing
  // surfaces and this schema cannot drift.
  telefono: z
    .string()
    .max(40, "Máximo 40 caracteres")
    .refine(isValidClienteTelefono, { message: CLIENTE_TELEFONO_MESSAGE })
    .optional(),
});

export const updateClienteSchema = createClienteSchema.partial();

export type ICliente = z.infer<typeof clienteSchema>;
export type ICreateCliente = z.infer<typeof createClienteSchema>;
export type IUpdateCliente = z.infer<typeof updateClienteSchema>;
