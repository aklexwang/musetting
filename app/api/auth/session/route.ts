import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200, headers: NO_CACHE_HEADERS });
  }
  return NextResponse.json({ user: { userId: session.userId, username: session.username } }, { status: 200, headers: NO_CACHE_HEADERS });
}
