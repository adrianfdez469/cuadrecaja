import { describe, it, expect, vi, afterEach } from "vitest";
import {
  qabProvisioningRequestSchema,
  qabProvisioningMintedResponseSchema,
  qabProvisioningAlreadyMintedResponseSchema,
  negocioQabProvisioningResultSchema,
  negocioQabProvisioningErrorSchema,
} from "@/schemas/qabProvisioning";
import {
  mapQabProvisioningResponse,
  mintQabBusinessCredential,
} from "@/lib/qab/qabProvisioningClient";
import { qabProvisioningCredentialUrl } from "@/lib/qab/qabProvisioningEnv";
import {
  QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH,
  QAB_PROVISIONING_NAME_MAX_LENGTH,
  QAB_PROVISIONING_UPSTREAM_CODES,
  QAB_PROVISIONING_RETRYABLE_CODES,
  QAB_PROVISIONING_RESULTS,
  QAB_TOKEN_MIN_LENGTH,
  QAB_TOKEN_MAX_LENGTH,
} from "@/constants/qabProvisioning";

/**
 * F-003 — the eighth route of the QAB contract (§ «Aprovisionamiento de negocios», v10).
 *
 * `src/schemas/qabProvisioning.ts` fixes the wire shapes; `src/lib/qab/qabProvisioningClient.ts`
 * (`mapQabProvisioningResponse`, pure, and `mintQabBusinessCredential`, HTTP with an
 * injectable `fetchImpl`) is where the ten-code vocabulary of ADR 0022 lives. The rule that
 * matters most here: NO status QAB returns is ever mirrored by this feature (ADR 0022) — every
 * upstream failure becomes `{ kind: "upstream_error" }` with the contract's own code in the
 * body, never a re-thrown HTTP status. Each fixture below carries a DIFFERENT status and a
 * DIFFERENT body so a broken mapping (e.g. one that ignores the body, or collapses every 503
 * into the same code) cannot pass by accident (see E-008).
 *
 * `expectedExternalId` is checked against BOTH bodies that carry an externalId — the 201's and
 * the 200's, not just the obviously dangerous one. A mismatched 200 asserts "this business
 * already has a token" for a business that never sent this externalId, which would fabricate a
 * CONFIRMED_ORPHANED diagnosis sourced from a stranger's row if left unchecked.
 */

const EXTERNAL_ID = "8f14e45f-ceea-467e-adc3-b1a4c0ea0a3e";
const VALID_TOKEN = "a".repeat(48); // the contract says the minted token is 48 characters

const validSettingsItem = {
  negocioId: EXTERNAL_ID,
  tiendaOnlineHabilitada: true,
  qabTokenConfigurado: true,
  qabTokenActualizadoAt: new Date("2026-09-03T10:00:00.000Z"),
};

describe("qabProvisioningRequestSchema", () => {
  it("should accept a request with only externalId", () => {
    const parsed = qabProvisioningRequestSchema.parse({ externalId: EXTERNAL_ID });
    expect(parsed).toEqual({ externalId: EXTERNAL_ID });
  });

  it("should accept a request with externalId and name", () => {
    const parsed = qabProvisioningRequestSchema.parse({
      externalId: EXTERNAL_ID,
      name: "Cafetería Central",
    });
    expect(parsed.name).toBe("Cafetería Central");
  });

  it("should trim externalId", () => {
    const parsed = qabProvisioningRequestSchema.parse({ externalId: `  ${EXTERNAL_ID}  ` });
    expect(parsed.externalId).toBe(EXTERNAL_ID);
  });

  it("should reject an externalId that is empty after trimming", () => {
    expect(qabProvisioningRequestSchema.safeParse({ externalId: "   " }).success).toBe(false);
  });

  it(`should reject an externalId longer than ${QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH} characters`, () => {
    expect(
      qabProvisioningRequestSchema.safeParse({
        externalId: "a".repeat(QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it(`should accept an externalId of exactly ${QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH} characters`, () => {
    expect(
      qabProvisioningRequestSchema.safeParse({
        externalId: "a".repeat(QAB_PROVISIONING_EXTERNAL_ID_MAX_LENGTH),
      }).success
    ).toBe(true);
  });

  it(`should reject a name longer than ${QAB_PROVISIONING_NAME_MAX_LENGTH} characters`, () => {
    expect(
      qabProvisioningRequestSchema.safeParse({
        externalId: EXTERNAL_ID,
        name: "a".repeat(QAB_PROVISIONING_NAME_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it("should reject a request missing externalId entirely", () => {
    expect(qabProvisioningRequestSchema.safeParse({ name: "Cafetería" }).success).toBe(false);
  });

  it("should reject an unrecognized key (.strict()) even when it looks like a typo of externalId", () => {
    // Simulates the exact typo the spec calls out: "external_id" instead of "externalId".
    // Whatever the reason Zod reports, this body must never validate.
    expect(
      qabProvisioningRequestSchema.safeParse({ external_id: EXTERNAL_ID }).success
    ).toBe(false);
  });

  it("should reject a well-formed body with one extra key", () => {
    expect(
      qabProvisioningRequestSchema.safeParse({ externalId: EXTERNAL_ID, extra: "surprise" })
        .success
    ).toBe(false);
  });
});

describe("qabProvisioningMintedResponseSchema", () => {
  const validMinted = {
    externalId: EXTERNAL_ID,
    created: true,
    minted: true as const,
    token: VALID_TOKEN,
  };

  it("should accept a well formed 201 body", () => {
    expect(qabProvisioningMintedResponseSchema.parse(validMinted)).toEqual(validMinted);
  });

  it("should NOT be strict: an unknown key QAB might add some day is silently dropped, not rejected", () => {
    const parsed = qabProvisioningMintedResponseSchema.parse({
      ...validMinted,
      futureField: "whatever QAB adds later",
    });
    expect(parsed).not.toHaveProperty("futureField");
    expect(parsed).toEqual(validMinted);
  });

  it("should reject minted: false (this schema is only for the 201)", () => {
    expect(
      qabProvisioningMintedResponseSchema.safeParse({ ...validMinted, minted: false }).success
    ).toBe(false);
  });

  it(`should reject a token shorter than ${QAB_TOKEN_MIN_LENGTH} characters`, () => {
    expect(
      qabProvisioningMintedResponseSchema.safeParse({
        ...validMinted,
        token: "a".repeat(QAB_TOKEN_MIN_LENGTH - 1),
      }).success
    ).toBe(false);
  });

  it(`should reject a token longer than ${QAB_TOKEN_MAX_LENGTH} characters`, () => {
    expect(
      qabProvisioningMintedResponseSchema.safeParse({
        ...validMinted,
        token: "a".repeat(QAB_TOKEN_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  // Header-injection regression: the second of the three places a bearer value can enter the
  // system (ADR 0026, point 4) — the token QAB hands back in the 201. Each case keeps the
  // length within bounds so only the pattern check can be responsible for the rejection.
  it("should reject a token with an internal newline", () => {
    const injected = "a".repeat(20) + "\n" + "a".repeat(27);
    expect(injected.length).toBeGreaterThanOrEqual(QAB_TOKEN_MIN_LENGTH);
    expect(
      qabProvisioningMintedResponseSchema.safeParse({ ...validMinted, token: injected }).success
    ).toBe(false);
  });

  it("should reject a token with an internal carriage return", () => {
    const injected = "a".repeat(20) + "\r" + "a".repeat(27);
    expect(
      qabProvisioningMintedResponseSchema.safeParse({ ...validMinted, token: injected }).success
    ).toBe(false);
  });

  it("should reject a token with an internal space", () => {
    const injected = "a".repeat(20) + " " + "a".repeat(27);
    expect(
      qabProvisioningMintedResponseSchema.safeParse({ ...validMinted, token: injected }).success
    ).toBe(false);
  });
});

describe("qabProvisioningAlreadyMintedResponseSchema", () => {
  const validAlreadyMinted = { externalId: EXTERNAL_ID, created: false, minted: false as const, token: null };

  it("should accept a well formed 200 body", () => {
    expect(qabProvisioningAlreadyMintedResponseSchema.parse(validAlreadyMinted)).toEqual(
      validAlreadyMinted
    );
  });

  it("should reject a non-null token: this shape means the token was never re-issued", () => {
    expect(
      qabProvisioningAlreadyMintedResponseSchema.safeParse({
        ...validAlreadyMinted,
        token: VALID_TOKEN,
      }).success
    ).toBe(false);
  });

  it("should reject created: true (that belongs to the minted shape)", () => {
    expect(
      qabProvisioningAlreadyMintedResponseSchema.safeParse({ ...validAlreadyMinted, created: true })
        .success
    ).toBe(false);
  });
});

describe("negocioQabProvisioningResultSchema", () => {
  it.each(QAB_PROVISIONING_RESULTS)("should accept result: %s", (result) => {
    expect(
      negocioQabProvisioningResultSchema.safeParse({
        result,
        createdInQab: false,
        settings: validSettingsItem,
      }).success
    ).toBe(true);
  });

  it("should hold exactly the three results, CONFIRMED_ORPHANED included", () => {
    expect([...QAB_PROVISIONING_RESULTS].sort()).toEqual(
      ["MINTED", "ALREADY_MINTED", "CONFIRMED_ORPHANED"].sort()
    );
  });

  it("should reject a result outside the enum", () => {
    expect(
      negocioQabProvisioningResultSchema.safeParse({
        result: "SUCCESS",
        createdInQab: false,
        settings: validSettingsItem,
      }).success
    ).toBe(false);
  });

  it("should be strict: reject a response that also carries a token", () => {
    expect(
      negocioQabProvisioningResultSchema.safeParse({
        result: "MINTED",
        createdInQab: true,
        settings: validSettingsItem,
        token: VALID_TOKEN,
      }).success
    ).toBe(false);
  });

  it("should never let the word token appear when serializing a valid parsed result", () => {
    const parsed = negocioQabProvisioningResultSchema.parse({
      result: "MINTED",
      createdInQab: true,
      settings: validSettingsItem,
    });
    expect(JSON.stringify(parsed)).not.toContain("token");
  });
});

describe("negocioQabProvisioningErrorSchema", () => {
  const validError = { error: "QAB_PROVISIONING_UPSTREAM", qabError: "BUSINESS_INACTIVE", retryable: false };

  it("should accept a well formed error body", () => {
    expect(negocioQabProvisioningErrorSchema.parse(validError)).toEqual(validError);
  });

  it("should accept a null qabError (errors that are not QAB's fault)", () => {
    expect(
      negocioQabProvisioningErrorSchema.safeParse({
        error: "FORBIDDEN",
        qabError: null,
        retryable: false,
      }).success
    ).toBe(true);
  });

  it.each(QAB_PROVISIONING_UPSTREAM_CODES)("should accept qabError: %s", (code) => {
    expect(
      negocioQabProvisioningErrorSchema.safeParse({
        error: "QAB_PROVISIONING_UPSTREAM",
        qabError: code,
        retryable: false,
      }).success
    ).toBe(true);
  });

  it("should reject an error code outside the seven of the contract", () => {
    expect(
      negocioQabProvisioningErrorSchema.safeParse({
        error: "UNKNOWN_ERROR",
        qabError: null,
        retryable: false,
      }).success
    ).toBe(false);
  });

  it("should be strict", () => {
    expect(
      negocioQabProvisioningErrorSchema.safeParse({ ...validError, extra: "x" }).success
    ).toBe(false);
  });
});

describe("mapQabProvisioningResponse", () => {
  it("should map a 201 with a matching externalId to kind: minted, carrying the token", () => {
    const outcome = mapQabProvisioningResponse({
      status: 201,
      bodyText: JSON.stringify({ externalId: EXTERNAL_ID, created: true, minted: true, token: VALID_TOKEN }),
      expectedExternalId: EXTERNAL_ID,
    });

    expect(outcome).toEqual({ kind: "minted", externalId: EXTERNAL_ID, created: true, token: VALID_TOKEN });
  });

  it("should map a 201 whose externalId does NOT match the one sent to EXTERNAL_ID_MISMATCH, never minted", () => {
    // The tenant-isolation guard: writing a token acquired for another business into this one
    // is the cross-tenant leak this feature cannot afford.
    const outcome = mapQabProvisioningResponse({
      status: 201,
      bodyText: JSON.stringify({
        externalId: "some-other-negocio-id",
        created: true,
        minted: true,
        token: VALID_TOKEN,
      }),
      expectedExternalId: EXTERNAL_ID,
    });

    expect(outcome.kind).toBe("upstream_error");
    if (outcome.kind === "upstream_error") {
      expect(outcome.code).toBe("EXTERNAL_ID_MISMATCH");
      // Retrying does not fix a mismatch, so it must not be offered as retryable.
      expect(outcome.retryable).toBe(false);
    }
  });

  it("should map a 200 idempotent body to kind: already_minted", () => {
    const outcome = mapQabProvisioningResponse({
      status: 200,
      bodyText: JSON.stringify({ externalId: EXTERNAL_ID, created: false, minted: false, token: null }),
      expectedExternalId: EXTERNAL_ID,
    });

    expect(outcome).toEqual({ kind: "already_minted", externalId: EXTERNAL_ID });
  });

  it("should NEVER produce kind: minted for a 200 (the contract never mints on 200)", () => {
    const outcome = mapQabProvisioningResponse({
      status: 200,
      bodyText: JSON.stringify({ externalId: EXTERNAL_ID, created: false, minted: false, token: null }),
      expectedExternalId: EXTERNAL_ID,
    });
    expect(outcome.kind).not.toBe("minted");
  });

  it("should map a 200 whose externalId does NOT match to EXTERNAL_ID_MISMATCH, never already_minted", () => {
    // The subtle half of the tenant-isolation guard: this body asserts "this business already
    // has a token". Accepting it for a business that did not send this externalId would
    // fabricate a CONFIRMED_ORPHANED diagnosis on OUR business, sourced from a stranger's row —
    // the single worst outcome in this feature, since it sends someone to request an
    // unnecessary credential rotation with cutover. The fixture below uses a DIFFERENT
    // externalId than the one sent, so a mapping that ignores the mismatch here (unlike the
    // already-tested 201 case) would be caught.
    const outcome = mapQabProvisioningResponse({
      status: 200,
      bodyText: JSON.stringify({
        externalId: "some-other-negocio-id",
        created: false,
        minted: false,
        token: null,
      }),
      expectedExternalId: EXTERNAL_ID,
    });

    expect(outcome.kind).toBe("upstream_error");
    if (outcome.kind === "upstream_error") {
      expect(outcome.code).toBe("EXTERNAL_ID_MISMATCH");
      expect(outcome.retryable).toBe(false);
    }
  });

  it("should NEVER produce kind: already_minted for a 200 with a mismatched externalId", () => {
    const outcome = mapQabProvisioningResponse({
      status: 200,
      bodyText: JSON.stringify({
        externalId: "some-other-negocio-id",
        created: false,
        minted: false,
        token: null,
      }),
      expectedExternalId: EXTERNAL_ID,
    });
    expect(outcome.kind).not.toBe("already_minted");
  });

  const upstreamCases: Array<[number, unknown, string, boolean]> = [
    [400, { error: "INVALID_BODY", issues: [{ path: ["externalId"], message: "Required" }] }, "INVALID_BODY", false],
    [401, { error: "UNAUTHORIZED" }, "UNAUTHORIZED", false],
    [403, { error: "BUSINESS_INACTIVE" }, "BUSINESS_INACTIVE", false],
    [405, "Method Not Allowed", "METHOD_NOT_ALLOWED", false],
    [503, { error: "PROVISIONING_NOT_CONFIGURED" }, "PROVISIONING_NOT_CONFIGURED", false],
    [503, { error: "TOKEN_COLLISION" }, "TOKEN_COLLISION", true],
  ];

  it.each(upstreamCases)(
    "should map HTTP %i %j to code %s (retryable: %s), never mirroring the status as a `kind`",
    (status, body, expectedCode, expectedRetryable) => {
      const bodyText = typeof body === "string" ? body : JSON.stringify(body);
      const outcome = mapQabProvisioningResponse({ status, bodyText, expectedExternalId: EXTERNAL_ID });

      expect(outcome.kind).toBe("upstream_error");
      if (outcome.kind === "upstream_error") {
        expect(outcome.code).toBe(expectedCode);
        expect(outcome.retryable).toBe(expectedRetryable);
      }
    }
  );

  it("should map an undocumented status (e.g. 500) to UNEXPECTED_STATUS, retryable", () => {
    const outcome = mapQabProvisioningResponse({
      status: 500,
      bodyText: "Internal Server Error",
      expectedExternalId: EXTERNAL_ID,
    });

    expect(outcome.kind).toBe("upstream_error");
    if (outcome.kind === "upstream_error") {
      expect(outcome.code).toBe("UNEXPECTED_STATUS");
      expect(outcome.retryable).toBe(true);
    }
  });

  it("should map a 201 whose body is not valid JSON to INVALID_RESPONSE_BODY, retryable", () => {
    const outcome = mapQabProvisioningResponse({
      status: 201,
      bodyText: "<not json>",
      expectedExternalId: EXTERNAL_ID,
    });

    expect(outcome.kind).toBe("upstream_error");
    if (outcome.kind === "upstream_error") {
      expect(outcome.code).toBe("INVALID_RESPONSE_BODY");
      expect(outcome.retryable).toBe(true);
    }
  });

  it("should map a 200 whose body does not match the idempotent shape to INVALID_RESPONSE_BODY", () => {
    const outcome = mapQabProvisioningResponse({
      status: 200,
      bodyText: JSON.stringify({ unexpected: "shape" }),
      expectedExternalId: EXTERNAL_ID,
    });

    expect(outcome.kind).toBe("upstream_error");
    if (outcome.kind === "upstream_error") {
      expect(outcome.code).toBe("INVALID_RESPONSE_BODY");
    }
  });

  it("should never throw, regardless of how malformed the input is", () => {
    expect(() =>
      mapQabProvisioningResponse({ status: 999, bodyText: "", expectedExternalId: EXTERNAL_ID })
    ).not.toThrow();
  });

  it("should hold exactly the four retryable codes: TOKEN_COLLISION, TRANSPORT, INVALID_RESPONSE_BODY, UNEXPECTED_STATUS", () => {
    expect([...QAB_PROVISIONING_RETRYABLE_CODES].sort()).toEqual(
      ["TOKEN_COLLISION", "TRANSPORT", "INVALID_RESPONSE_BODY", "UNEXPECTED_STATUS"].sort()
    );
  });

  it("should never leak the token into a non-minted outcome", () => {
    const outcome = mapQabProvisioningResponse({
      status: 401,
      bodyText: JSON.stringify({ error: "UNAUTHORIZED" }),
      expectedExternalId: EXTERNAL_ID,
    });
    expect(JSON.stringify(outcome)).not.toContain(VALID_TOKEN);
  });
});

describe("mintQabBusinessCredential", () => {
  const validSecret = "s3cr3t-" + "a".repeat(40);
  const baseUrl = "https://queandabuscando.example";

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("criterion 9 — should NEVER call fetchImpl when the secret is unusable, and return PROVISIONING_NOT_CONFIGURED", async () => {
    const fetchImpl = vi.fn();

    const outcome = await mintQabBusinessCredential({
      baseUrl,
      secret: "too-short",
      externalId: EXTERNAL_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      kind: "upstream_error",
      code: "PROVISIONING_NOT_CONFIGURED",
      retryable: false,
    });
  });

  it("criterion 9 (control) — DOES call fetchImpl exactly once with a usable secret, so the guard above is not vacuous", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ externalId: EXTERNAL_ID, created: true, minted: true, token: VALID_TOKEN }),
          { status: 201 }
        )
      );

    await mintQabBusinessCredential({
      baseUrl,
      secret: validSecret,
      externalId: EXTERNAL_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("should POST to qabProvisioningCredentialUrl(baseUrl) with the secret as bearer and a JSON body", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ externalId: EXTERNAL_ID, created: true, minted: true, token: VALID_TOKEN }),
          { status: 201 }
        )
      );

    await mintQabBusinessCredential({
      baseUrl,
      secret: validSecret,
      externalId: EXTERNAL_ID,
      name: "Cafetería Central",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(qabProvisioningCredentialUrl(baseUrl));
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: `Bearer ${validSecret}`,
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init.body)).toEqual({ externalId: EXTERNAL_ID, name: "Cafetería Central" });
  });

  it("should return INVALID_BODY and never call fetchImpl when the outgoing body is invalid", async () => {
    const fetchImpl = vi.fn();

    const outcome = await mintQabBusinessCredential({
      baseUrl,
      secret: validSecret,
      externalId: "   ", // blank after trim: invalid per qabProvisioningRequestSchema
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(outcome).toEqual({ kind: "upstream_error", code: "INVALID_BODY", retryable: false });
  });

  it("should resolve to kind: minted on a successful call", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ externalId: EXTERNAL_ID, created: true, minted: true, token: VALID_TOKEN }),
          { status: 201 }
        )
      );

    const outcome = await mintQabBusinessCredential({
      baseUrl,
      secret: validSecret,
      externalId: EXTERNAL_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(outcome).toEqual({ kind: "minted", externalId: EXTERNAL_ID, created: true, token: VALID_TOKEN });
  });

  it("should NEVER throw or reject: a network failure becomes kind: upstream_error, code: TRANSPORT", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(
      mintQabBusinessCredential({
        baseUrl,
        secret: validSecret,
        externalId: EXTERNAL_ID,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      })
    ).resolves.toEqual({ kind: "upstream_error", code: "TRANSPORT", retryable: true });
  });

  it("should never log anything (no console.log/error/warn) on a successful call", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ externalId: EXTERNAL_ID, created: true, minted: true, token: VALID_TOKEN }),
          { status: 201 }
        )
      );

    await mintQabBusinessCredential({
      baseUrl,
      secret: validSecret,
      externalId: EXTERNAL_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(logSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("should never leak the secret or the token into a rejected/thrown value or into the outcome on failure", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const outcome = await mintQabBusinessCredential({
      baseUrl,
      secret: validSecret,
      externalId: EXTERNAL_ID,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(JSON.stringify(outcome)).not.toContain(validSecret);
  });
});
