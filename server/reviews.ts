import { and, count, desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { exchangeReviews, listings, proposals } from "../drizzle/schema";
import { createUserNotification, recordActivity } from "./activity";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O Trocaí não conseguiu acessar os dados agora. Tente de novo." });
  return db;
}

async function getParticipantThread(db: Awaited<ReturnType<typeof requireDatabase>>, proposalId: number, userId: number) {
  const [thread] = await db.select({
    id: proposals.id,
    ownerId: proposals.ownerId,
    proposerId: proposals.proposerId,
    listingId: proposals.listingId,
    listingTitle: listings.title,
    status: proposals.status,
  })
    .from(proposals)
    .innerJoin(listings, eq(proposals.listingId, listings.id))
    .where(eq(proposals.id, proposalId))
    .limit(1);
  if (!thread || (thread.ownerId !== userId && thread.proposerId !== userId)) return undefined;
  return thread;
}

export const reviewsRouter = router({
  forProposal: protectedProcedure
    .input(z.object({ proposalId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const thread = await getParticipantThread(db, input.proposalId, ctx.user.id);
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Troca não encontrada." });
      const rows = await db.select({
        id: exchangeReviews.id,
        proposalId: exchangeReviews.proposalId,
        reviewerId: exchangeReviews.reviewerId,
        revieweeId: exchangeReviews.revieweeId,
        rating: exchangeReviews.rating,
        met: exchangeReviews.met,
        itemMatched: exchangeReviews.itemMatched,
        comment: exchangeReviews.comment,
        createdAt: exchangeReviews.createdAt,
      }).from(exchangeReviews).where(eq(exchangeReviews.proposalId, input.proposalId));
      const myReview = rows.find((review) => review.reviewerId === ctx.user.id) ?? null;
      const otherReview = rows.length >= 2 ? rows.find((review) => review.reviewerId !== ctx.user.id) ?? null : null;
      return { status: thread.status, myReview, otherReview, waitingForOther: Boolean(myReview && !otherReview) };
    }),

  submit: protectedProcedure
    .input(z.object({
      proposalId: z.number().int().positive(),
      rating: z.number().int().min(1).max(5),
      met: z.boolean(),
      itemMatched: z.boolean(),
      comment: z.string().trim().max(1000).optional().default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const thread = await getParticipantThread(db, input.proposalId, ctx.user.id);
      if (!thread) throw new TRPCError({ code: "NOT_FOUND", message: "Troca não encontrada." });
      if (thread.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "A avaliação fica disponível depois que as duas pessoas confirmarem a troca." });
      const revieweeId = thread.ownerId === ctx.user.id ? thread.proposerId : thread.ownerId;
      const alreadyReviewed = await db.select({ id: exchangeReviews.id }).from(exchangeReviews)
        .where(and(eq(exchangeReviews.proposalId, input.proposalId), eq(exchangeReviews.reviewerId, ctx.user.id)))
        .limit(1);
      if (alreadyReviewed.length) throw new TRPCError({ code: "CONFLICT", message: "Você já enviou sua avaliação para esta troca." });

      await db.transaction(async (tx) => {
        await tx.insert(exchangeReviews).values({
          proposalId: input.proposalId,
          reviewerId: ctx.user.id,
          revieweeId,
          rating: input.rating,
          met: input.met,
          itemMatched: input.itemMatched,
          comment: input.comment || null,
        });
        const otherReview = await tx.select({ id: exchangeReviews.id }).from(exchangeReviews)
          .where(and(eq(exchangeReviews.proposalId, input.proposalId), eq(exchangeReviews.reviewerId, revieweeId)))
          .limit(1);
        if (otherReview.length) {
          for (const recipientId of [ctx.user.id, revieweeId]) {
            await createUserNotification(tx, {
              recipientId,
              actorId: ctx.user.id,
              listingId: thread.listingId,
              proposalId: input.proposalId,
              kind: "reviews_published",
              title: "As avaliações da troca estão prontas",
              body: `As duas pessoas avaliaram a troca de ${thread.listingTitle}. Veja o resultado no seu perfil.`,
              href: "/perfil",
            });
          }
        } else {
          await createUserNotification(tx, {
            recipientId: revieweeId,
            actorId: ctx.user.id,
            listingId: thread.listingId,
            proposalId: input.proposalId,
            kind: "review_pending",
            title: "Sua avaliação ainda falta",
            body: "A outra pessoa já enviou o retorno. Avalie também para liberar as duas avaliações.",
            href: `/produto/${thread.listingId}`,
          });
        }
        try {
          await recordActivity(tx, {
            activityType: "review_submitted",
            actorId: ctx.user.id,
            listingId: thread.listingId,
            proposalId: input.proposalId,
            summary: `Uma avaliação foi enviada após a troca de ${thread.listingTitle}.`,
          });
        } catch (error) {
          console.error("[Activity] Could not save the review event:", error);
        }
      });
      return { success: true };
    }),

  mySummary: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDatabase();
    const rows = await db.select({
      proposalId: exchangeReviews.proposalId,
      rating: exchangeReviews.rating,
      met: exchangeReviews.met,
      itemMatched: exchangeReviews.itemMatched,
      comment: exchangeReviews.comment,
      createdAt: exchangeReviews.createdAt,
    }).from(exchangeReviews)
      .where(eq(exchangeReviews.revieweeId, ctx.user.id))
      .orderBy(desc(exchangeReviews.createdAt));
    if (!rows.length) return { average: null, count: 0, reviews: [] };
    const counts = await db.select({ proposalId: exchangeReviews.proposalId, total: count() })
      .from(exchangeReviews)
      .where(inArray(exchangeReviews.proposalId, Array.from(new Set(rows.map((row) => row.proposalId)))))
      .groupBy(exchangeReviews.proposalId);
    const publicProposalIds = new Set(counts.filter((row) => Number(row.total) >= 2).map((row) => row.proposalId));
    const reviews = rows.filter((row) => publicProposalIds.has(row.proposalId));
    const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
    return { average, count: reviews.length, reviews };
  }),

  publicSummary: protectedProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .query(async ({ input }) => {
      const db = await requireDatabase();
      const rows = await db.select({ proposalId: exchangeReviews.proposalId, rating: exchangeReviews.rating })
        .from(exchangeReviews).where(eq(exchangeReviews.revieweeId, input.userId));
      if (!rows.length) return { average: null, count: 0 };
      const counts = await db.select({ proposalId: exchangeReviews.proposalId, total: count() })
        .from(exchangeReviews)
        .where(inArray(exchangeReviews.proposalId, Array.from(new Set(rows.map((row) => row.proposalId)))))
        .groupBy(exchangeReviews.proposalId);
      const bothRated = new Set(counts.filter((row) => Number(row.total) >= 2).map((row) => row.proposalId));
      const publicRows = rows.filter((row) => bothRated.has(row.proposalId));
      const average = publicRows.length ? publicRows.reduce((sum, review) => sum + review.rating, 0) / publicRows.length : null;
      return { average, count: publicRows.length };
    }),
});
