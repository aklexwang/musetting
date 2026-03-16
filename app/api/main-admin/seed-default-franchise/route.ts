import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 본사 연동: 기본 가맹점 "벳이스트" 생성 후 franchiseId가 없는 회원을 해당 가맹점으로 연결.
 * 한 번만 호출하면 됨 (이미 있으면 스킵).
 */
export async function POST() {
  try {
    let franchise = await prisma.franchise.findFirst({
      where: { name: "벳이스트" },
    });
    if (!franchise) {
      franchise = await prisma.franchise.create({
        data: {
          name: "벳이스트",
          status: "ACTIVE",
          contact: null,
          telegramCode: null,
          apiUrl: process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : process.env.NETLIFY_URL
              ? `https://${process.env.NETLIFY_URL}`
              : "https://papaya-sorbet-3708f7.netlify.app",
        },
      });
    }
    const updated = await prisma.user.updateMany({
      where: { franchiseId: null },
      data: { franchiseId: franchise.id },
    });
    return NextResponse.json({
      ok: true,
      franchiseId: franchise.id,
      linkedUsers: updated.count,
    });
  } catch (err) {
    console.error("POST /api/main-admin/seed-default-franchise:", err);
    return NextResponse.json(
      { error: "기본 가맹점 연동 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
