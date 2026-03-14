import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateBodySchema = z.object({
  id: z.string().min(1, "유저 ID가 필요합니다."),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  canBuy: z.boolean().optional(),
  canSell: z.boolean().optional(),
  suspended: z.boolean().optional(),
  terminated: z.boolean().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
});

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const parsed = updateBodySchema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.flatten().fieldErrors.id?.[0] ?? "입력값을 확인해 주세요.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { id, ...data } = parsed.data;

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.status !== undefined && { status: data.status }),
        ...(data.canBuy !== undefined && { canBuy: data.canBuy }),
        ...(data.canSell !== undefined && { canSell: data.canSell }),
        ...(data.suspended !== undefined && { suspended: data.suspended }),
        ...(data.terminated !== undefined && { terminated: data.terminated }),
        ...(data.bankName !== undefined && { bankName: data.bankName.trim() }),
        ...(data.accountNumber !== undefined && { accountNumber: String(data.accountNumber).trim() }),
        ...(data.accountHolder !== undefined && { accountHolder: data.accountHolder.trim() }),
      },
      select: {
        id: true,
        username: true,
        status: true,
        canBuy: true,
        canSell: true,
        suspended: true,
        terminated: true,
        bankName: true,
        accountNumber: true,
        accountHolder: true,
      },
    });

    return NextResponse.json(user);
  } catch (err) {
    console.error("Admin user update error:", err);
    return NextResponse.json(
      { error: "유저 정보 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
