"use client";

import { useEffect, useRef } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function AutoPushEnroll() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    async function enroll() {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        return;
      }

      try {
        const keyRes = await fetch("/api/push/subscribe", {
          method: "GET",
          cache: "no-store",
        });
        if (!keyRes.ok) return;

        const keyData = (await keyRes.json()) as {
          enabled?: boolean;
          publicKey?: string;
        };
        if (!keyData.enabled || !keyData.publicKey) return;

        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted") return;

        const registration =
          (await navigator.serviceWorker.getRegistration()) ||
          (await navigator.serviceWorker.register("/sw.js").catch(() => null));
        if (!registration) return;

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(
              keyData.publicKey
            ) as unknown as BufferSource,
          });
        }

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription,
            userAgent: navigator.userAgent,
          }),
        });
      } catch {
        // Intentionally silent: push enrollment is best-effort.
      }
    }

    void enroll();
  }, []);

  return null;
}
