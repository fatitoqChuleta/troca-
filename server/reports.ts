import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { exchangeReports, listings, proposals } from "../drizzle/schema";
import { notifyOwnerSafely, recordActivity } from "./activity";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O Trocaí não conseguiu enviar seu relato agora. Tente de novo." });
  return db;
}

export const reportsRouter = router({
  status: protectedProcedure
    .input(z.object({ proposalId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const [report] = await db.select({ id: exchangeReports.id, status: exchangeReports.status, createdAt: exchangeReports.createdAt })
        .from(exchangeReports)
        .where(and(eq(exchangeReports.proposalId, input.proposalId), eq(exchangeReports.reporterId, ctx.user.id)))
        .limit(1);
      return report ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      proposalId: z.number().int().positive(),
      reason: z.enum(["no_show", "item_mismatch", "safety", "harassment", "suspected_fraud", "other"]),
      details: z.string().trim().min(10).max(2000),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const [thread] = await db.select({
        id: proposals.id,
        ownerId: proposals.ownerId,
        proposerId: proposals.proposerId,
        listingId: proposals.listingId,
        listingTitle: listings.title,
        status: proposals.status,
      }).from(proposals)
        .innerJoin(listings, eq(proposals.listingId, listings.id))
        .where(eq(proposals.id, input.proposalId))
        .limit(1);
      if (!thread || (thread.ownerId !== ctx.user.id && thread.proposerId !== ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Troca não encontrada." });
      }
      if (thread.status !== "accepted" && thread.status !== "completed" && thread.status !== "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Você pode relatar um problema depois que uma proposta for aceita." });
      }
      const reportedUserId = thread.ownerId === ctx.user.id ? thread.proposerId : thread.ownerId;
      const existing = await db.select({ id: exchangeReports.id }).from(exchangeReports)
        .where(and(eq(exchangeReports.proposalId, input.proposalId), eq(exchangeReports.reporterId, ctx.user.id)))
        .limit(1);
      if (existing.length) throw new TRPCError({ code: "CONFLICT", message: "Você já enviou um relato sobre esta troca. A equipe pode revisar o que você escreveu." });

      await db.transaction(async (tx) => {
        await tx.insert(exchangeReports).values({
          proposalId: input.proposalId,
          reporterId: ctx.user.id,
          reportedUserId,
          reason: input.reason,
          details: input.details,
          status: "open",
        });
        try {
          await recordActivity(tx, {
            activityType: "report_submitted",
            actorId: ctx.user.id,
            listingId: thread.listingId,
            proposalId: input.proposalId,
            summary: `Um relato de segurança foi enviado sobre uma troca de ${thread.listingTitle}.`,
          });
        } catch (error) {
          console.error("[Activity] Could not save the report event:", error);
        }
      });
      await notifyOwnerSafely("Um relato precisa de revisão", "Uma pessoa enviou um relato de segurança sobre uma troca no Trocaí. A equipe pode conferir no painel de administração.");
      return { success: true };
    }),
});
