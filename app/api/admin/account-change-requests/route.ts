import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 어드민: 계좌 변경 신청 목록 - 텔레그램에서 처리한 내역만 (최신순) */
export async function GET() {
  try {
    const list = await prisma.accountChangeRequest.findMany({
      where: { processedVia: "telegram" },
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/admin/account-change-requests:", err);
    return NextResponse.json(
      { error: "계좌 변경 신청 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
