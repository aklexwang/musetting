import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 가입 대기 화면에서 승인 여부 확인용 (아이디만으로 상태 조회) */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get("username")?.trim();
    if (!username) {
      return NextResponse.json(
        { error: "username이 필요합니다." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: { status: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "해당 회원을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: user.status as "PENDING" | "APPROVED" | "REJECTED",
    });
  } catch (err) {
    console.error("Approval status error:", err);
    return NextResponse.json(
      { error: "상태 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
