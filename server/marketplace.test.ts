import { describe, expect, it, vi } from "vitest";
import { CURRENT_TERMS_VERSION } from "../shared/const";

const authState = vi.hoisted(() => ({ accepted: true }));

vi.mock("./db", () => ({
  getDb: async () => ({
    select: () => ({
      from: () => ({ where: () => ({ limit: async () => [{ termsVersion: authState.accepted ? CURRENT_TERMS_VERSION : null, termsAcceptedAt: authState.accepted ? new Date() : null }] }) }),
    }),
  }),
}));

import { createListingInputSchema } from "./marketplace";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("marketplace access control", () => {
  it("allows browsing an individual listing route without a session (input is validated)", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.listings.byId({ id: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates chain search input before looking up announcements", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.chains.find({ listingId: 0 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires an authenticated account to publish an announcement", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.listings.create({
      title: "Livro para trocar",
      category: "Livros",
      description: "Em ótimo estado",
      condition: "Quase novo",
      wants: "Outro livro",
      location: "Centro, São Paulo",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("blocks private actions until the current policy version is accepted", async () => {
    authState.accepted = false;
    const now = new Date();
    const caller = appRouter.createCaller(createContext({
      id: 7,
      openId: "policy-gate-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    }));
    try {
      await expect(caller.marketplace.listings.mine()).rejects.toMatchObject({ code: "FORBIDDEN" });
    } finally {
      authState.accepted = true;
    }
  });

  it("accepts the footwear category, selected sizes, and new condition options", () => {
    const shoe = createListingInputSchema.safeParse({
      title: "Tênis para trocar",
      category: "Calçados",
      size: "37",
      description: "Pouco usado",
      condition: "Novo",
      wants: "Uma mochila",
      location: "Centro, São Paulo",
    });
    const clothing = createListingInputSchema.safeParse({
      title: "Blusa para trocar",
      category: "Roupas",
      size: "M",
      condition: "Usado, mas está bem",
      wants: "Uma bolsa",
      location: "Centro, São Paulo",
    });
    expect(shoe.success).toBe(true);
    expect(clothing.success).toBe(true);
    expect(createListingInputSchema.safeParse({
      title: "Tênis para trocar",
      category: "Calçados",
      size: "XXL",
      condition: "Quase novo",
      wants: "Uma mochila",
      location: "Centro, São Paulo",
    }).success).toBe(false);
  });

  it("requires a size when the category is clothing or footwear", async () => {
    const now = new Date();
    const caller = appRouter.createCaller(createContext({
      id: 7,
      openId: "size-validation-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    }));
    await expect(caller.marketplace.listings.create({
      title: "Blusa para trocar",
      category: "Roupas",
      description: "Em bom estado",
      condition: "Quase novo",
      wants: "Uma bolsa",
      location: "Centro, São Paulo",
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("requires an authenticated account to view private listings and swap conversations", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.listings.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.marketplace.listings.updateStatus({ id: 1, status: "paused" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.marketplace.proposals.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("requires an authenticated account to start a swap proposal", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.marketplace.proposals.create({
      listingId: 1,
      offeredItem: "Livro de poesia",
      message: "Oi! Gostaria de propor essa troca.",
    })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
