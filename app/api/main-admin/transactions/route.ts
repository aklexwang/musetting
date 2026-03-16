import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 본사 어드민: 전체 가맹점 거래 목록 (type=BUY | SELL, 소속 가맹점 포함) */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // BUY | SELL
  if (type !== "BUY" && type !== "SELL") {
    return NextResponse.json(
      { error: "type 쿼리는 BUY 또는 SELL 이어야 합니다." },
      { status: 400 }
    );
  }
  try {
    const list = await prisma.transaction.findMany({
      where: { type },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: {
          select: {
            username: true,
            franchiseId: true,
            franchise: { select: { name: true } },
          },
        },
      },
    });
    const items = list.map((t) => ({
      id: t.id,
      userId: t.userId,
      type: t.type,
      amount: t.amount,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      franchiseName: t.user?.franchise?.name ?? "-",
      username: t.user?.username ?? "-",
    }));
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/main-admin/transactions:", err);
    return NextResponse.json(
      { error: "거래 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
