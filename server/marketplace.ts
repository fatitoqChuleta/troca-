import { and, asc, desc, eq, inArray, isNotNull, like, ne, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { exchangeMeetings, listingReservations, listings, messages, proposals, users } from "../drizzle/schema";
import { createUserNotification, notifyOwnerSafely, recordActivity } from "./activity";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { findExchangeChains } from "./chainFinder";
import { ENV } from "./_core/env";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { meetingsRouter } from "./meetings";
import { reportsRouter } from "./reports";
import { reviewsRouter } from "./reviews";

const categories = ["Livros", "Roupas", "Calçados", "Acessórios", "Eletrônicos", "Jogos", "Material escolar", "Colecionáveis", "Outros"] as const;
const conditions = ["Novo", "Quase novo", "Usado, mas está bem", "Usado, com algumas marcas", "Precisa de alguns cuidados"] as const;
const clothingSizes = ["PP", "P", "M", "G", "GG", "XGG", "34", "36", "38", "40", "42", "44", "46", "48", "50", "52", "54", "Tamanho único"];
const footwearSizes = Array.from({ length: 31 }, (_, index) => String(index + 20));

async function requireDatabase() {
  const db = await getDb();
  if (!db) throw new Error("O banco de dados não está disponível no momento.");
  return db;
}

const listingFields = {
  id: listings.id,
  title: listings.title,
  category: listings.category,
  size: listings.size,
  description: listings.description,
  condition: listings.condition,
  wants: listings.wants,
  location: listings.location,
  imageUrl: listings.imageUrl,
  status: listings.status,
  createdAt: listings.createdAt,
  ownerId: users.id,
  ownerName: users.name,
};

export const createListingInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  category: z.enum(categories),
  description: z.string().trim().max(4000).default(""),
  condition: z.enum(conditions),
  size: z.string().trim().min(1).max(40).optional(),
  wants: z.string().trim().min(2).max(255),
  location: z.string().trim().min(2).max(160),
  imageBase64: z.string().max(4_500_000).optional(),
  imageContentType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
}).superRefine((input, context) => {
  if (input.category === "Roupas" || input.category === "Calçados") {
    const options = input.category === "Calçados" ? footwearSizes : clothingSizes;
    if (!input.size) {
      context.addIssue({ code: "custom", path: ["size"], message: "Escolha um tamanho." });
    } else if (!options.includes(input.size)) {
      context.addIssue({ code: "custom", path: ["size"], message: "Escolha um tamanho da lista." });
    }
  }
});

export const marketplaceRouter = router({
  listings: router({
    list: publicProcedure
      .input(z.object({
        q: z.string().trim().max(120).optional(),
        category: z.enum(categories).optional(),
        condition: z.enum(conditions).optional(),
        location: z.string().trim().max(120).optional(),
        sort: z.enum(["recent", "az"]).optional(),
        mineOnly: z.boolean().optional(),
        page: z.number().int().min(1).max(1000).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
      }).optional())
      .query(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const page = input?.page ?? 1;
        const pageSize = input?.pageSize ?? 100;
        const filters = [or(eq(listings.status, "active"), eq(listings.status, "reserved"))!];
        if (input?.category) filters.push(eq(listings.category, input.category));
        if (input?.condition) {
          const legacyValues: Record<(typeof conditions)[number], string[]> = {
            "Novo": [],
            "Quase novo": ["Muito bom"],
            "Usado, mas está bem": ["Bom", "Usado, mas funcionando"],
            "Usado, com algumas marcas": [],
            "Precisa de alguns cuidados": [],
          };
          const matchingConditions = [input.condition, ...legacyValues[input.condition]];
          filters.push(or(...matchingConditions.map((condition) => eq(listings.condition, condition)))!);
        }
        if (input?.location) filters.push(like(listings.location, `%${input.location}%`));
        if (input?.q) {
          const term = `%${input.q.replace(/[\\%_]/g, "\\$&")}%`;
          filters.push(or(
            like(listings.title, term),
            like(listings.category, term),
            like(listings.description, term),
            like(listings.wants, term),
            like(listings.location, term),
          )!);
        }
        if (input?.mineOnly && ctx.user) filters.push(eq(listings.ownerId, ctx.user.id));
        const rows = await db.select(listingFields)
          .from(listings)
          .innerJoin(users, eq(listings.ownerId, users.id))
          .where(and(...filters))
          .orderBy(input?.sort === "az" ? asc(listings.title) : desc(listings.createdAt))
          .limit(pageSize + 1)
          .offset((page - 1) * pageSize);
        return {
          items: rows.slice(0, pageSize),
          hasMore: rows.length > pageSize,
          page,
          pageSize,
        };
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const [listing] = await db.select(listingFields)
          .from(listings)
          .innerJoin(users, eq(listings.ownerId, users.id))
          .where(eq(listings.id, input.id))
          .limit(1);
        if (!listing) return null;
        if (listing.status !== "active" && listing.status !== "reserved") {
          if (!ctx.user) return null;
          if (listing.ownerId !== ctx.user.id) {
            const [participant] = await db.select({ id: proposals.id })
              .from(proposals)
              .where(and(eq(proposals.listingId, listing.id), or(eq(proposals.ownerId, ctx.user.id), eq(proposals.proposerId, ctx.user.id))))
              .limit(1);
            if (!participant) return null;
          }
        }
        return listing;
      }),

    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDatabase();
      return db.select(listingFields)
        .from(listings)
        .innerJoin(users, eq(listings.ownerId, users.id))
        .where(and(eq(listings.ownerId, ctx.user.id), or(eq(listings.status, "active"), eq(listings.status, "paused"), eq(listings.status, "reserved"))))
        .orderBy(desc(listings.createdAt));
    }),

    create: protectedProcedure
      .input(createListingInputSchema)
      .mutation(async ({ input, ctx }) => {
        const db = await requireDatabase();
        let imageUrl: string | null = null;
        if (input.imageBase64) {
          if (!input.imageContentType) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha uma foto válida para o anúncio." });
          const bytes = Buffer.from(input.imageBase64, "base64");
          if (!bytes.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Não conseguimos ler essa foto. Escolha outra imagem." });
          if (bytes.length > 3 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "A foto deve ter até 3 MB." });
          const extension = input.imageContentType === "image/png" ? "png" : input.imageContentType === "image/webp" ? "webp" : "jpg";
          try {
            const uploaded = await storagePut(`trocai/listings/${ctx.user.id}/${Date.now()}.${extension}`, bytes, input.imageContentType);
            imageUrl = uploaded.url;
          } catch (error) {
            console.error("[Marketplace] Listing photo upload failed:", error);
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não deu para enviar a foto. Tente outra imagem ou publique sem foto." });
          }
        }
        let id: number;
        try {
          const result = await db.insert(listings).values({
            ownerId: ctx.user.id,
            title: input.title,
            category: input.category,
            size: input.size ?? null,
            description: input.description,
            condition: input.condition,
            wants: input.wants,
            location: input.location,
            imageUrl,
            status: "active",
          });
          id = Number(result[0]?.insertId);
          if (!Number.isSafeInteger(id) || id < 1) throw new Error("Database did not return a saved listing ID");
        } catch (error) {
          console.error("[Marketplace] Listing was not saved:", error);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Não foi possível salvar seu anúncio. Seus dados continuam no formulário; tente publicar de novo." });
        }

        try {
          await recordActivity(db, {
            activityType: "listing_published",
            actorId: ctx.user.id,
            listingId: id,
            summary: `Novo anúncio publicado: ${input.title}`,
          });
        } catch (error) {
          console.error("[Activity] Could not save the listing event:", error);
        }
        if (ctx.user.openId !== ENV.ownerOpenId) {
          await notifyOwnerSafely("Novo anúncio no Trocaí", `Uma pessoa publicou o item "${input.title}" para troca.`);
        }
        return { id, success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "paused"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const [existing] = await db.select({ id: listings.id, status: listings.status })
          .from(listings)
          .where(and(eq(listings.id, input.id), eq(listings.ownerId, ctx.user.id)))
          .limit(1);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Este anúncio não existe ou não pertence a você." });
        if (existing.status === "reserved") throw new TRPCError({ code: "BAD_REQUEST", message: "Esse item tem um encontro confirmado. Ele volta a ficar disponível quando a troca for concluída." });
        if (existing.status !== "active" && existing.status !== "paused") throw new TRPCError({ code: "BAD_REQUEST", message: "Esse anúncio não pode ser reativado agora." });
        await db.update(listings).set({ status: input.status }).where(eq(listings.id, input.id));
        return { success: true };
      }),
  }),

  chains: router({
    find: publicProcedure
      .input(z.object({ listingId: z.number().int().positive() }))
      .query(async ({ input }) => {
        const db = await requireDatabase();
        const [start] = await db.select(listingFields)
          .from(listings)
          .innerJoin(users, eq(listings.ownerId, users.id))
          .where(and(eq(listings.id, input.listingId), eq(listings.status, "active")))
          .limit(1);
        if (!start) return [];

        const active = await db.select(listingFields)
          .from(listings)
          .innerJoin(users, eq(listings.ownerId, users.id))
          .where(eq(listings.status, "active"))
          .orderBy(desc(listings.createdAt))
          .limit(300);
        const pool = active.some((listing) => listing.id === start.id) ? active : [...active, start];
        return findExchangeChains(pool.map((listing) => ({
          id: listing.id,
          ownerId: listing.ownerId,
          ownerName: listing.ownerName || "Pessoa do Trocaí",
          title: listing.title,
          wants: listing.wants,
          location: listing.location,
        })), start.id, { maxParticipants: 5, maxResults: 3 });
      }),
  }),

  proposals: router({
    create: protectedProcedure
      .input(z.object({
        listingId: z.number().int().positive(),
        offeredItem: z.string().trim().min(2).max(200),
        offeredListingId: z.number().int().positive().optional(),
        message: z.string().trim().min(2).max(2000),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const [listing] = await db.select({ id: listings.id, ownerId: listings.ownerId, status: listings.status, title: listings.title })
          .from(listings)
          .where(eq(listings.id, input.listingId))
          .limit(1);
        if (!listing || listing.status !== "active") throw new Error("Este anúncio não está mais disponível.");
        if (listing.ownerId === ctx.user.id) throw new Error("Você não pode propor uma troca no seu próprio anúncio.");
        if (input.offeredListingId) {
          const [offeredListing] = await db.select({ id: listings.id, ownerId: listings.ownerId, status: listings.status })
            .from(listings)
            .where(eq(listings.id, input.offeredListingId))
            .limit(1);
          if (!offeredListing || offeredListing.ownerId !== ctx.user.id || offeredListing.status !== "active") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha um dos seus anúncios que ainda esteja disponível para troca." });
          }
          if (offeredListing.id === listing.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Escolha outro item para oferecer." });
        }
        const [alreadyAccepted] = await db.select({ id: proposals.id })
          .from(proposals)
          .where(and(eq(proposals.listingId, listing.id), eq(proposals.status, "accepted")))
          .limit(1);
        if (alreadyAccepted) throw new Error("Este anúncio já está em uma troca combinada.");
        const id = await db.transaction(async (tx) => {
          const result = await tx.insert(proposals).values({
            listingId: listing.id,
            ownerId: listing.ownerId,
            proposerId: ctx.user.id,
            offeredListingId: input.offeredListingId ?? null,
            offeredItem: input.offeredItem,
            status: "pending",
          });
          const proposalId = Number(result[0]?.insertId);
          if (!Number.isSafeInteger(proposalId) || proposalId < 1) throw new Error("Database did not return a saved proposal ID");
          await tx.insert(messages).values({ proposalId, senderId: ctx.user.id, content: input.message });
          await createUserNotification(tx, {
            recipientId: listing.ownerId,
            actorId: ctx.user.id,
            listingId: listing.id,
            proposalId,
            kind: "interest_received",
            title: "Alguém quer trocar com você",
            body: `${ctx.user.name || "Uma pessoa"} oferece ${input.offeredItem} pelo item ${listing.title}. Vocês já podem conversar por aqui.`,
            href: `/produto/${listing.id}`,
          });
          await createUserNotification(tx, {
            recipientId: ctx.user.id,
            actorId: listing.ownerId,
            listingId: listing.id,
            proposalId,
            kind: "interest_sent",
            title: "Seu interesse foi enviado",
            body: `Sua proposta por ${listing.title} foi enviada. A conversa já está aberta por aqui.`,
            href: `/produto/${listing.id}`,
          });
          try {
            await recordActivity(tx, {
              activityType: "interest_received",
              actorId: ctx.user.id,
              listingId: listing.id,
              proposalId,
              summary: `Nova proposta recebida para o anúncio ${listing.id}.`,
            });
          } catch (error) {
            console.error("[Activity] Could not save the interest event:", error);
          }
          return proposalId;
        });
        if (ctx.user.openId !== ENV.ownerOpenId) {
          await notifyOwnerSafely("Novo interesse em uma troca", "Uma pessoa demonstrou interesse em um anúncio do Trocaí.");
        }
        return { id, success: true };
      }),

    mine: protectedProcedure.query(async ({ ctx }) => {
      const db = await requireDatabase();
      const rows = await db.select({
        id: proposals.id,
        listingId: proposals.listingId,
        ownerId: proposals.ownerId,
        proposerId: proposals.proposerId,
        offeredListingId: proposals.offeredListingId,
        offeredItem: proposals.offeredItem,
        status: proposals.status,
        ownerCompletedAt: proposals.ownerCompletedAt,
        proposerCompletedAt: proposals.proposerCompletedAt,
        createdAt: proposals.createdAt,
        listingTitle: listings.title,
      })
        .from(proposals)
        .innerJoin(listings, eq(proposals.listingId, listings.id))
        .where(or(eq(proposals.ownerId, ctx.user.id), eq(proposals.proposerId, ctx.user.id)))
        .orderBy(desc(proposals.createdAt));
      const others = Array.from(new Set(rows.map((row) => row.ownerId === ctx.user.id ? row.proposerId : row.ownerId)));
      const otherUsers = others.length
        ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, others))
        : [];
      const names = new Map(otherUsers.map((other) => [other.id, other.name || "Pessoa do Trocaí"]));
      return rows.map((row) => ({
        ...row,
        isOwner: row.ownerId === ctx.user.id,
        otherUserId: row.ownerId === ctx.user.id ? row.proposerId : row.ownerId,
        otherName: names.get(row.ownerId === ctx.user.id ? row.proposerId : row.ownerId) || "Pessoa do Trocaí",
      }));
    }),

    messages: protectedProcedure
      .input(z.object({ proposalId: z.number().int().positive() }))
      .query(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const [thread] = await db.select({ id: proposals.id })
          .from(proposals)
          .where(and(eq(proposals.id, input.proposalId), or(eq(proposals.ownerId, ctx.user.id), eq(proposals.proposerId, ctx.user.id))))
          .limit(1);
        if (!thread) throw new Error("Conversa não encontrada.");
        const rows = await db.select({ id: messages.id, content: messages.content, createdAt: messages.createdAt, senderId: messages.senderId, senderName: users.name })
          .from(messages)
          .innerJoin(users, eq(messages.senderId, users.id))
          .where(eq(messages.proposalId, input.proposalId))
          .orderBy(desc(messages.createdAt))
          .limit(100);
        return rows.reverse();
      }),

    sendMessage: protectedProcedure
      .input(z.object({ proposalId: z.number().int().positive(), content: z.string().trim().min(1).max(2000) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const [thread] = await db.select({ id: proposals.id, status: proposals.status, ownerId: proposals.ownerId, proposerId: proposals.proposerId, listingId: proposals.listingId, listingTitle: listings.title })
          .from(proposals)
          .innerJoin(listings, eq(proposals.listingId, listings.id))
          .where(and(eq(proposals.id, input.proposalId), or(eq(proposals.ownerId, ctx.user.id), eq(proposals.proposerId, ctx.user.id))))
          .limit(1);
        if (!thread) throw new Error("Conversa não encontrada.");
        if (thread.status === "completed" || thread.status === "declined" || thread.status === "cancelled") throw new Error("Esta conversa foi encerrada.");
        const recipientId = thread.ownerId === ctx.user.id ? thread.proposerId : thread.ownerId;
        await db.transaction(async (tx) => {
          await tx.insert(messages).values({ proposalId: input.proposalId, senderId: ctx.user.id, content: input.content });
          await createUserNotification(tx, {
            recipientId,
            actorId: ctx.user.id,
            listingId: thread.listingId,
            proposalId: input.proposalId,
            kind: "new_message",
            title: "Chegou uma mensagem sobre a troca",
            body: `Você recebeu uma mensagem sobre ${thread.listingTitle}.`,
            href: `/produto/${thread.listingId}`,
          });
        });
        return { success: true };
      }),

    updateStatus: protectedProcedure
      .input(z.object({ proposalId: z.number().int().positive(), status: z.enum(["accepted", "declined"]) }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const [thread] = await db.select({ ownerId: proposals.ownerId, proposerId: proposals.proposerId, listingId: proposals.listingId, status: proposals.status, listingTitle: listings.title })
          .from(proposals)
          .innerJoin(listings, eq(proposals.listingId, listings.id))
          .where(eq(proposals.id, input.proposalId))
          .limit(1);
        if (!thread || (thread.ownerId !== ctx.user.id && thread.proposerId !== ctx.user.id)) throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
        if (thread.ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Somente a pessoa anunciante pode responder à proposta." });
        if (thread.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta proposta já recebeu uma resposta." });
        const otherPending = input.status === "accepted"
          ? await db.select({ id: proposals.id, proposerId: proposals.proposerId })
              .from(proposals)
              .where(and(eq(proposals.listingId, thread.listingId), eq(proposals.status, "pending"), ne(proposals.id, input.proposalId)))
          : [];
        const ownerAlert = await db.transaction(async (tx) => {
          let alert: { title: string; content: string } | null = null;
          await tx.update(proposals).set({ status: input.status }).where(eq(proposals.id, input.proposalId));
          if (input.status === "accepted") {
            await tx.update(proposals).set({ status: "declined" }).where(and(eq(proposals.listingId, thread.listingId), eq(proposals.status, "pending"), ne(proposals.id, input.proposalId)));
            await createUserNotification(tx, {
              recipientId: thread.proposerId,
              actorId: ctx.user.id,
              listingId: thread.listingId,
              proposalId: input.proposalId,
              kind: "proposal_accepted",
              title: "Sua proposta foi aceita!",
              body: `Agora você e a pessoa anunciante podem combinar a troca de ${thread.listingTitle}.`,
              href: `/produto/${thread.listingId}`,
            });
            for (const other of otherPending) {
              await createUserNotification(tx, {
                recipientId: other.proposerId,
                actorId: ctx.user.id,
                listingId: thread.listingId,
                proposalId: other.id,
                kind: "proposal_declined",
                title: "Este item já foi combinado",
                body: `A pessoa anunciante combinou a troca de ${thread.listingTitle} com outra pessoa.`,
                href: `/produto/${thread.listingId}`,
              });
            }
            try {
              await recordActivity(tx, {
                activityType: "swap_started",
                actorId: ctx.user.id,
                listingId: thread.listingId,
                proposalId: input.proposalId,
                summary: `Uma proposta para ${thread.listingTitle} foi aceita.`,
              });
            } catch (error) {
              console.error("[Activity] Could not save the started-swap event:", error);
            }
            alert = { title: "Uma troca começou", content: `Uma proposta pelo item ${thread.listingTitle} foi aceita.` };
          }
          if (input.status === "declined") {
            await createUserNotification(tx, {
              recipientId: thread.proposerId,
              actorId: ctx.user.id,
              listingId: thread.listingId,
              proposalId: input.proposalId,
              kind: "proposal_declined",
              title: "Essa troca não rolou desta vez",
              body: `A proposta pelo item ${thread.listingTitle} foi encerrada. Você ainda pode encontrar outra troca!`,
              href: `/produto/${thread.listingId}`,
            });
          }
          return alert;
        });
        if (ownerAlert && ctx.user.openId !== ENV.ownerOpenId) {
          await notifyOwnerSafely(ownerAlert.title, ownerAlert.content);
        }
        return { success: true };
      }),

    confirmCompletion: protectedProcedure
      .input(z.object({ proposalId: z.number().int().positive() }))
      .mutation(async ({ input, ctx }) => {
        const db = await requireDatabase();
        const result = await db.transaction(async (tx) => {
          const [thread] = await tx.select({
            ownerId: proposals.ownerId,
            proposerId: proposals.proposerId,
            listingId: proposals.listingId,
            offeredListingId: proposals.offeredListingId,
            status: proposals.status,
            listingTitle: listings.title,
            ownerCompletedAt: proposals.ownerCompletedAt,
            proposerCompletedAt: proposals.proposerCompletedAt,
          })
            .from(proposals)
            .innerJoin(listings, eq(proposals.listingId, listings.id))
            .where(eq(proposals.id, input.proposalId))
            .for("update")
            .limit(1);
          if (!thread || (thread.ownerId !== ctx.user.id && thread.proposerId !== ctx.user.id)) {
            throw new TRPCError({ code: "NOT_FOUND", message: "Conversa não encontrada." });
          }
          if (thread.status === "completed") return { completed: true, alreadyConfirmed: true, notifyOwner: false };
          if (thread.status !== "accepted") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A proposta precisa ser aceita antes de concluir a troca." });
          }
          const meetingRows = await tx.select({ status: exchangeMeetings.status, scheduledAt: exchangeMeetings.scheduledAt })
            .from(exchangeMeetings)
            .where(eq(exchangeMeetings.proposalId, input.proposalId))
            .orderBy(desc(exchangeMeetings.createdAt))
            .limit(1);
          const meeting = meetingRows[0];
          if (!meeting || meeting.status !== "confirmed") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Antes de concluir, combinem um encontro e confirmem o horário dentro da conversa." });
          }
          if (new Date(meeting.scheduledAt).getTime() > Date.now()) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "A confirmação fica disponível depois do horário do encontro." });
          }

          const isOwner = thread.ownerId === ctx.user.id;
          const alreadyConfirmed = isOwner ? thread.ownerCompletedAt : thread.proposerCompletedAt;
          if (alreadyConfirmed) return { completed: false, alreadyConfirmed: true, notifyOwner: false };

          await tx.update(proposals)
            .set(isOwner ? { ownerCompletedAt: new Date() } : { proposerCompletedAt: new Date() })
            .where(eq(proposals.id, input.proposalId));

          // This conditional update is the only path that marks the proposal completed.
          // Both timestamps must exist, so a single participant cannot close the swap alone.
          await tx.update(proposals)
            .set({ status: "completed" })
            .where(and(
              eq(proposals.id, input.proposalId),
              eq(proposals.status, "accepted"),
              isNotNull(proposals.ownerCompletedAt),
              isNotNull(proposals.proposerCompletedAt),
            ));

          const [updated] = await tx.select({
            status: proposals.status,
            ownerCompletedAt: proposals.ownerCompletedAt,
            proposerCompletedAt: proposals.proposerCompletedAt,
          }).from(proposals).where(eq(proposals.id, input.proposalId)).limit(1);
          const completed = updated?.status === "completed";
          const otherParticipantId = isOwner ? thread.proposerId : thread.ownerId;

          if (completed) {
            const reservationRows = await tx.select({ listingId: listingReservations.listingId })
              .from(listingReservations)
              .where(eq(listingReservations.proposalId, input.proposalId));
            const expectedListingIds = [thread.listingId, ...(thread.offeredListingId ? [thread.offeredListingId] : [])];
            if (!expectedListingIds.every((id) => reservationRows.some((row) => row.listingId === id))) {
              throw new TRPCError({ code: "CONFLICT", message: "Os anúncios não estão reservados por esta troca. Peçam ajuda à equipe Trocaí." });
            }
            await tx.update(listings).set({ status: "traded" }).where(inArray(listings.id, reservationRows.map((row) => row.listingId)));
            await tx.delete(listingReservations).where(eq(listingReservations.proposalId, input.proposalId));
            for (const participantId of [thread.ownerId, thread.proposerId]) {
              await createUserNotification(tx, {
                recipientId: participantId,
                actorId: ctx.user.id,
                listingId: thread.listingId,
                proposalId: input.proposalId,
                kind: "swap_confirmed",
                title: "Troca concluída pelos dois!",
                body: `Você e a outra pessoa confirmaram a troca de ${thread.listingTitle}.`,
                href: `/produto/${thread.listingId}`,
              });
            }
            try {
              await recordActivity(tx, {
                activityType: "swap_confirmed",
                actorId: ctx.user.id,
                listingId: thread.listingId,
                proposalId: input.proposalId,
                summary: `As duas pessoas confirmaram a troca de ${thread.listingTitle}.`,
              });
            } catch (error) {
              console.error("[Activity] Could not save the confirmed-swap event:", error);
            }
          } else {
            await createUserNotification(tx, {
              recipientId: otherParticipantId,
              actorId: ctx.user.id,
              listingId: thread.listingId,
              proposalId: input.proposalId,
              kind: "completion_confirmation_requested",
              title: "A outra pessoa confirmou a troca",
              body: `Confira o item combinado e, se estiver tudo certo, confirme também a troca de ${thread.listingTitle}.`,
              href: `/produto/${thread.listingId}`,
            });
          }
          return { completed, alreadyConfirmed: false, notifyOwner: completed };
        });

        if (result.notifyOwner && ctx.user.openId !== ENV.ownerOpenId) {
          await notifyOwnerSafely("Troca concluída pelas duas pessoas", "Os dois participantes confirmaram a conclusão de uma troca no Trocaí.");
        }
        return { success: true, completed: result.completed, alreadyConfirmed: result.alreadyConfirmed };
      }),
  }),
  exchange: router({
    meetings: meetingsRouter,
    reviews: reviewsRouter,
    reports: reportsRouter,
  }),
});
