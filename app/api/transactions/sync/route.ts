import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orderQuery, orderCallback } from "@/lib/axpay";

const SYNC_SECRET = process.env.SYNC_SECRET?.trim();

/**
 * 가이드 3.3·3.4: 20초 주기로 호출하여 거래 상태 모니터링.
 * axpayOrderId 가 있고 apiStatus 가 IDLE 인 건에 대해 order_query → status 1 또는 2 시 order_callback 호출 후 DB 최종 업데이트.
 * Cron 등에서 호출 시 SYNC_SECRET 이 설정되어 있으면 Authorization: Bearer <SYNC_SECRET> 또는 x-sync-secret 헤더 필요.
 */
export async function GET(request: Request) {
  if (SYNC_SECRET) {
    const auth = request.headers.get("authorization");
    const secretHeader = request.headers.get("x-sync-secret");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : secretHeader;
    if (token !== SYNC_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const list = await prisma.transaction.findMany({
      where: {
        axpayOrderId: { not: null },
        apiStatus: "IDLE",
        status: "APPROVED",
      },
      select: { id: true, axpayOrderId: true },
    });

    for (const txn of list) {
      const orderId = txn.axpayOrderId;
      if (!orderId) continue;

      const queryResult = await orderQuery(orderId);
      if (!queryResult.success) {
        console.warn(`[sync] order_query fail for ${orderId}:`, queryResult.message);
        continue;
      }

      const status = queryResult.status;
      if (status !== 1 && status !== 2) continue;

      const callbackResult = await orderCallback(orderId, status);
      if (!callbackResult.success) {
        console.warn(`[sync] order_callback fail for ${orderId}:`, callbackResult.message);
        continue;
      }

      await prisma.transaction.update({
        where: { id: txn.id },
        data: { apiStatus: status === 1 ? "SUCCESS" : "FAILED" },
      });
    }

    return NextResponse.json({ ok: true, processed: list.length });
  } catch (err) {
    console.error("GET /api/transactions/sync:", err);
    return NextResponse.json(
      { error: "동기화 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
