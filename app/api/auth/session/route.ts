import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
};

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200, headers: NO_CACHE_HEADERS });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, canBuy: true, canSell: true },
    });
    if (!user) {
      return NextResponse.json({ user: { userId: session.userId, username: session.username } }, { status: 200, headers: NO_CACHE_HEADERS });
    }
    return NextResponse.json(
      {
        user: {
          userId: user.id,
          username: user.username,
          canBuy: user.canBuy,
          canSell: user.canSell,
        },
      },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch {
    return NextResponse.json({ user: { userId: session.userId, username: session.username } }, { status: 200, headers: NO_CACHE_HEADERS });
  }
}
