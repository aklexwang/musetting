import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { prisma } from "@/lib/prisma";
import { createSessionCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!username || !password) {
      return NextResponse.json(
        { error: "아이디와 비밀번호를 입력해 주세요." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, password: true, status: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    if (user.status === "PENDING") {
      return NextResponse.json(
        { error: "승인 대기 중입니다. 관리자 승인 후 다시 시도해 주세요." },
        { status: 403 }
      );
    }

    if (user.status === "REJECTED") {
      return NextResponse.json(
        { error: "가입이 거절되었습니다." },
        { status: 403 }
      );
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return NextResponse.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    const cookie = createSessionCookie({ userId: user.id, username: user.username });
    const res = NextResponse.json({
      ok: true,
      message: "승인되었습니다. 로그인되었습니다.",
      user: { username: user.username },
    });
    res.headers.set("Set-Cookie", cookie);
    return res;
  } catch (err) {
    console.error("Login error:", err);
    const message = err instanceof Error ? err.message : "";
    const isAuthSecret = message.includes("AUTH_SECRET");
    return NextResponse.json(
      {
        error: "로그인 처리 중 오류가 발생했습니다.",
        ...(process.env.NODE_ENV === "development" && isAuthSecret && {
          detail: "AUTH_SECRET을 .env에 설정해 주세요 (16자 이상).",
        }),
      },
      { status: 500 }
    );
  }
}
