import { describe, expect, it } from "vitest";
import { darkTokens, lightTokens } from "@/theme/tokens";

/**
 * `sync.pending` is a role, not a colour: it resolves to the same ink as
 * `offline` on purpose. The test that matters is that it resolves at all —
 * a role added to the `SyncRole` type but not to the `syncRoles` map type-checks
 * clean and lands in the UI as `undefined`, which MUI renders as inherited
 * black with no warning. See `.agents/designs/estado-sin-conexion.md`.
 */
describe("semantic sync roles", () => {
  it.each([
    ["light", lightTokens],
    ["dark", darkTokens],
  ])("resolves every sync role in the %s scheme", (_name, tokens) => {
    const roles = [
      "online",
      "offline",
      "syncing",
      "failed",
      "pending",
    ] as const;
    roles.forEach((role) => {
      expect(tokens.sync[role]?.main).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  it.each([
    ["light", lightTokens],
    ["dark", darkTokens],
  ])("paints pending with the same ink as offline (%s)", (_name, tokens) => {
    expect(tokens.sync.pending.main).toBe(tokens.sync.offline.main);
    expect(tokens.sync.pending.main).toBe(tokens.hue.caution.main);
  });

  it("keeps offline apart from failed: being offline is not a failure", () => {
    expect(lightTokens.sync.offline.main).not.toBe(
      lightTokens.sync.failed.main,
    );
  });
});
