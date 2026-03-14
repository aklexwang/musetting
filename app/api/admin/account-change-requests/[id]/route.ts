import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 어드민: 계좌 변경 신청 승인/거부 및 회원 계좌 반영 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: { status?: string };
  try {
    body = await _request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const status = body.status === "REJECTED" ? "REJECTED" : body.status === "APPROVED" ? "APPROVED" : null;
  if (!status) {
    return NextResponse.json({ error: "status는 APPROVED 또는 REJECTED 여야 합니다." }, { status: 400 });
  }

  try {
    const req = await prisma.accountChangeRequest.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!req) {
      return NextResponse.json({ error: "해당 신청을 찾을 수 없습니다." }, { status: 404 });
    }
    if (req.status !== "PENDING") {
      return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 400 });
    }

    const processedAt = new Date();

    const processedVia = "admin";
    if (status === "APPROVED") {
      await prisma.user.update({
        where: { id: req.userId },
        data: {
          accountHolder: req.afterHolder,
          bankName: req.afterBank,
          accountNumber: req.afterAccount,
        },
      });
      await prisma.accountChangeRequest.update({
        where: { id },
        data: { status: "APPROVED", processedAt, processedVia },
      });
    } else {
      await prisma.accountChangeRequest.update({
        where: { id },
        data: { status: "REJECTED", processedAt, processedVia },
      });
    }

    return NextResponse.json({ ok: true, status });
  } catch (err) {
    console.error("PATCH /api/admin/account-change-requests:", err);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
