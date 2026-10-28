import { beforeEach, describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  db: undefined as unknown,
  savedRows: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  statusUpdates: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
  listingId: 701,
  proposalId: 901,
  targetListing: undefined as Record<string, unknown> | undefined,
  listingRows: [] as Array<Record<string, unknown>>,
  targetProposal: undefined as Record<string, unknown> | undefined,
  targetMeeting: undefined as Record<string, unknown> | undefined,
  targetReservations: [] as Array<Record<string, unknown>>,
  storagePut: vi.fn(async (..._args: unknown[]) => ({ url: "/manus-storage/trocai-test-photo.webp" })),
}));

vi.mock("./db", () => ({ getDb: async () => mockState.db }));
vi.mock("./storage", () => ({ storagePut: mockState.storagePut }));
vi.mock("./activity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./activity")>();
  return { ...actual, notifyOwnerSafely: vi.fn(async () => true) };
});

import { exchangeMeetings, listingReservations, listings, messages, proposals, siteActivityEvents, userNotifications, users } from "../drizzle/schema";
import { CURRENT_TERMS_VERSION } from "../shared/const";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function makeDb() {
  const rowsFor = (table: unknown) => {
    if (table === users) return [{ termsVersion: CURRENT_TERMS_VERSION, termsAcceptedAt: new Date() }];
    if (table === listings) return mockState.listingRows.length ? mockState.listingRows : mockState.targetListing ? [mockState.targetListing] : [];
    if (table === proposals && mockState.targetProposal) return [mockState.targetProposal];
    if (table === exchangeMeetings && mockState.targetMeeting) return [mockState.targetMeeting];
    if (table === listingReservations) return mockState.targetReservations;
    return [];
  };
  const queryFor = (table: unknown, fields?: Record<string, unknown>, limitValue?: number, offsetValue = 0) => ({
    limit: (limit: number) => queryFor(table, fields, limit, offsetValue),
    offset: (offset: number) => queryFor(table, fields, limitValue, offset),
    orderBy: (_order: unknown) => queryFor(table, fields, limitValue, offsetValue),
    for: (_lock: string) => queryFor(table, fields, limitValue, offsetValue),
    then: (resolve: (rows: Array<Record<string, unknown>>) => unknown, reject?: (error: unknown) => unknown) => {
      const end = limitValue === undefined ? undefined : offsetValue + limitValue;
      const rows = rowsFor(table).slice(offsetValue, end);
      const selected = fields
        ? rows.map((row) => Object.fromEntries(Object.keys(fields).map((key) => [key, row[key]])))
        : rows;
      return Promise.resolve(selected).then(resolve, reject);
    },
  });
  const db = {
    insert(table: unknown) {
      return {
        values: async (values: Record<string, unknown>) => {
          mockState.savedRows.push({ table, values });
          if (table === exchangeMeetings) mockState.targetMeeting = { id: 1, ...values, createdAt: new Date(), updatedAt: new Date() };
          if (table === listingReservations) mockState.targetReservations.push(values);
          const insertId = table === listings ? mockState.listingId : table === proposals ? mockState.proposalId : 1;
          return [{ insertId, affectedRows: 1 }];
        },
      };
    },
    update(table: unknown) {
      return {
        set: (values: Record<string, unknown>) => ({
          where: async (_condition: unknown) => {
            mockState.statusUpdates.push({ table, values });
            if (table === proposals && mockState.targetProposal) {
              if (values.status !== "completed" || (mockState.targetProposal.ownerCompletedAt && mockState.targetProposal.proposerCompletedAt)) {
                Object.assign(mockState.targetProposal, values);
              }
            }
            if (table === exchangeMeetings && mockState.targetMeeting) Object.assign(mockState.targetMeeting, values);
            if (table === listings && mockState.targetListing) Object.assign(mockState.targetListing, values);
            return { affectedRows: 1 };
          },
        }),
      };
    },
    delete(table: unknown) {
      return {
        where: async (_condition: unknown) => {
          if (table === listingReservations) mockState.targetReservations = [];
          return { affectedRows: 1 };
        },
      };
    },
    select: (fields?: Record<string, unknown>) => ({
      from: (table: unknown) => {
        const query = queryFor(table, fields);
        return {
          where: (_condition: unknown) => query,
          innerJoin: (_joinedTable: unknown, _condition: unknown) => ({ where: (_condition: unknown) => query }),
          leftJoin: (_joinedTable: unknown, _condition: unknown) => ({ where: (_condition: unknown) => query }),
        };
      },
    }),
    transaction: async <T,>(callback: (tx: unknown) => Promise<T>) => callback(db),
  };
  return db;
}

function createAuthContext(id: number): TrpcContext {
  const now = new Date();
  const user: NonNullable<TrpcContext["user"]> = {
    id,
    openId: `isolated-test-user-${id}`,
    email: `test-${id}@example.test`,
    name: "Pessoa de teste",
    loginMethod: "test",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

beforeEach(() => {
  mockState.savedRows.length = 0;
  mockState.statusUpdates.length = 0;
  mockState.listingId = 701;
  mockState.proposalId = 901;
  mockState.targetListing = undefined;
  mockState.listingRows.length = 0;
  mockState.targetProposal = undefined;
  mockState.targetMeeting = undefined;
  mockState.targetReservations = [];
  mockState.db = makeDb();
  mockState.storagePut.mockClear();
});

describe("persistência do marketplace", () => {
  it("paginates anúncios públicos e não devolve o identificador privado de login", async () => {
    mockState.listingRows = Array.from({ length: 30 }, (_, index) => ({
      id: index + 1,
      title: `Item ${index + 1}`,
      category: "Livros",
      size: null,
      description: "Descrição pública",
      condition: "Quase novo",
      wants: "Outro livro",
      location: "Centro",
      imageUrl: null,
      status: "active",
      createdAt: new Date(2026, 0, index + 1),
      ownerId: 55,
      ownerName: "Pessoa da comunidade",
      ownerOpenId: "identificador-privado-de-login",
    }));
    const caller = appRouter.createCaller(createAuthContext(32));

    const firstPage = await caller.marketplace.listings.list({ page: 1, pageSize: 24 });
    expect(firstPage).toMatchObject({ page: 1, pageSize: 24, hasMore: true });
    expect(firstPage.items).toHaveLength(24);
    expect(firstPage.items[0]).not.toHaveProperty("ownerOpenId");

    const secondPage = await caller.marketplace.listings.list({ page: 2, pageSize: 24 });
    expect(secondPage.items).toHaveLength(6);
    expect(secondPage.hasMore).toBe(false);
  });

  it("não permite enviar mensagem depois que uma proposta foi cancelada", async () => {
    mockState.targetProposal = {
      id: 901,
      listingId: 701,
      ownerId: 41,
      proposerId: 32,
      status: "cancelled",
      listingTitle: "Livro para trocar",
    };
    const caller = appRouter.createCaller(createAuthContext(32));

    await expect(caller.marketplace.proposals.sendMessage({ proposalId: 901, content: "Ainda posso falar?" }))
      .rejects.toMatchObject({ message: "Esta conversa foi encerrada." });
    expect(mockState.savedRows.some((row) => row.table === messages)).toBe(false);
  });
  it("só confirma a publicação depois de salvar todos os campos e a referência da foto", async () => {
    const caller = appRouter.createCaller(createAuthContext(31));
    const result = await caller.marketplace.listings.create({
      title: "Tênis para trocar",
      category: "Calçados",
      size: "37",
      description: "Tênis confortável, limpo e bem cuidado.",
      condition: "Usado, mas está bem",
      wants: "Um livro de fantasia",
      location: "Centro, Curitiba",
      imageBase64: "dGVzdA==",
      imageContentType: "image/webp",
    });

    expect(result).toEqual({ id: 701, success: true });
    expect(mockState.storagePut).toHaveBeenCalledWith(
      expect.stringContaining("trocai/listings/31/"),
      expect.any(Uint8Array),
      "image/webp",
    );
    expect(mockState.savedRows.find((row) => row.table === listings)?.values).toMatchObject({
      ownerId: 31,
      title: "Tênis para trocar",
      category: "Calçados",
      size: "37",
      description: "Tênis confortável, limpo e bem cuidado.",
      condition: "Usado, mas está bem",
      wants: "Um livro de fantasia",
      location: "Centro, Curitiba",
      imageUrl: "/manus-storage/trocai-test-photo.webp",
      status: "active",
    });
    expect(mockState.savedRows.some((row) => row.table === siteActivityEvents && row.values.activityType === "listing_published")).toBe(true);
  });

  it("não devolve sucesso se o banco não confirmar um ID salvo", async () => {
    mockState.listingId = 0;
    const caller = appRouter.createCaller(createAuthContext(32));
    const expectedError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(caller.marketplace.listings.create({
        title: "Livro para trocar",
        category: "Livros",
        description: "Livro em ótimo estado.",
        condition: "Quase novo",
        wants: "Outro livro",
        location: "Recife",
      })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    } finally {
      expectedError.mockRestore();
    }
  });

  it("tira um anúncio do ar e permite reativá-lo sem apagar o registro", async () => {
    mockState.targetListing = { id: 44, ownerId: 31, status: "active" };
    const caller = appRouter.createCaller(createAuthContext(31));

    await expect(caller.marketplace.listings.updateStatus({ id: 44, status: "paused" })).resolves.toEqual({ success: true });
    await expect(caller.marketplace.listings.updateStatus({ id: 44, status: "active" })).resolves.toEqual({ success: true });

    expect(mockState.statusUpdates).toEqual([
      { table: listings, values: { status: "paused" } },
      { table: listings, values: { status: "active" } },
    ]);
  });

  it("salva a proposta, abre a conversa e cria avisos para as duas pessoas", async () => {
    mockState.targetListing = {
      id: 44,
      ownerId: 8,
      title: "Celular funcionando",
      status: "active",
    };
    const caller = appRouter.createCaller(createAuthContext(19));

    const result = await caller.marketplace.proposals.create({
      listingId: 44,
      offeredItem: "Fone de ouvido",
      message: "Tenho interesse e posso trocar pelo meu fone.",
    });

    expect(result).toEqual({ id: 901, success: true });
    expect(mockState.savedRows.some((row) => row.table === proposals && row.values.listingId === 44)).toBe(true);
    expect(mockState.savedRows.some((row) => row.table === messages && row.values.proposalId === 901)).toBe(true);
    const notifications = mockState.savedRows.filter((row) => row.table === userNotifications);
    expect(notifications).toHaveLength(2);
    expect(notifications.map((row) => Number(row.values.recipientId)).sort((a, b) => a - b)).toEqual([8, 19]);
    expect(mockState.savedRows.some((row) => row.table === siteActivityEvents && row.values.activityType === "interest_received")).toBe(true);
  });

  it("reserva os anúncios só depois que as duas pessoas confirmam o encontro", async () => {
    mockState.targetProposal = {
      id: 901,
      listingId: 44,
      ownerId: 8,
      proposerId: 19,
      listingTitle: "Celular funcionando",
      status: "accepted",
      offeredListingId: null,
    };
    mockState.targetListing = { id: 44, status: "active" };
    const proposer = appRouter.createCaller(createAuthContext(19));
    const owner = appRouter.createCaller(createAuthContext(8));

    const proposed = await proposer.marketplace.exchange.meetings.propose({
      proposalId: 901,
      location: "Café público no centro",
      scheduledAt: new Date(Date.now() + 60 * 60_000),
    });
    expect(proposed.success).toBe(true);
    expect(mockState.targetMeeting?.status).toBe("proposed");
    expect(mockState.targetListing.status).toBe("active");
    expect(mockState.targetReservations).toHaveLength(0);

    const response = await owner.marketplace.exchange.meetings.respond({ proposalId: 901 });
    expect(response).toEqual({ success: true, confirmed: true });
    expect(mockState.targetMeeting?.status).toBe("confirmed");
    expect(mockState.targetListing.status).toBe("reserved");
    expect(mockState.targetReservations).toEqual([{ listingId: 44, proposalId: 901, previousStatus: "active" }]);
  });

  it("só conclui a troca depois que as duas pessoas confirmam", async () => {
    mockState.targetProposal = {
      id: 901,
      listingId: 44,
      ownerId: 8,
      proposerId: 19,
      listingTitle: "Celular funcionando",
      status: "accepted",
      ownerCompletedAt: null,
      proposerCompletedAt: null,
    };
    mockState.targetListing = { id: 44, status: "active" };
    mockState.targetMeeting = { status: "confirmed", scheduledAt: new Date(Date.now() - 60_000) };
    mockState.targetReservations = [{ listingId: 44 }];
    const owner = appRouter.createCaller(createAuthContext(8));
    const proposer = appRouter.createCaller(createAuthContext(19));

    const ownerResult = await owner.marketplace.proposals.confirmCompletion({ proposalId: 901 });
    expect(ownerResult).toEqual({ success: true, completed: false, alreadyConfirmed: false });
    expect(mockState.targetProposal.status).toBe("accepted");
    expect(mockState.targetProposal.ownerCompletedAt).toBeInstanceOf(Date);
    expect(mockState.targetProposal.proposerCompletedAt).toBeNull();
    expect(mockState.targetListing.status).toBe("active");
    expect(mockState.savedRows.some((row) => row.table === userNotifications && row.values.recipientId === 19 && row.values.kind === "completion_confirmation_requested")).toBe(true);

    const proposerResult = await proposer.marketplace.proposals.confirmCompletion({ proposalId: 901 });
    expect(proposerResult).toEqual({ success: true, completed: true, alreadyConfirmed: false });
    expect(mockState.targetProposal.status).toBe("completed");
    expect(mockState.targetProposal.proposerCompletedAt).toBeInstanceOf(Date);
    expect(mockState.targetListing.status).toBe("traded");
    expect(mockState.savedRows.filter((row) => row.table === userNotifications && row.values.kind === "swap_confirmed")).toHaveLength(2);
    expect(mockState.savedRows.some((row) => row.table === siteActivityEvents && row.values.activityType === "swap_confirmed")).toBe(true);
  });

  it("não permite confirmar a troca sem encontro confirmado", async () => {
    mockState.targetProposal = {
      id: 901,
      listingId: 44,
      ownerId: 8,
      proposerId: 19,
      listingTitle: "Celular funcionando",
      status: "accepted",
      ownerCompletedAt: null,
      proposerCompletedAt: null,
    };
    const owner = appRouter.createCaller(createAuthContext(8));

    await expect(owner.marketplace.proposals.confirmCompletion({ proposalId: 901 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mockState.targetProposal.ownerCompletedAt).toBeNull();
    expect(mockState.targetProposal.proposerCompletedAt).toBeNull();
  });

  it("ao encerrar uma troca, devolve o anúncio ao estado anterior e libera a reserva", async () => {
    mockState.targetProposal = {
      id: 901,
      listingId: 44,
      ownerId: 8,
      proposerId: 19,
      listingTitle: "Celular funcionando",
      status: "accepted",
    };
    mockState.targetListing = { id: 44, status: "reserved" };
    mockState.targetMeeting = { status: "confirmed", scheduledAt: new Date(Date.now() + 60_000) };
    mockState.targetReservations = [{ listingId: 44, previousStatus: "paused" }];
    const proposer = appRouter.createCaller(createAuthContext(19));

    await expect(proposer.marketplace.exchange.meetings.cancel({ proposalId: 901 })).resolves.toEqual({ success: true, alreadyClosed: false });
    expect(mockState.targetProposal.status).toBe("cancelled");
    expect(mockState.targetMeeting.status).toBe("cancelled");
    expect(mockState.targetListing.status).toBe("paused");
    expect(mockState.targetReservations).toEqual([]);
    expect(mockState.savedRows.some((row) => row.table === userNotifications && row.values.recipientId === 8 && row.values.kind === "swap_cancelled")).toBe(true);
  });
});
