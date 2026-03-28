import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

type PushEventLike = Event & {
  data?: {
    json: () => unknown;
    text: () => string;
  };
  waitUntil: (promise: Promise<unknown>) => void;
};

type NotificationClickEventLike = Event & {
  notification: {
    close: () => void;
    data?: unknown;
  };
  waitUntil: (promise: Promise<unknown>) => void;
};

type WindowClientLike = {
  focus: () => Promise<unknown>;
  navigate: (url: string) => Promise<unknown> | void;
};

type ServiceWorkerLike = WorkerGlobalScope & {
  addEventListener: (
    type: "push" | "notificationclick",
    listener: (event: Event) => void
  ) => void;
  registration: {
    showNotification: (
      title: string,
      options?: NotificationOptions
    ) => Promise<void>;
  };
  clients: {
    matchAll: (options?: ClientQueryOptions) => Promise<readonly unknown[]>;
    openWindow?: (url: string) => Promise<unknown>;
  };
};

const sw = self as unknown as ServiceWorkerLike;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

sw.addEventListener("push", (rawEvent: Event) => {
  const event = rawEvent as PushEventLike;
  if (!event.data) return;

  let payload: {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  } = {};

  try {
    const parsed = event.data.json();
    if (parsed && typeof parsed === "object") {
      payload = parsed as typeof payload;
    }
  } catch {
    payload = { body: event.data.text() };
  }

  const title = payload.title ?? "Always Care IPD";
  const options: NotificationOptions = {
    body: payload.body ?? "New update available",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag ?? "management-alert",
    data: {
      url: payload.url ?? "/management",
    },
  };

  event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener("notificationclick", (rawEvent: Event) => {
  const event = rawEvent as NotificationClickEventLike;
  event.notification.close();

  const notificationUrl =
    (event.notification.data as { url?: string } | undefined)?.url ??
    "/management";

  event.waitUntil(
    sw.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        const existingClient = clientsArr.find(
          (client): client is WindowClientLike =>
            typeof client === "object" &&
            client !== null &&
            "focus" in client &&
            "navigate" in client
        );
        if (existingClient && "navigate" in existingClient) {
          void existingClient.navigate(notificationUrl);
          return existingClient.focus();
        }
        if (sw.clients.openWindow) {
          return sw.clients.openWindow(notificationUrl);
        }
        return undefined;
      })
  );
});
