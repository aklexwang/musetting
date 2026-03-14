import { NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

/** 현재 로그인 유저의 거래 목록 (최신순, 대시보드용) */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  try {
    const list = await prisma.transaction.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ transactions: list });
  } catch (err) {
    console.error("GET /api/transactions:", err);
    return NextResponse.json(
      { error: "거래 목록 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** 거래 신청: Transaction 생성 + 텔레그램으로 승인/거절 요청 발송 */
export async function POST(request: Request) {
  const session = await getSession();
  console.log("[transactions] POST 호출됨, session:", session ? { userId: session.userId, username: session.username } : "없음");
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { type?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  console.log("[transactions] body:", body);

  const type = body.type === "SELL" ? "SELL" : "BUY";
  const amount = typeof body.amount === "number" ? body.amount : Number(body.amount);
  if (!Number.isInteger(amount) || amount < 10000) {
    return NextResponse.json({ error: "금액은 1만 원 이상이어야 합니다." }, { status: 400 });
  }
  if (amount % 10000 !== 0) {
    return NextResponse.json(
      { error: "금액은 만 원 단위로만 입력 가능합니다. (예: 10000, 20000)" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { canBuy: true, canSell: true },
  });
  if (!user) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
  }
  if (type === "BUY" && !user.canBuy) {
    return NextResponse.json(
      { error: "이용정지중입니다. BETEAST 관리자에게 문의하세요." },
      { status: 403 }
    );
  }
  if (type === "SELL" && !user.canSell) {
    return NextResponse.json(
      { error: "이용정지중입니다. BETEAST 관리자에게 문의하세요." },
      { status: 403 }
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
    console.log(
      "[transactions] 생성됨:",
      txn.id,
      "userId:",
      session.userId,
      "username:",
      session.username,
      type,
      amount
    );

    let telegramSent = false;
    if (!token || !adminChatIdRaw) {
      console.warn(
        "POST /api/transactions: 텔레그램 미발송 — TELEGRAM_BOT_TOKEN 또는 TELEGRAM_ADMIN_CHAT_ID가 없습니다."
      );
    } else {
      const adminChatId = Number(adminChatIdRaw);
      if (Number.isNaN(adminChatId)) {
        console.warn("POST /api/transactions: TELEGRAM_ADMIN_CHAT_ID가 숫자가 아닙니다.");
      } else {
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
          console.error("POST /api/transactions: 텔레그램 발송 실패 —", tgErr);
        }
      }
    }

    return NextResponse.json({ transaction: txn, telegramSent });
  } catch (err) {
    console.error("POST /api/transactions:", err);
    return NextResponse.json(
      { error: "거래 신청 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
