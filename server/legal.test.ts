import { beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENT_TERMS_VERSION } from "../shared/const";

const state = vi.hoisted(() => ({
  record: { termsVersion: null as string | null, termsAcceptedAt: null as Date | null },
  updated: undefined as Record<string, unknown> | undefined,
}));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [state.record] }),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          state.updated = values;
          Object.assign(state.record, values);
          return { affectedRows: 1 };
        },
      }),
    }),
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeContext(authenticated = true): TrpcContext {
  const now = new Date();
  return {
    user: authenticated ? {
      id: 42,
      openId: "policy-test-user",
      name: "Pessoa teste",
      email: "policy@example.test",
      loginMethod: "test",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

beforeEach(() => {
  state.record.termsVersion = null;
  state.record.termsAcceptedAt = null;
  state.updated = undefined;
});

describe("legal", () => {
  it("mostra que uma conta sem aceite ainda precisa ler as políticas", async () => {
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.legal.status()).resolves.toMatchObject({
      accepted: false,
      currentVersion: CURRENT_TERMS_VERSION,
      acceptedAt: null,
    });
  });

  it("registra no banco a versão e o horário quando a pessoa aceita", async () => {
    const caller = appRouter.createCaller(makeContext());
    const result = await caller.legal.accept({ agreed: true });

    expect(result).toMatchObject({ success: true, version: CURRENT_TERMS_VERSION });
    expect(result.acceptedAt).toBeInstanceOf(Date);
    expect(state.updated).toEqual({ termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: result.acceptedAt });
    await expect(caller.legal.status()).resolves.toMatchObject({ accepted: true, currentVersion: CURRENT_TERMS_VERSION });
  });

  it("não permite consultar ou aceitar sem uma conta conectada", async () => {
    const caller = appRouter.createCaller(makeContext(false));
    await expect(caller.legal.status()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.legal.accept({ agreed: true })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
