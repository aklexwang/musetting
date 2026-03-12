import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 어드민: 전체 거래 신청 목록 (최신순, 텔레그램 미수신 시에도 확인용) */
export async function GET() {
  try {
    const list = await prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { username: true } },
      },
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/admin/transactions:", err);
    return NextResponse.json(
      { error: "거래 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
