import { describe, expect, it, vi } from "vitest";
import { CURRENT_TERMS_VERSION } from "../shared/const";

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date() }] }) }),
    }),
  }),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

const now = new Date();
const regularUser: NonNullable<TrpcContext["user"]> = {
  id: 10,
  openId: "regular-user",
  name: "Pessoa Trocaí",
  email: "person@example.test",
  loginMethod: "test",
  role: "user",
  createdAt: now,
  updatedAt: now,
  lastSignedIn: now,
};


describe("user notifications and admin access", () => {
  it("does not expose personal notifications without a session", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.notifications.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.notifications.markRead({ id: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.notifications.markAllRead()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects invalid notification IDs before accessing stored data", async () => {
    const caller = appRouter.createCaller(createContext(regularUser));
    await expect(caller.notifications.markRead({ id: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("does not let a regular user access owner activity", async () => {
    const caller = appRouter.createCaller(createContext(regularUser));
    await expect(caller.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
