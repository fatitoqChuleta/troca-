import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { users } from "../drizzle/schema";
import { CURRENT_TERMS_VERSION } from "../shared/const";
import { getDb } from "./db";
import { authenticatedProcedure, router } from "./_core/trpc";

export const legalRouter = router({
  status: authenticatedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível verificar o aceite agora." });
    const [user] = await db.select({
      termsVersion: users.termsVersion,
      termsAcceptedAt: users.termsAcceptedAt,
    }).from(users).where(eq(users.id, ctx.user.id)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Conta não encontrada." });
    return {
      accepted: user.termsVersion === CURRENT_TERMS_VERSION && user.termsAcceptedAt !== null,
      acceptedAt: user.termsAcceptedAt,
      currentVersion: CURRENT_TERMS_VERSION,
    };
  }),

  accept: authenticatedProcedure
    .input(z.object({ agreed: z.literal(true) }))
    .mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar seu aceite agora." });
      const acceptedAt = new Date();
      await db.update(users).set({
        termsVersion: CURRENT_TERMS_VERSION,
        termsAcceptedAt: acceptedAt,
      }).where(eq(users.id, ctx.user.id));
      return { success: true, acceptedAt, version: CURRENT_TERMS_VERSION };
    }),
});
