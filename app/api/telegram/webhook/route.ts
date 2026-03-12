import { NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";

const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = token ? new TelegramBot(token, { polling: false }) : null;

type TelegramUpdate = {
  update_id: number;
  callback_query?: {
    id: string;
    from: { id: number };
    message?: { chat: { id: number }; message_id: number };
    data?: string;
  };
  message?: {
    chat: { id: number };
    text?: string;
  };
};

/** 웹훅 URL 확인용 (브라우저/Telegram 검증) - GET /api/telegram/webhook */
export async function GET() {
  return NextResponse.json(
    { ok: true, message: "Telegram webhook endpoint. Use POST for updates." },
    { status: 200 }
  );
}

/** 텔레그램 업데이트 수신 - POST /api/telegram/webhook (setWebhook 로 등록할 URL) */
export async function POST(request: Request) {
  if (!bot) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let body: TelegramUpdate;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    if (body.callback_query) {
      const { id: queryId, data } = body.callback_query;
      const chatId = body.callback_query.message?.chat.id;
      const messageId = body.callback_query.message?.message_id;

      if (!data || !chatId || messageId == null) {
        await bot.answerCallbackQuery(queryId, { text: "처리할 수 없습니다." });
        return NextResponse.json({ ok: true });
      }

      const [action, userId] = data.split(":");
      if (!userId || (action !== "approve" && action !== "reject")) {
        await bot.answerCallbackQuery(queryId, { text: "잘못된 요청입니다." });
        return NextResponse.json({ ok: true });
      }

      const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
      await prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });

      const resultText = action === "approve" ? "✅ 승인되었습니다." : "❌ 거절되었습니다.";
      await bot.answerCallbackQuery(queryId, { text: resultText });
      await bot.editMessageText(resultText, {
        chat_id: chatId,
        message_id: messageId,
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === "/start") {
      const chatId = body.message.chat.id;
      await bot.sendMessage(
        chatId,
        `이 채팅의 Chat ID는 \`${chatId}\` 입니다.\n.env 에 TELEGRAM_ADMIN_CHAT_ID=${chatId} 로 설정하세요.`
      );
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
