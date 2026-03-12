import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        bankName: true,
        accountNumber: true,
        accountHolder: true,
        role: true,
        status: true,
        canBuy: true,
        canSell: true,
        createdAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("Admin users list error:", err);
    return NextResponse.json(
      { error: "유저 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
