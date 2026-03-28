import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireManagement } from "@/lib/auth";
import { getPushPublicKey, isPushEnabled } from "@/lib/push";

interface WebPushSubscriptionBody {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

export async function GET() {
  try {
    await requireManagement();
    return NextResponse.json({
      enabled: isPushEnabled(),
      publicKey: getPushPublicKey(),
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireManagement();

    if (!isPushEnabled()) {
      return NextResponse.json({ enabled: false, success: false }, { status: 200 });
    }

    const body = (await request.json()) as {
      subscription?: WebPushSubscriptionBody;
      userAgent?: string;
    };

    const subscription = body.subscription;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: "Invalid subscription payload" }, { status: 400 });
    }

    await db.pushSubscription.upsert({
      where: { endpoint },
      create: {
        staffId: session.staffId,
        endpoint,
        p256dh,
        auth,
        userAgent: body.userAgent,
        lastSeenAt: new Date(),
      },
      update: {
        staffId: session.staffId,
        p256dh,
        auth,
        userAgent: body.userAgent,
        lastSeenAt: new Date(),
      },
    });

    await db.staff.update({
      where: { id: session.staffId },
      data: { lastSeenAt: new Date() },
    });

    return NextResponse.json({ success: true, enabled: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireManagement();

    const body = (await request.json()) as {
      endpoint?: string;
      subscription?: WebPushSubscriptionBody;
    };
    const endpoint = body.endpoint ?? body.subscription?.endpoint;

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
    }

    await db.pushSubscription.deleteMany({
      where: {
        endpoint,
        staffId: session.staffId,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
