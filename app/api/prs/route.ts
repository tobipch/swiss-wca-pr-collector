import { NextRequest, NextResponse } from "next/server";
import { fetchPRs } from "@/lib/queries";

const VALID_DAYS = [7, 14, 30, 60, 90];

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days")) || 30;

  if (!VALID_DAYS.includes(days)) {
    return NextResponse.json({ error: "Invalid days parameter" }, { status: 400 });
  }

  try {
    const persons = await fetchPRs(days);
    return NextResponse.json(persons);
  } catch (err) {
    console.error("DB query failed:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
