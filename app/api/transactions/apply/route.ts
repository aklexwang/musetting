import { NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

/**
 * 거래 신청 (구매/판매)
 * - AxPay 가이드: 신청 금액은 반드시 만 원 단위 (10000, 20000, ...)
 * - Transaction 테이블에 PENDING 상태로 저장
 * - 동시에 텔레그램으로 [승인]/[거절] 알림 발송
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { type?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const type = body.type === "SELL" ? "SELL" : "BUY";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);

  if (!Number.isInteger(amount) || amount < 10000) {
    return NextResponse.json(
      { error: "금액은 1만 원 이상이어야 합니다." },
      { status: 400 }
    );
  }
  if (amount % 10000 !== 0) {
    return NextResponse.json(
      { error: "금액은 만 원 단위로만 입력 가능합니다. (예: 10000, 20000)" },
      { status: 400 }
    );
  }

  try {
    const txn = await prisma.transaction.create({
      data: {
        userId: session.userId,
        type,
        amount,
        status: "PENDING",
        apiStatus: "IDLE",
      },
    });

    let telegramSent = false;
    if (token && adminChatIdRaw) {
      const adminChatId = Number(adminChatIdRaw);
      if (!Number.isNaN(adminChatId)) {
        try {
          const bot = new TelegramBot(token, { polling: false });
          const label = type === "BUY" ? "구매요청" : "판매요청";
          const text = `[${label}] 아이디: ${session.username} / 금액: ${amount.toLocaleString("ko-KR")}원`;
          const keyboard = {
            inline_keyboard: [
              [
                { text: "승인", callback_data: `txn:approve:${txn.id}` },
                { text: "거절", callback_data: `txn:reject:${txn.id}` },
              ],
            ],
          };
          await bot.sendMessage(adminChatId, text, { reply_markup: keyboard });
          telegramSent = true;
        } catch (tgErr) {
          console.error("POST /api/transactions/apply: 텔레그램 발송 실패 —", tgErr);
        }
      }
    } else {
      console.warn(
        "POST /api/transactions/apply: TELEGRAM_BOT_TOKEN 또는 TELEGRAM_ADMIN_CHAT_ID가 없습니다."
      );
    }

    return NextResponse.json({ transaction: txn, telegramSent });
  } catch (err) {
    console.error("POST /api/transactions/apply:", err);
    return NextResponse.json(
      { error: "거래 신청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
