import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTelegramLocale, getTranslations } from "@/lib/translations";

const token = process.env.TELEGRAM_BOT_TOKEN;
const adminChatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

/** 회원: 계좌 변경 신청 대기 여부 + 최근 요청 상태 (승인 시 회원 페이지 문구 전환용) */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  try {
    const latest = await prisma.accountChangeRequest.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      select: { status: true, processedAt: true },
    });
    const hasPending = latest?.status === "PENDING";
    const lastRequest = latest
      ? { status: latest.status as "PENDING" | "APPROVED" | "REJECTED", processedAt: latest.processedAt?.toISOString() ?? null }
      : undefined;
    return NextResponse.json({ hasPending, lastRequest });
  } catch (err) {
    console.error("GET /api/account-change-request:", err);
    return NextResponse.json({ hasPending: false });
  }
}

/** 회원: 계좌 변경 신청 (예금주, 은행명, 계좌번호) + 텔레그램 알림 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { accountHolder?: string; bankName?: string; accountNumber?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const afterHolder = typeof body.accountHolder === "string" ? body.accountHolder.trim() : "";
  const afterBank = typeof body.bankName === "string" ? body.bankName.trim() : "";
  const afterAccount = typeof body.accountNumber === "string" ? body.accountNumber.trim() : "";

  if (!afterHolder || !afterBank || !afterAccount) {
    return NextResponse.json(
      { error: "예금주, 은행명, 계좌번호를 모두 입력해 주세요." },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.accountChangeRequest.findFirst({
      where: { userId: session.userId, status: "PENDING" },
    });
    if (existing) {
      return NextResponse.json(
        { error: "이미 계좌 변경 신청이 대기 중입니다. 관리자 승인 후 다시 신청해 주세요." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, accountHolder: true, bankName: true, accountNumber: true },
    });
    if (!user) {
      return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    const req = await prisma.accountChangeRequest.create({
      data: {
        userId: user.id,
        beforeHolder: user.accountHolder,
        beforeBank: user.bankName,
        beforeAccount: user.accountNumber,
        afterHolder,
        afterBank,
        afterAccount,
        status: "PENDING",
      },
    });

    let telegramSent = false;
    if (token && adminChatIdRaw) {
      const adminChatId = Number(adminChatIdRaw);
      if (!Number.isNaN(adminChatId)) {
        try {
          const { default: TelegramBot } = await import("node-telegram-bot-api");
          const bot = new TelegramBot(token, { polling: false });
          const locale = getTelegramLocale();
          const tg = getTranslations(locale).telegram;
          const text =
            `${tg.accRequestTitle}\n\n` +
            `${tg.accId}: ${user.username}\n\n` +
            `${tg.accBefore}\n${tg.accountHolder}: ${user.accountHolder}\n${tg.bankName}: ${user.bankName}\n${tg.accountNumber}: ${user.accountNumber}\n\n` +
            `${tg.accAfter}\n${tg.accountHolder}: ${afterHolder}\n${tg.bankName}: ${afterBank}\n${tg.accountNumber}: ${afterAccount}`;
          const keyboard = {
            inline_keyboard: [
              [
                { text: tg.accApprove, callback_data: `acc:approve:${req.id}` },
                { text: tg.accReject, callback_data: `acc:reject:${req.id}` },
              ],
            ],
          };
          await bot.sendMessage(adminChatId, text, { reply_markup: keyboard });
          telegramSent = true;
        } catch (tgErr) {
          console.error("POST /api/account-change-request: 텔레그램 발송 실패 —", tgErr);
        }
      }
    }

    return NextResponse.json({ ok: true, message: "계좌 변경 신청이 접수되었습니다.", telegramSent });
  } catch (err) {
    console.error("POST /api/account-change-request:", err);
    return NextResponse.json(
      { error: "계좌 변경 신청 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
