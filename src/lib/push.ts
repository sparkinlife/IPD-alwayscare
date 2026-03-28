import webpush from "web-push";
import { db } from "@/lib/db";

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

let vapidInitialized = false;

function getVapidConfig() {
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT;
  const publicKey =
    process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ??
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;

  return { subject, publicKey, privateKey };
}

export function isPushEnabled(): boolean {
  const { subject, publicKey, privateKey } = getVapidConfig();
  return Boolean(subject && publicKey && privateKey);
}

export function getPushPublicKey(): string {
  const { publicKey } = getVapidConfig();
  return publicKey ?? "";
}

function ensureVapidInitialized(): boolean {
  if (vapidInitialized) return true;

  const { subject, publicKey, privateKey } = getVapidConfig();
  if (!subject || !publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
  return true;
}

export async function sendManagementPush(payload: PushPayload) {
  if (!ensureVapidInitialized()) {
    return { sent: 0, removed: 0, skipped: true };
  }

  const subscriptions = await db.pushSubscription.findMany({
    where: {
      staff: {
        role: "MANAGEMENT",
        isActive: true,
        deletedAt: null,
      },
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
    },
  });

  if (subscriptions.length === 0) {
    return { sent: 0, removed: 0, skipped: false };
  }

  let sent = 0;
  const toRemove: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url ?? "/management",
            tag: payload.tag ?? "management-alert",
          })
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          toRemove.push(sub.id);
        }
      }
    })
  );

  if (toRemove.length > 0) {
    await db.pushSubscription.deleteMany({ where: { id: { in: toRemove } } });
  }

  return { sent, removed: toRemove.length, skipped: false };
}
