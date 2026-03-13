import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const token = process.env.TELEGRAM_BOT_TOKEN;

async function getBot() {
  if (!token) return null;
  const { default: TelegramBot } = await import("node-telegram-bot-api");
  return new TelegramBot(token, { polling: false });
}

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
  const bot = await getBot();
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

      // 목록 조회: list:signup | list:buy | list:sell (지난 데이터 분류별 확인)
      if (data.startsWith("list:")) {
        const listType = data.slice(5) as "signup" | "buy" | "sell";
        const limit = 15;
        let text = "";

        try {
          if (listType === "signup") {
            const users = await prisma.user.findMany({
              orderBy: { createdAt: "desc" },
              take: limit,
              select: { username: true, status: true, accountHolder: true, createdAt: true },
            });
            text = "📋 최근 가입 요청/회원 (최대 15건)\n\n";
            if (users.length === 0) text += "데이터 없음.";
            else {
              users.forEach((u, i) => {
                const dateStr = new Date(u.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
                const statusEmoji = u.status === "APPROVED" ? "✅" : u.status === "REJECTED" ? "❌" : "⏳";
                text += `${i + 1}. ${statusEmoji} ${u.username} | ${u.accountHolder} | ${dateStr}\n`;
              });
            }
          } else if (listType === "buy" || listType === "sell") {
            const type = listType === "buy" ? "BUY" : "SELL";
            const label = listType === "buy" ? "구매" : "판매";
            const rows = await prisma.transaction.findMany({
              where: { type: type },
              orderBy: { createdAt: "desc" },
              take: limit,
              include: { user: { select: { username: true } } },
            });
            text = `📋 최근 ${label} 요청 (최대 15건)\n\n`;
            if (rows.length === 0) text += "데이터 없음.";
            else {
              rows.forEach((t, i) => {
                const dateStr = new Date(t.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
                const statusEmoji = t.status === "APPROVED" ? "✅" : t.status === "REJECTED" ? "❌" : "⏳";
                text += `${i + 1}. ${statusEmoji} ${t.user.username} | ${t.amount.toLocaleString("ko-KR")}원 | ${dateStr}\n`;
              });
            }
          } else {
            text = "잘못된 목록 타입입니다.";
          }
        } catch (e) {
          console.error("[webhook] list query error:", e);
          text = "목록 조회 중 오류가 발생했습니다.";
        }

        await bot.answerCallbackQuery(queryId, { text: "목록 조회됨" });
        await bot.sendMessage(chatId, text).catch((e) => {
          console.error("[webhook] sendMessage list 실패:", e);
        });
        return NextResponse.json({ ok: true });
      }

      // 거래 승인/거절: txn:approve:id | txn:reject:id
      if (data.startsWith("txn:")) {
        const [, txnAction, txnId] = data.split(":");
        if (!txnId || (txnAction !== "approve" && txnAction !== "reject")) {
          await bot.answerCallbackQuery(queryId, { text: "잘못된 요청입니다." });
          return NextResponse.json({ ok: true });
        }

        const txn = await prisma.transaction.findUnique({
          where: { id: txnId },
          include: {
            user: {
              select: { username: true, bankName: true, accountNumber: true, accountHolder: true },
            },
          },
        });
        if (!txn) {
          await bot.answerCallbackQuery(queryId, { text: "거래를 찾을 수 없습니다." });
          return NextResponse.json({ ok: true });
        }

        if (txnAction === "approve") {
          await prisma.transaction.update({
            where: { id: txnId },
            data: { status: "APPROVED" },
          });
          const typeLabel = txn.type === "BUY" ? "구매" : "판매";
          const dateStr = txn.createdAt
            ? new Date(txn.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
            : "";
          const resultText = `✅ 승인되었습니다. (${typeLabel})\n아이디: ${txn.user.username}\n금액: ${txn.amount.toLocaleString("ko-KR")}원\n날짜: ${dateStr}`;
          await bot.answerCallbackQuery(queryId, { text: "승인되었습니다." });
          await bot.editMessageText(resultText, { chat_id: chatId, message_id: messageId }).catch((e) => {
            console.error("[webhook] editMessageText 실패:", e);
          });
        } else {
          await prisma.transaction.update({
            where: { id: txnId },
            data: { status: "REJECTED" },
          });
          const typeLabel = txn.type === "BUY" ? "구매" : "판매";
          const resultText = `❌ 거래 거절 (${typeLabel}).\n아이디: ${txn.user.username}\n금액: ${txn.amount.toLocaleString("ko-KR")}원`;
          await bot.answerCallbackQuery(queryId, { text: "거절되었습니다." });
          await bot.editMessageText(resultText, { chat_id: chatId, message_id: messageId }).catch(() => {});
        }
        return NextResponse.json({ ok: true });
      }

      // 회원 가입 승인/거절: approve:userId | reject:userId
      const [action, userId] = data.split(":");
      if (!userId || (action !== "approve" && action !== "reject")) {
        await bot.answerCallbackQuery(queryId, { text: "잘못된 요청입니다." });
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, accountHolder: true, createdAt: true },
      });

      const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
      await prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });

      const memberInfo = user
        ? `\n회원 아이디: ${user.username}\n예금주: ${user.accountHolder}${user.createdAt ? `\n가입날짜: ${new Date(user.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}` : ""}`
        : "";
      const resultText =
        action === "approve"
          ? `✅ 가입승인되었습니다.${memberInfo}`
          : `❌ 거절되었습니다.${memberInfo}`;
      await bot.answerCallbackQuery(queryId, { text: resultText });
      await bot.editMessageText(resultText, {
        chat_id: chatId,
        message_id: messageId,
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === "/start") {
      const chatId = body.message.chat.id;
      const reply_markup = {
        inline_keyboard: [
          [{ text: "📋 가입", callback_data: "list:signup" }, { text: "📋 구매", callback_data: "list:buy" }, { text: "📋 판매", callback_data: "list:sell" }],
        ],
      };
      try {
        await bot.sendMessage(
          chatId,
          `이 채팅방은 가맹점 "벳이스트" 전용방입니다.\n궁금하신점은 본사로 문의주세여\n\n아래 버튼으로 지난 가입/구매/판매 데이터를 확인할 수 있습니다.`,
          { reply_markup }
        );
      } catch (e) {
        console.error("[webhook] /start sendMessage 실패:", e);
        await bot.sendMessage(chatId, `이 채팅방은 가맹점 "벳이스트" 전용방입니다.\n궁금하신점은 본사로 문의주세여`).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
