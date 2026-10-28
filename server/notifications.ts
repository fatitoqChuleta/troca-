import { and, count, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { userNotifications } from "../drizzle/schema";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new Error("Os avisos não estão disponíveis agora. Tente de novo em instantes.");
  return db;
}

export const notificationsRouter = router({
  mine: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDatabase();
    return db
      .select({
        id: userNotifications.id,
        kind: userNotifications.kind,
        title: userNotifications.title,
        body: userNotifications.body,
        href: userNotifications.href,
        readAt: userNotifications.readAt,
        createdAt: userNotifications.createdAt,
        listingId: userNotifications.listingId,
        proposalId: userNotifications.proposalId,
      })
      .from(userNotifications)
      .where(eq(userNotifications.recipientId, ctx.user.id))
      .orderBy(desc(userNotifications.createdAt))
      .limit(50);
  }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const db = await requireDatabase();
    const [row] = await db
      .select({ value: count() })
      .from(userNotifications)
      .where(and(eq(userNotifications.recipientId, ctx.user.id), isNull(userNotifications.readAt)));
    return Number(row?.value ?? 0);
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      await db
        .update(userNotifications)
        .set({ readAt: new Date() })
        .where(and(
          eq(userNotifications.id, input.id),
          eq(userNotifications.recipientId, ctx.user.id),
          isNull(userNotifications.readAt),
        ));
      return { success: true } as const;
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await requireDatabase();
    await db
      .update(userNotifications)
      .set({ readAt: new Date() })
      .where(and(eq(userNotifications.recipientId, ctx.user.id), isNull(userNotifications.readAt)));
    return { success: true } as const;
  }),
});
