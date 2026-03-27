"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

export interface Notification {
  id: string;
  type: "upcoming" | "due" | "overdue" | "urgent" | "critical" | "info";
  category: string;
  title: string;
  description: string;
  patientName: string;
  admissionId: string;
  timestamp: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  count: number;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  count: 0,
  refresh: async () => {},
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications);
        setCount(data.count);
      }
    } catch {
      // Silently fail — notifications are non-critical UI
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // Poll every 60 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <NotificationContext.Provider value={{ notifications, count, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}
