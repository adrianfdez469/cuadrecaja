import { describe, expect, it } from "vitest";
import {
  CLIENTE_TELEFONO_MESSAGE,
  CLIENTE_TELEFONO_REGEX,
  hasClienteTelefonoError,
  isValidClienteTelefono,
  normalizeClienteTelefono,
  sanitizeClienteTelefono,
} from "@/lib/clientes/clienteTelefono";
import {
  createClienteSchema,
  updateClienteSchema,
} from "@/schemas/cliente";

/** The valid body every schema case starts from; only `telefono` varies. */
const baseBody = { nombre: "Ana Pérez" };

describe("isValidClienteTelefono — the full pattern", () => {
  it("accepts a single local number and one with a country prefix", () => {
    expect(isValidClienteTelefono("533334449")).toBe(true);
    expect(isValidClienteTelefono("+5353334449")).toBe(true);
  });

  it("accepts several numbers separated by commas, with or without +", () => {
    expect(isValidClienteTelefono("+5353334449,534319958")).toBe(true);
    expect(isValidClienteTelefono("533334449,+534319958")).toBe(true);
  });

  it("accepts the empty string — the field is optional", () => {
    expect(isValidClienteTelefono("")).toBe(true);
  });

  it("rejects the legacy format with spaces, and every other separator that is not a comma", () => {
    expect(isValidClienteTelefono("+53 5 3334 449")).toBe(false);
    expect(isValidClienteTelefono("5333-4449")).toBe(false);
    expect(isValidClienteTelefono("(53)53334449")).toBe(false);
    expect(isValidClienteTelefono("53334449.534319958")).toBe(false);
  });

  it("rejects malformed commas: leading, trailing, doubled", () => {
    expect(isValidClienteTelefono(",533344449")).toBe(false);
    expect(isValidClienteTelefono("533344449,")).toBe(false);
    expect(isValidClienteTelefono("53,,33")).toBe(false);
  });

  it("rejects a + anywhere but the head of a number, and any letter", () => {
    expect(isValidClienteTelefono("5+3")).toBe(false);
    expect(isValidClienteTelefono("+")).toBe(false);
    expect(isValidClienteTelefono("5333a")).toBe(false);
  });

  it("the regex is anchored: a valid value buried in garbage does not pass", () => {
    expect(CLIENTE_TELEFONO_REGEX.test("x+5353334449")).toBe(false);
  });
});

describe("sanitizeClienteTelefono — what the field tolerates while typing", () => {
  it("rewrites the legacy stored format into the rule's format", () => {
    expect(sanitizeClienteTelefono("+53 5 3334 449")).toBe("+5353334449");
  });

  it("drops every character that is not a digit, a + or a comma", () => {
    expect(sanitizeClienteTelefono("a5b3c")).toBe("53");
    expect(sanitizeClienteTelefono("abc")).toBe("");
  });

  it("keeps a + only at the head of a number, even before its first digit arrives", () => {
    expect(sanitizeClienteTelefono("++53")).toBe("+53");
    expect(sanitizeClienteTelefono("5+3")).toBe("53");
    expect(sanitizeClienteTelefono("+")).toBe("+");
  });

  it("collapses comma runs and never leaves a leading comma", () => {
    expect(sanitizeClienteTelefono("5,,3")).toBe("5,3");
    expect(sanitizeClienteTelefono(",5")).toBe("5");
  });

  it("keeps a trailing comma — the user is starting the next number", () => {
    expect(sanitizeClienteTelefono("5,")).toBe("5,");
  });
});

describe("hasClienteTelefonoError — the field-level signal", () => {
  it("errors on a + that no digit follows, including while it opens the value", () => {
    expect(hasClienteTelefonoError("+")).toBe(true);
    expect(hasClienteTelefonoError("5,+")).toBe(true);
    expect(hasClienteTelefonoError("+,")).toBe(true);
    expect(hasClienteTelefonoError("5,+,5")).toBe(true);
  });

  it("stays quiet while a digit does follow the +, or the value is empty", () => {
    expect(hasClienteTelefonoError("")).toBe(false);
    expect(hasClienteTelefonoError("+5")).toBe(false);
    expect(hasClienteTelefonoError("+5353334449,534319958")).toBe(false);
  });

  it("tolerates a single trailing comma — the user is opening the next number", () => {
    expect(hasClienteTelefonoError("5,")).toBe(false);
    expect(hasClienteTelefonoError("+5,")).toBe(false);
  });
});

describe("normalizeClienteTelefono — what gets persisted", () => {
  it("drops the trailing comma of a number left half-typed", () => {
    expect(normalizeClienteTelefono("5,")).toBe("5");
    expect(normalizeClienteTelefono("533344449,")).toBe("533344449");
  });

  it("drops a + that no digit follows, wherever it sits", () => {
    expect(normalizeClienteTelefono("+")).toBe("");
    expect(normalizeClienteTelefono("5,+")).toBe("5");
    expect(normalizeClienteTelefono("5,+,5")).toBe("5,5");
  });

  it("turns a value with no digits left into the empty string", () => {
    expect(normalizeClienteTelefono(",")).toBe("");
    expect(normalizeClienteTelefono("++")).toBe("");
  });

  it("every value it returns passes isValidClienteTelefono, or is empty", () => {
    const inputs = ["+53 5 3334 449", "5,", ",,5,,3,,", "5+3,,+7", "a,b,c"];
    for (const input of inputs) {
      const output = normalizeClienteTelefono(input);
      expect(isValidClienteTelefono(output), `"${input}" -> "${output}"`).toBe(
        true,
      );
    }
  });
});

describe("createClienteSchema / updateClienteSchema — the rule on the server side", () => {
  it("accepts a comma-separated phone on create", () => {
    const parsed = createClienteSchema.safeParse({
      ...baseBody,
      telefono: "+5353334449,534319958",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a phone with spaces on create, with the rule's message", () => {
    const parsed = createClienteSchema.safeParse({
      ...baseBody,
      telefono: "+53 5 3334 449",
    });
    expect(parsed.success).toBe(false);
    expect(
      parsed.success === false &&
        parsed.error.issues[0].message === CLIENTE_TELEFONO_MESSAGE,
    ).toBe(true);
  });

  it("the partial update schema inherits the rule, and a body without telefono still parses", () => {
    expect(
      updateClienteSchema.safeParse({ telefono: "5333 4449" }).success,
    ).toBe(false);
    expect(updateClienteSchema.safeParse({ telefono: "+5353334449" }).success).toBe(
      true,
    );
    expect(updateClienteSchema.safeParse({}).success).toBe(true);
  });
});
