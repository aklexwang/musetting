import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

/** 본사 어드민: 가맹점 단건 조회 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const franchise = await prisma.franchise.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!franchise) {
      return NextResponse.json({ error: "가맹점을 찾을 수 없습니다." }, { status: 404 });
    }
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
      memberCount: franchise._count.users,
    });
  } catch (err) {
    console.error("GET /api/main-admin/franchises/[id]:", err);
    return NextResponse.json(
      { error: "가맹점 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** 본사 어드민: 가맹점 수정 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
    const existing = await prisma.franchise.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "가맹점을 찾을 수 없습니다." }, { status: 404 });
    }
    const updateData: Parameters<typeof prisma.franchise.update>[0]["data"] = {};
    if (name !== undefined && name.trim() !== "") updateData.name = name.trim();
    if (contact !== undefined) updateData.contact = contact?.trim() || null;
    if (telegramCode !== undefined) updateData.telegramCode = telegramCode?.trim() || null;
    if (apiUrl !== undefined) updateData.apiUrl = apiUrl?.trim() || null;
    if (status !== undefined) updateData.status = status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE";
    if (token !== undefined) updateData.token = token?.trim() || null;
    if (memberUrl !== undefined) updateData.memberUrl = memberUrl?.trim() || null;
    if (remark !== undefined) updateData.remark = remark?.trim() || null;
    if (password !== undefined && password !== "") {
      updateData.password = await bcrypt.hash(String(password), 10);
    }
    const franchise = await prisma.franchise.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { users: true } } },
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
      memberCount: franchise._count.users,
    });
  } catch (err) {
    console.error("PATCH /api/main-admin/franchises/[id]:", err);
    return NextResponse.json(
      { error: "가맹점 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** 본사 어드민: 가맹점 삭제 (해당 가맹점 회원 franchiseId는 SetNull) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.franchise.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/main-admin/franchises/[id]:", err);
    return NextResponse.json(
      { error: "가맹점 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
