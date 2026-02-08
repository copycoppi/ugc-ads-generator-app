import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const MAX_REQUESTS = 10; // per window
const requests = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = requests.get(ip);
  if (!entry || now > entry.resetAt) {
    requests.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQUESTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429 }
    );
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return NextResponse.json(
      { error: "N8N_WEBHOOK_URL not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": process.env.N8N_WEBHOOK_SECRET ?? "",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to reach n8n webhook" },
      { status: 502 }
    );
  }
}
