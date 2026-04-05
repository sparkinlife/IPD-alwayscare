"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface LiveDashboardRefreshProps {
  intervalMs?: number;
}

export function LiveDashboardRefresh({
  intervalMs = 60_000,
}: LiveDashboardRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      router.refresh();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, intervalMs);

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs, router]);

  return null;
}
