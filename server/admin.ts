import { and, avg, count, desc, eq, inArray, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { exchangeMeetings, exchangeReports, exchangeReviews, listings, proposals, siteActivityEvents, users } from "../drizzle/schema";
import { createUserNotification, recordActivity } from "./activity";
import { getDb } from "./db";
import { adminProcedure, router } from "./_core/trpc";

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O painel Trocaí não está disponível agora. Tente de novo em instantes." });
  return db;
}

const openReportFilter = or(eq(exchangeReports.status, "open"), eq(exchangeReports.status, "under_review"));

export const adminRouter = router({
  overview: adminProcedure.query(async () => {
    const db = await requireDatabase();
    const [userCountRows, listingCountRows, reservedCountRows, proposalCountRows, events] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(listings).where(eq(listings.status, "active")),
      db.select({ value: count() }).from(listings).where(eq(listings.status, "reserved")),
      db.select({ value: count() }).from(proposals),
      db.select({
        id: siteActivityEvents.id,
        activityType: siteActivityEvents.activityType,
        summary: siteActivityEvents.summary,
        createdAt: siteActivityEvents.createdAt,
        actorId: siteActivityEvents.actorId,
        actorName: users.name,
        listingId: siteActivityEvents.listingId,
        listingTitle: listings.title,
        proposalId: siteActivityEvents.proposalId,
      })
        .from(siteActivityEvents)
        .leftJoin(users, eq(siteActivityEvents.actorId, users.id))
        .leftJoin(listings, eq(siteActivityEvents.listingId, listings.id))
        .orderBy(desc(siteActivityEvents.createdAt))
        .limit(75),
    ]);
    return {
      totals: {
        people: Number(userCountRows[0]?.value ?? 0),
        activeListings: Number(listingCountRows[0]?.value ?? 0),
        reservedListings: Number(reservedCountRows[0]?.value ?? 0),
        proposals: Number(proposalCountRows[0]?.value ?? 0),
      },
      events,
    };
  }),

  moderationQueue: adminProcedure.query(async ({ ctx }) => {
    const db = await requireDatabase();
    const reports = await db.select({
      id: exchangeReports.id,
      proposalId: exchangeReports.proposalId,
      reporterId: exchangeReports.reporterId,
      reportedUserId: exchangeReports.reportedUserId,
      reason: exchangeReports.reason,
      details: exchangeReports.details,
      status: exchangeReports.status,
      adminNote: exchangeReports.adminNote,
      createdAt: exchangeReports.createdAt,
      listingId: listings.id,
      listingTitle: listings.title,
    }).from(exchangeReports)
      .innerJoin(proposals, eq(exchangeReports.proposalId, proposals.id))
      .innerJoin(listings, eq(proposals.listingId, listings.id))
      .where(openReportFilter)
      .orderBy(desc(exchangeReports.createdAt))
      .limit(100);

    const [reportCounts, ratingStats, flaggedReviews] = await Promise.all([
      db.select({ userId: exchangeReports.reportedUserId, total: count() })
        .from(exchangeReports).where(openReportFilter).groupBy(exchangeReports.reportedUserId),
      db.select({ userId: exchangeReviews.revieweeId, total: count(), average: avg(exchangeReviews.rating) })
        .from(exchangeReviews).groupBy(exchangeReviews.revieweeId),
      db.select({ userId: exchangeReviews.revieweeId }).from(exchangeReviews)
        .where(or(eq(exchangeReviews.met, false), eq(exchangeReviews.itemMatched, false))),
    ]);
    const complaintCountByUser = new Map(reportCounts.map((row) => [row.userId, Number(row.total)]));
    const ratingByUser = new Map(ratingStats.map((row) => [row.userId, { total: Number(row.total), average: Number(row.average ?? 0) }]));
    const needsReview = new Set<number>();
    complaintCountByUser.forEach((total, userId) => { if (total >= 2) needsReview.add(userId); });
    ratingByUser.forEach((stats, userId) => { if (stats.total >= 5 && stats.average < 2) needsReview.add(userId); });
    for (const row of flaggedReviews) needsReview.add(row.userId);

    const allUserIds = Array.from(new Set([
      ...reports.flatMap((report) => [report.reporterId, report.reportedUserId]),
      ...Array.from(needsReview),
    ]));
    const userRows = allUserIds.length
      ? await db.select({ id: users.id, name: users.name, accountStatus: users.accountStatus, role: users.role })
          .from(users).where(inArray(users.id, allUserIds))
      : [];
    const usersById = new Map(userRows.map((user) => [user.id, user]));
    const proposalIds = Array.from(new Set(reports.map((report) => report.proposalId)));
    const meetingRows = proposalIds.length
      ? await db.select({
          proposalId: exchangeMeetings.proposalId,
          location: exchangeMeetings.location,
          scheduledAt: exchangeMeetings.scheduledAt,
          status: exchangeMeetings.status,
          createdAt: exchangeMeetings.createdAt,
        }).from(exchangeMeetings).where(inArray(exchangeMeetings.proposalId, proposalIds))
          .orderBy(desc(exchangeMeetings.createdAt))
      : [];
    const meetingByProposal = new Map<number, typeof meetingRows[number]>();
    for (const meeting of meetingRows) if (!meetingByProposal.has(meeting.proposalId)) meetingByProposal.set(meeting.proposalId, meeting);

    const cases = Array.from(needsReview).map((userId) => {
      const user = usersById.get(userId);
      const ratings = ratingByUser.get(userId) ?? { total: 0, average: 0 };
      const complaints = complaintCountByUser.get(userId) ?? 0;
      return {
        userId,
        name: user?.name || "Pessoa do Trocaí",
        accountStatus: user?.accountStatus || "active",
        averageRating: ratings.average || null,
        ratingCount: ratings.total,
        openReportCount: complaints,
        reason: complaints >= 2 ? "Duas ou mais denúncias abertas" : ratings.total >= 5 && ratings.average < 2 ? "Média abaixo de 2 após pelo menos 5 avaliações" : "Uma avaliação indicou que o encontro ou o item não correspondeu ao combinado",
      };
    });

    return {
      reports: reports.map((report) => ({
        ...report,
        reporterName: usersById.get(report.reporterId)?.name || "Pessoa do Trocaí",
        reportedName: usersById.get(report.reportedUserId)?.name || "Pessoa do Trocaí",
        listingTitle: report.listingTitle || "Item da troca",
        meeting: meetingByProposal.get(report.proposalId) ?? null,
      })),
      cases,
      currentAdminId: ctx.user.id,
    };
  }),

  updateReport: adminProcedure
    .input(z.object({
      reportId: z.number().int().positive(),
      status: z.enum(["under_review", "resolved", "rejected"]),
      adminNote: z.string().trim().max(1000).optional().default(""),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const [report] = await db.select({ id: exchangeReports.id, reporterId: exchangeReports.reporterId })
        .from(exchangeReports).where(eq(exchangeReports.id, input.reportId)).limit(1);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Esse relato não foi encontrado." });
      await db.transaction(async (tx) => {
        await tx.update(exchangeReports).set({
          status: input.status,
          reviewedById: ctx.user.id,
          adminNote: input.adminNote || null,
        }).where(eq(exchangeReports.id, input.reportId));
        await createUserNotification(tx, {
          recipientId: report.reporterId,
          actorId: ctx.user.id,
          kind: "report_updated",
          title: "A equipe atualizou seu relato",
          body: input.status === "under_review" ? "A equipe Trocaí está conferindo as informações que você enviou." : "A equipe Trocaí terminou de revisar seu relato. Se precisar, fale com a equipe pelo canal de contato do site.",
          href: "/perfil",
        });
      });
      return { success: true };
    }),

  setAccountStatus: adminProcedure
    .input(z.object({
      userId: z.number().int().positive(),
      status: z.enum(["active", "suspended", "banned"]),
      reason: z.string().trim().min(8).max(500),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "A equipe não pode alterar o próprio acesso por aqui." });
      const [target] = await db.select({ id: users.id, name: users.name, role: users.role })
        .from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "Essa conta não foi encontrada." });
      if (target.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Contas da equipe não podem ser moderadas por este painel." });
      await db.transaction(async (tx) => {
        await tx.update(users).set({
          accountStatus: input.status,
          accountStatusNote: input.reason,
          accountStatusUpdatedAt: new Date(),
          accountStatusUpdatedBy: ctx.user.id,
        }).where(eq(users.id, input.userId));
        await createUserNotification(tx, {
          recipientId: input.userId,
          actorId: ctx.user.id,
          kind: "account_status_changed",
          title: input.status === "active" ? "Seu acesso ao Trocaí foi atualizado" : "A equipe revisou sua conta",
          body: input.status === "active" ? "Sua conta está liberada para usar o Trocaí novamente." : `A equipe definiu o acesso da sua conta como ${input.status === "suspended" ? "suspenso" : "bloqueado"}. Motivo: ${input.reason}`,
          href: "/perfil",
        });
        try {
          await recordActivity(tx, {
            activityType: "account_moderated",
            actorId: ctx.user.id,
            summary: `A equipe alterou o acesso de ${target.name || "uma pessoa"} para ${input.status}.`,
          });
        } catch (error) {
          console.error("[Activity] Could not save the moderation event:", error);
        }
      });
      return { success: true };
    }),
});
