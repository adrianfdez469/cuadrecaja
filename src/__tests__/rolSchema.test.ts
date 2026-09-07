import { describe, expect, it } from "vitest";
import { createRolSchema, updateRolSchema } from "@/schemas/rol";

describe("createRolSchema", () => {
  const base = { nombre: "Cajero", permisos: "pos.vender" };

  it("accepts a role without isGlobal and leaves it undefined", () => {
    const parsed = createRolSchema.parse(base);
    expect(parsed.isGlobal).toBeUndefined();
  });

  it("accepts isGlobal true, the superadmin-only flag", () => {
    expect(createRolSchema.parse({ ...base, isGlobal: true }).isGlobal).toBe(
      true,
    );
  });

  it("rejects a non-boolean isGlobal", () => {
    expect(createRolSchema.safeParse({ ...base, isGlobal: "si" }).success).toBe(
      false,
    );
  });
});

describe("updateRolSchema", () => {
  it("accepts a partial update that only flips isGlobal", () => {
    const parsed = updateRolSchema.parse({ isGlobal: false });
    expect(parsed).toEqual({ isGlobal: false });
  });

  it("accepts an update that omits isGlobal, leaving the scope untouched", () => {
    const parsed = updateRolSchema.parse({ nombre: "Cajero" });
    expect(parsed.isGlobal).toBeUndefined();
  });

  it("rejects a non-boolean isGlobal", () => {
    expect(updateRolSchema.safeParse({ isGlobal: 1 }).success).toBe(false);
  });
});
