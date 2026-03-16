import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

/** 본사 어드민: 가맹점 목록 (회원수 집계 포함) */
export async function GET() {
  try {
    const franchises = await prisma.franchise.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true } },
      },
    });
    const list = franchises.map((f) => ({
      id: f.id,
      name: f.name,
      contact: f.contact ?? "",
      telegramCode: f.telegramCode ?? "",
      apiUrl: f.apiUrl ?? "",
      status: f.status,
      token: f.token ?? "",
      memberUrl: f.memberUrl ?? "",
      remark: f.remark ?? "",
      createdAt: f.createdAt.toISOString(),
      memberCount: f._count.users,
    }));
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/main-admin/franchises:", err);
    return NextResponse.json(
      { error: "가맹점 목록을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** 본사 어드민: 가맹점 추가 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      password,
      contact,
      telegramCode,
      apiUrl,
      status,
      token,
      memberUrl,
      remark,
    } = body as {
      name?: string;
      password?: string;
      contact?: string;
      telegramCode?: string;
      apiUrl?: string;
      status?: string;
      token?: string;
      memberUrl?: string;
      remark?: string;
    };
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "가맹점명을 입력해 주세요." },
        { status: 400 }
      );
    }
    const hashedPassword = password
      ? await bcrypt.hash(String(password), 10)
      : null;
    const franchise = await prisma.franchise.create({
      data: {
        name: name.trim(),
        password: hashedPassword,
        contact: contact?.trim() || null,
        telegramCode: telegramCode?.trim() || null,
        apiUrl: apiUrl?.trim() || null,
        status: status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
        token: token?.trim() || null,
        memberUrl: memberUrl?.trim() || null,
        remark: remark?.trim() || null,
      },
    });
    return NextResponse.json({
      id: franchise.id,
      name: franchise.name,
      contact: franchise.contact ?? "",
      telegramCode: franchise.telegramCode ?? "",
      apiUrl: franchise.apiUrl ?? "",
      status: franchise.status,
      token: franchise.token ?? "",
      memberUrl: franchise.memberUrl ?? "",
      remark: franchise.remark ?? "",
      createdAt: franchise.createdAt.toISOString(),
      memberCount: 0,
    });
  } catch (err) {
    console.error("POST /api/main-admin/franchises:", err);
    return NextResponse.json(
      { error: "가맹점 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
