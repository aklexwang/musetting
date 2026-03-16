import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 본사 어드민: 가맹점별 회원 목록 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: franchiseId } = await params;
  try {
    const users = await prisma.user.findMany({
      where: { franchiseId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        bankName: true,
        accountNumber: true,
        accountHolder: true,
        status: true,
        suspended: true,
        terminated: true,
        createdAt: true,
      },
    });
    return NextResponse.json(users);
  } catch (err) {
    console.error("GET /api/main-admin/franchises/[id]/users:", err);
    return NextResponse.json(
      { error: "회원 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
