import { NextResponse, type NextRequest } from "next/server";
import { runNotificationTick } from "@/lib/notifications/run";
import { createAdminClient } from "@/lib/supabase/admin";

// Rulat de Vercel Cron (zilnic) și de Supabase pg_cron (la 15 minute).
// Autorizare: header „Authorization: Bearer <CRON_SECRET>” (Vercel îl trimite automat).
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }
  try {
    const report = await runNotificationTick(createAdminClient());
    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Eroare" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
