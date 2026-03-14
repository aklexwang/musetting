import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** 로그인한 회원의 프로필(계좌 정보 포함) */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { username: true, bankName: true, accountNumber: true, accountHolder: true, terminated: true },
    });
    if (!user) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
    }
    if ((user as { terminated?: boolean }).terminated) {
      return NextResponse.json(
        { error: "계정이 해지되었습니다. BETEAST 관리자에게 문의하세요.", terminated: true },
        { status: 403 }
      );
    }
    const { terminated: _, ...profile } = user;
    return NextResponse.json(profile);
  } catch (err) {
    console.error("GET /api/me:", err);
    return NextResponse.json(
      { error: "프로필을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
