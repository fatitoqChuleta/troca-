import { desc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { exchangeMeetings, listingReservations, listings, messages, proposals } from "../drizzle/schema";
import { createUserNotification, recordActivity } from "./activity";
import { getDb } from "./db";
import { protectedProcedure, router } from "./_core/trpc";

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O Trocaí não conseguiu acessar os dados agora. Tente de novo." });
  return db;
}

async function getThread(db: Awaited<ReturnType<typeof requireDatabase>>, proposalId: number) {
  const [thread] = await db.select({
    id: proposals.id,
    ownerId: proposals.ownerId,
    proposerId: proposals.proposerId,
    listingId: proposals.listingId,
    listingTitle: listings.title,
    offeredListingId: proposals.offeredListingId,
    status: proposals.status,
  })
    .from(proposals)
    .innerJoin(listings, eq(proposals.listingId, listings.id))
    .where(eq(proposals.id, proposalId))
    .limit(1);
  return thread;
}

const meetingFields = {
  id: exchangeMeetings.id,
  proposalId: exchangeMeetings.proposalId,
  proposedById: exchangeMeetings.proposedById,
  location: exchangeMeetings.location,
  scheduledAt: exchangeMeetings.scheduledAt,
  status: exchangeMeetings.status,
  ownerAcceptedAt: exchangeMeetings.ownerAcceptedAt,
  proposerAcceptedAt: exchangeMeetings.proposerAcceptedAt,
  createdAt: exchangeMeetings.createdAt,
  updatedAt: exchangeMeetings.updatedAt,
};

export const meetingsRouter = router({
  get: protectedProcedure
    .input(z.object({ proposalId: z.number().int().positive() }))
    .query(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const thread = await getThread(db, input.proposalId);
      if (!thread || (thread.ownerId !== ctx.user.id && thread.proposerId !== ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
      }
      const history = await db.select(meetingFields)
        .from(exchangeMeetings)
        .where(eq(exchangeMeetings.proposalId, input.proposalId))
        .orderBy(desc(exchangeMeetings.createdAt))
        .limit(20);
      return { current: history.find((meeting) => meeting.status !== "cancelled") ?? null, history };
    }),

  propose: protectedProcedure
    .input(z.object({
      proposalId: z.number().int().positive(),
      location: z.string().trim().min(5).max(255),
      scheduledAt: z.date(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const thread = await getThread(db, input.proposalId);
      if (!thread || (thread.ownerId !== ctx.user.id && thread.proposerId !== ctx.user.id)) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
      }
      if (thread.status !== "accepted") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Primeiro, a pessoa anunciante precisa aceitar a proposta." });
      }
      const now = new Date();
      if (input.scheduledAt.getTime() < now.getTime() + 15 * 60_000 || input.scheduledAt.getTime() > now.getTime() + 90 * 24 * 60 * 60_000) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um horário entre 15 minutos e 90 dias a partir de agora." });
      }

      const recipientId = thread.ownerId === ctx.user.id ? thread.proposerId : thread.ownerId;
      const created = await db.transaction(async (tx) => {
        const previous = await tx.select({ id: exchangeMeetings.id, status: exchangeMeetings.status })
          .from(exchangeMeetings)
          .where(eq(exchangeMeetings.proposalId, input.proposalId))
          .orderBy(desc(exchangeMeetings.createdAt))
          .limit(1);
        if (previous[0] && previous[0].status !== "cancelled") {
          await tx.update(exchangeMeetings).set({ status: "cancelled" }).where(eq(exchangeMeetings.id, previous[0].id));
        }
        const isOwner = thread.ownerId === ctx.user.id;
        const result = await tx.insert(exchangeMeetings).values({
          proposalId: input.proposalId,
          proposedById: ctx.user.id,
          location: input.location,
          scheduledAt: input.scheduledAt,
          status: "proposed",
          ownerAcceptedAt: isOwner ? now : null,
          proposerAcceptedAt: isOwner ? null : now,
        });
        const id = Number(result[0]?.insertId);
        if (!Number.isSafeInteger(id) || id < 1) throw new Error("Database did not return a saved meeting ID");
        await tx.insert(messages).values({
          proposalId: input.proposalId,
          senderId: ctx.user.id,
          content: `Sugeri um encontro em ${input.location}, para ${input.scheduledAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}. Confirme ou sugira outro horário.`,
        });
        await createUserNotification(tx, {
          recipientId,
          actorId: ctx.user.id,
          listingId: thread.listingId,
          proposalId: input.proposalId,
          kind: "meeting_proposed",
          title: "Tem uma sugestão de encontro",
          body: `Confira o local e o horário propostos para a troca de ${thread.listingTitle}.`,
          href: `/produto/${thread.listingId}`,
        });
        try {
          await recordActivity(tx, {
            activityType: "meeting_proposed",
            actorId: ctx.user.id,
            listingId: thread.listingId,
            proposalId: input.proposalId,
            summary: `Uma pessoa sugeriu um encontro para ${thread.listingTitle}.`,
          });
        } catch (error) {
          console.error("[Activity] Could not save the meeting event:", error);
        }
        return id;
      });
      return { id: created, success: true };
    }),

  respond: protectedProcedure
    .input(z.object({ proposalId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const result = await db.transaction(async (tx) => {
        const [thread] = await tx.select({
          id: proposals.id,
          ownerId: proposals.ownerId,
          proposerId: proposals.proposerId,
          listingId: proposals.listingId,
          listingTitle: listings.title,
          offeredListingId: proposals.offeredListingId,
          status: proposals.status,
        })
          .from(proposals)
          .innerJoin(listings, eq(proposals.listingId, listings.id))
          .where(eq(proposals.id, input.proposalId))
          .for("update")
          .limit(1);
        if (!thread || (thread.ownerId !== ctx.user.id && thread.proposerId !== ctx.user.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
        }
        if (thread.status !== "accepted") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta troca não está mais aberta para combinar encontro." });
        const latestRows = await tx.select({ id: exchangeMeetings.id })
          .from(exchangeMeetings)
          .where(eq(exchangeMeetings.proposalId, input.proposalId))
          .orderBy(desc(exchangeMeetings.createdAt))
          .limit(1);
        if (!latestRows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Ainda não há um encontro sugerido." });
        const [meeting] = await tx.select(meetingFields)
          .from(exchangeMeetings)
          .where(eq(exchangeMeetings.id, latestRows[0].id))
          .for("update")
          .limit(1);
        if (!meeting || meeting.status !== "proposed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Esse horário já foi confirmado ou substituído." });
        }
        const isOwner = thread.ownerId === ctx.user.id;
        const alreadyAccepted = isOwner ? meeting.ownerAcceptedAt : meeting.proposerAcceptedAt;
        if (alreadyAccepted) throw new TRPCError({ code: "BAD_REQUEST", message: "Você já confirmou. Agora falta a outra pessoa." });
        const ownerAcceptedAt = isOwner ? new Date() : meeting.ownerAcceptedAt;
        const proposerAcceptedAt = isOwner ? meeting.proposerAcceptedAt : new Date();
        const confirmed = Boolean(ownerAcceptedAt && proposerAcceptedAt);
        await tx.update(exchangeMeetings).set({
          ownerAcceptedAt,
          proposerAcceptedAt,
          status: confirmed ? "confirmed" : "proposed",
        }).where(eq(exchangeMeetings.id, meeting.id));

        if (confirmed) {
          const ids = Array.from(new Set([thread.listingId, ...(thread.offeredListingId ? [thread.offeredListingId] : [])])).sort((a, b) => a - b);
          const lockedListings = await tx.select({ id: listings.id, status: listings.status })
            .from(listings)
            .where(inArray(listings.id, ids))
            .for("update");
          if (lockedListings.length !== ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Um dos itens não está mais disponível." });
          const reservations = await tx.select({ listingId: listingReservations.listingId, proposalId: listingReservations.proposalId })
            .from(listingReservations)
            .where(inArray(listingReservations.listingId, ids))
            .for("update");
          const reservationByListing = new Map(reservations.map((reservation) => [reservation.listingId, reservation.proposalId]));
          for (const item of lockedListings) {
            const reservedFor = reservationByListing.get(item.id);
            if (reservedFor && reservedFor !== input.proposalId) {
              throw new TRPCError({ code: "CONFLICT", message: "Um dos itens já está reservado em outra troca." });
            }
            if (item.status === "reserved" && !reservedFor) {
              throw new TRPCError({ code: "CONFLICT", message: "Um dos itens está reservado, mas a equipe precisa conferir essa reserva antes." });
            }
            if (!["active", "paused", "reserved"].includes(item.status)) {
              throw new TRPCError({ code: "CONFLICT", message: "Um dos itens não pode mais ser reservado." });
            }
          }
          for (const item of lockedListings) {
            if (!reservationByListing.has(item.id)) {
              await tx.insert(listingReservations).values({
                listingId: item.id,
                proposalId: input.proposalId,
                previousStatus: item.status === "paused" ? "paused" : "active",
              });
            }
          }
          await tx.update(listings).set({ status: "reserved" }).where(inArray(listings.id, ids));
        }
        const participants = [thread.ownerId, thread.proposerId];
        for (const participantId of participants) {
          if (!confirmed && participantId === ctx.user.id) continue;
          await createUserNotification(tx, {
            recipientId: participantId,
            actorId: ctx.user.id,
            listingId: thread.listingId,
            proposalId: input.proposalId,
            kind: confirmed ? "meeting_confirmed" : "meeting_response",
            title: confirmed ? "Encontro marcado!" : "A outra pessoa respondeu ao encontro",
            body: confirmed
              ? `Encontro em ${meeting.location}, ${new Date(meeting.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}. Os anúncios ficam reservados até vocês concluírem ou sinalizarem um problema.`
              : `A outra pessoa confirmou o horário proposto para ${thread.listingTitle}.`,
            href: `/produto/${thread.listingId}`,
          });
        }
        if (confirmed) {
          try {
            await recordActivity(tx, {
              activityType: "meeting_confirmed",
              actorId: ctx.user.id,
              listingId: thread.listingId,
              proposalId: input.proposalId,
              summary: `As duas pessoas confirmaram o encontro de ${thread.listingTitle}.`,
            });
          } catch (error) {
            console.error("[Activity] Could not save the confirmed meeting event:", error);
          }
        }
        return { confirmed };
      });
      return { success: true, confirmed: result.confirmed };
    }),

  cancel: protectedProcedure
    .input(z.object({ proposalId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDatabase();
      const result = await db.transaction(async (tx) => {
        const [thread] = await tx.select({
          id: proposals.id,
          ownerId: proposals.ownerId,
          proposerId: proposals.proposerId,
          listingId: proposals.listingId,
          listingTitle: listings.title,
          status: proposals.status,
        }).from(proposals)
          .innerJoin(listings, eq(proposals.listingId, listings.id))
          .where(eq(proposals.id, input.proposalId))
          .for("update")
          .limit(1);
        if (!thread || (thread.ownerId !== ctx.user.id && thread.proposerId !== ctx.user.id)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Troca não encontrada." });
        }
        if (thread.status === "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Essa troca já foi concluída." });
        if (thread.status === "cancelled" || thread.status === "declined") return { alreadyClosed: true, otherUserId: thread.ownerId === ctx.user.id ? thread.proposerId : thread.ownerId, listingId: thread.listingId, title: thread.listingTitle };
        if (thread.status !== "accepted") throw new TRPCError({ code: "BAD_REQUEST", message: "Só uma troca aceita pode ser encerrada por aqui." });

        const reservationRows = await tx.select({ listingId: listingReservations.listingId, previousStatus: listingReservations.previousStatus })
          .from(listingReservations).where(eq(listingReservations.proposalId, input.proposalId)).for("update");
        for (const reservation of reservationRows) {
          await tx.update(listings).set({ status: reservation.previousStatus }).where(eq(listings.id, reservation.listingId));
        }
        if (reservationRows.length) await tx.delete(listingReservations).where(eq(listingReservations.proposalId, input.proposalId));
        await tx.update(exchangeMeetings).set({ status: "cancelled" }).where(eq(exchangeMeetings.proposalId, input.proposalId));
        await tx.update(proposals).set({ status: "cancelled" }).where(eq(proposals.id, input.proposalId));
        const otherUserId = thread.ownerId === ctx.user.id ? thread.proposerId : thread.ownerId;
        await tx.insert(messages).values({
          proposalId: input.proposalId,
          senderId: ctx.user.id,
          content: "Esta troca foi encerrada. Os anúncios voltaram a ficar disponíveis, se ainda estiverem ativos.",
        });
        await createUserNotification(tx, {
          recipientId: otherUserId,
          actorId: ctx.user.id,
          listingId: thread.listingId,
          proposalId: input.proposalId,
          kind: "swap_cancelled",
          title: "A troca foi encerrada",
          body: `A proposta para ${thread.listingTitle} foi encerrada. Os anúncios voltaram ao estado anterior, se ainda estiverem disponíveis.`,
          href: `/produto/${thread.listingId}`,
        });
        try {
          await recordActivity(tx, {
            activityType: "swap_cancelled",
            actorId: ctx.user.id,
            listingId: thread.listingId,
            proposalId: input.proposalId,
            summary: `Uma proposta de troca para ${thread.listingTitle} foi encerrada.`,
          });
        } catch (error) {
          console.error("[Activity] Could not save the cancelled swap event:", error);
        }
        return { alreadyClosed: false, otherUserId, listingId: thread.listingId, title: thread.listingTitle };
      });
      return { success: true, alreadyClosed: result.alreadyClosed };
    }),
});
