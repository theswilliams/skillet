import { NextRequest, NextResponse } from "next/server";
import { resetDemoUser } from "@/lib/services/demoReset";

/**
 * Scheduled by vercel.json's `crons` entry. Vercel signs cron requests with
 * `Authorization: Bearer $CRON_SECRET` — set CRON_SECRET in the Vercel
 * project env and this route rejects anything else, so it can't be triggered
 * by a stray public GET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await resetDemoUser();
  return NextResponse.json({ ok: true, ...result, resetAt: new Date().toISOString() });
}
