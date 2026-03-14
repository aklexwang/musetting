import { NextRequest, NextResponse } from "next/server";
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

/** 가입 대기(PENDING) 사용자 일괄 삭제. ?status=PENDING 필수 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get("status") !== "PENDING") {
      return NextResponse.json(
        { error: "가입 대기만 삭제하려면 ?status=PENDING 을 붙여 주세요." },
        { status: 400 }
      );
    }
    const result = await prisma.user.deleteMany({
      where: { status: "PENDING" },
    });
    return NextResponse.json({ deleted: result.count });
  } catch (err) {
    console.error("Admin delete PENDING users error:", err);
    return NextResponse.json(
      { error: "삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
