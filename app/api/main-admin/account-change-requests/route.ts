import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 본사 어드민: 전체 가맹점 계좌 변경 신청 목록 (최신순, 소속 가맹점 포함) */
export async function GET() {
  try {
    const list = await prisma.accountChangeRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            franchiseId: true,
            franchise: { select: { name: true } },
          },
        },
      },
    });
    const items = list.map((r) => ({
      id: r.id,
      userId: r.userId,
      franchiseName: r.user?.franchise?.name ?? "-",
      username: r.user?.username ?? "-",
      beforeHolder: r.beforeHolder,
      beforeBank: r.beforeBank,
      beforeAccount: r.beforeAccount,
      afterHolder: r.afterHolder,
      afterBank: r.afterBank,
      afterAccount: r.afterAccount,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      processedAt: r.processedAt?.toISOString() ?? null,
    }));
    return NextResponse.json(items);
  } catch (err) {
    console.error("GET /api/main-admin/account-change-requests:", err);
    return NextResponse.json(
      { error: "계좌 변경 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
