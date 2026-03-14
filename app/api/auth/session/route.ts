import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, canBuy: true, canSell: true },
    });
    if (!user) {
      return NextResponse.json({ user: { ...session, canBuy: false, canSell: false } }, { status: 200 });
    }
    return NextResponse.json({
      user: {
        userId: user.id,
        username: user.username,
        canBuy: user.canBuy,
        canSell: user.canSell,
      },
    }, { status: 200 });
  } catch {
    return NextResponse.json({ user: { ...session, canBuy: false, canSell: false } }, { status: 200 });
  }
}
