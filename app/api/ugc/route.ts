import { NextRequest, NextResponse } from "next/server";

const USER_PASSWORD = "alsjeblieft";
const MAX_USER_REQUESTS = 2;
const usageMap = new Map<string, number>();

export async function POST(req: NextRequest) {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL not configured" },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action as string | undefined;
  const password = body.password as string | undefined;

  // Status checks don't require password (polling for job progress)
  if (action === "status") {
    return proxyToWebhook(webhookUrl, body);
  }

  // Password required for all other actions
  if (!password) {
    return NextResponse.json(
      { error: "Password required" },
      { status: 401 }
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  const isAdmin = !!(adminPassword && password === adminPassword);
  const isUser = password === USER_PASSWORD;

  if (!isAdmin && !isUser) {
    return NextResponse.json(
      { error: "Wrong password" },
      { status: 403 }
    );
  }

  // Password validation only (no n8n call needed)
  if (action === "validate") {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
    const remaining = isAdmin
      ? -1
      : MAX_USER_REQUESTS - (usageMap.get(ip) ?? 0);
    return NextResponse.json({ valid: true, isAdmin, remaining });
  }

  // Usage tracking for non-admin users on "start" actions
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";

  if (!isAdmin && action === "start") {
    const used = usageMap.get(ip) ?? 0;
    if (used >= MAX_USER_REQUESTS) {
      return NextResponse.json(
        {
          error: `You have used all ${MAX_USER_REQUESTS} requests. No more requests available.`,
          remaining: 0,
        },
        { status: 429 }
      );
    }
    usageMap.set(ip, used + 1);
  }

  const remaining = isAdmin
    ? -1
    : MAX_USER_REQUESTS - (usageMap.get(ip) ?? 0);

  const result = await proxyToWebhook(webhookUrl, body);
  const resultBody = await result.json();

  return NextResponse.json(
    { ...resultBody, remaining, isAdmin },
    { status: result.status }
  );
}

async function proxyToWebhook(
  webhookUrl: string,
  body: Record<string, unknown>
) {
  try {
    // Strip password before forwarding to n8n
    const { password: _pw, ...forwardBody } = body;
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify(forwardBody),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: "Failed to reach n8n webhook" },
      { status: 502 }
    );
  }
}
