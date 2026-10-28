import { siteActivityEvents, userNotifications } from "../drizzle/schema";
import { notifyOwner } from "./_core/notification";
import type { getDb } from "./db";

type Database = Pick<NonNullable<Awaited<ReturnType<typeof getDb>>>, "insert">;

export type UserNotificationInput = {
  recipientId: number;
  actorId?: number | null;
  listingId?: number | null;
  proposalId?: number | null;
  kind: string;
  title: string;
  body: string;
  href: string;
};

export async function createUserNotification(db: Database, input: UserNotificationInput): Promise<void> {
  await db.insert(userNotifications).values({
    recipientId: input.recipientId,
    actorId: input.actorId ?? null,
    listingId: input.listingId ?? null,
    proposalId: input.proposalId ?? null,
    kind: input.kind.slice(0, 48),
    title: input.title.slice(0, 160),
    body: input.body,
    href: input.href.slice(0, 512),
  });
}

export type ActivityInput = {
  activityType:
    | "user_registered"
    | "listing_published"
    | "interest_received"
    | "swap_started"
    | "swap_cancelled"
    | "swap_confirmed"
    | "meeting_proposed"
    | "meeting_confirmed"
    | "review_submitted"
    | "report_submitted"
    | "account_moderated";
  actorId?: number | null;
  listingId?: number | null;
  proposalId?: number | null;
  summary: string;
};

/** Save an event for the private owner dashboard. */
export async function recordActivity(db: Database, input: ActivityInput): Promise<void> {
  await db.insert(siteActivityEvents).values({
    activityType: input.activityType,
    actorId: input.actorId ?? null,
    listingId: input.listingId ?? null,
    proposalId: input.proposalId ?? null,
    summary: input.summary.slice(0, 512),
  });

}

/** External owner alerts are best-effort; the database feed remains the fallback. */
export async function notifyOwnerSafely(title: string, content: string): Promise<boolean> {
  try {
    const sent = await notifyOwner({ title, content });
    if (!sent) console.warn("[Activity] Owner alert was not delivered; the event remains in the admin feed.");
    return sent;
  } catch (error) {
    console.warn("[Activity] Could not send owner alert; the event remains in the admin feed.", error);
    return false;
  }
}
