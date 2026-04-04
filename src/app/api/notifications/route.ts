import { NextResponse } from "next/server";
import { connection } from "next/server";
import { getSession } from "@/lib/auth";
import { getTodayUTCDate } from "@/lib/date-utils";
import { getNotificationsSnapshot } from "@/lib/notification-snapshot";
import { formatInTimeZone } from "date-fns-tz";

export async function GET() {
  try {
    await connection();
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const today = getTodayUTCDate();
    const nowTimeStr = formatInTimeZone(new Date(), "Asia/Kolkata", "HH:mm");
    const [nowH, nowM] = nowTimeStr.split(":").map(Number);
    const nowMinutes = nowH * 60 + nowM;
    const notifications = await getNotificationsSnapshot(session.role, today, nowMinutes);
    return NextResponse.json({ notifications, count: notifications.length });
  } catch (error) {
    console.error("[notifications] Failed:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}
