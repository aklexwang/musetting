import { NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const adminChatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

  if (!token) {
    console.error("텔레그램 발송 실패: TELEGRAM_BOT_TOKEN이 .env에 없거나 비어 있습니다.");
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN이 설정되지 않았습니다. .env를 확인하세요." },
      { status: 500 }
    );
  }
  if (!adminChatIdRaw) {
    console.error("텔레그램 발송 실패: TELEGRAM_ADMIN_CHAT_ID가 .env에 없거나 비어 있습니다.");
    return NextResponse.json(
      { error: "TELEGRAM_ADMIN_CHAT_ID가 설정되지 않았습니다. 봇에게 /start 보낸 뒤 .env에 Chat ID를 넣으세요." },
      { status: 500 }
    );
  }

  const adminChatId = Number(adminChatIdRaw);
  if (Number.isNaN(adminChatId)) {
    return NextResponse.json(
      { error: "TELEGRAM_ADMIN_CHAT_ID는 숫자만 입력해야 합니다." },
      { status: 500 }
    );
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, bankName: true, accountNumber: true, accountHolder: true },
    });
    if (!user) {
      return NextResponse.json({ error: "유저를 찾을 수 없습니다." }, { status: 404 });
    }

    const bot = new TelegramBot(token, { polling: false });
    const text = [
      `신규 가입 유저(아이디: ${user.username})가 우리 회원이 맞습니까?`,
      ``,
      `은행: ${user.bankName}`,
      `계좌번호: ${user.accountNumber}`,
      `예금주: ${user.accountHolder}`,
    ].join("\n");
    const keyboard = {
      inline_keyboard: [
        [
          { text: "승인", callback_data: `approve:${user.id}` },
          { text: "거절", callback_data: `reject:${user.id}` },
        ],
      ],
    };

    await bot.sendMessage(adminChatId, text, { reply_markup: keyboard });

    return NextResponse.json({ ok: true, message: "텔레그램으로 확인 요청을 보냈습니다." });
  } catch (err: unknown) {
    const e = err as { message?: string; response?: { body?: unknown }; body?: unknown };
    const telegramBody = e?.response?.body ?? e?.body;
    console.error("텔레그램 발송 실패:", e?.message ?? err);
    if (telegramBody !== undefined) {
      console.error("텔레그램 서버 응답 body:", JSON.stringify(telegramBody, null, 2));
    } else if (err && typeof err === "object") {
      console.error("에러 객체 전체:", JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
    }
    const detail = typeof telegramBody === "object" && telegramBody !== null && "description" in telegramBody
      ? String((telegramBody as { description: string }).description)
      : e?.message ?? String(err);
    return NextResponse.json(
      {
        error: "텔레그램 발송 중 오류가 발생했습니다.",
        detail: process.env.NODE_ENV === "development" ? detail : undefined,
      },
      { status: 500 }
    );
  }
}
