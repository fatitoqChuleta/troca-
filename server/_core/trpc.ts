import { CURRENT_TERMS_VERSION, NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const authenticatedProcedure = t.procedure.use(requireUser);

const requireActiveAccount = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível conferir o estado da sua conta." });
  const [account] = await db.select({ accountStatus: users.accountStatus }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
  if (account?.accountStatus === "suspended") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Sua conta está temporariamente suspensa após uma revisão da equipe Trocaí." });
  }
  if (account?.accountStatus === "banned") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta conta foi bloqueada após uma revisão da equipe Trocaí." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

const requireAcceptedPolicies = t.middleware(async opts => {
  const { ctx, next } = opts;
  const user = ctx.user;
  if (!user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível verificar o aceite das políticas." });
  }
  const [account] = await db.select({
    termsVersion: users.termsVersion,
    termsAcceptedAt: users.termsAcceptedAt,
  }).from(users).where(eq(users.id, user.id)).limit(1);
  if (account?.termsVersion !== CURRENT_TERMS_VERSION || !account.termsAcceptedAt) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Leia e aceite as políticas do Trocaí para continuar." });
  }
  return next({ ctx: { ...ctx, user } });
});

export const protectedProcedure = authenticatedProcedure.use(requireActiveAccount).use(requireAcceptedPolicies);

const requireAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;
  const user = ctx.user;
  if (!user || user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user } });
});

export const adminProcedure = authenticatedProcedure.use(requireActiveAccount).use(requireAdmin).use(requireAcceptedPolicies);
