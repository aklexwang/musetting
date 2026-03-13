import { NextResponse } from "next/server";
import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";
import { login as axpayLogin } from "@/lib/axpay";

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
          await bot.answerCallbackQuery(queryId, { text: "AxPay 연동 중..." });
          try {
            console.log("[webhook] AxPay 호출 예정:", txnId, txn.user.username, txn.amount);
            const result = await axpayLogin({
              username: txn.user.username,
              bankName: txn.user.bankName,
              accountNumber: txn.user.accountNumber,
              accountHolder: txn.user.accountHolder,
              amount: txn.amount,
              type: txn.type as "BUY" | "SELL",
            });
            console.log("[webhook] AxPay 결과:", result.success ? "성공" : "실패", result.message ?? "", result.url ? "url수신" : "(url미수신)", result.order_id ?? "");
            await prisma.transaction.update({
              where: { id: txnId },
              data: {
                status: "APPROVED",
                apiStatus: result.success ? "IDLE" : "FAILED",
                axpayOrderId: result.order_id ?? null,
                axpayUrl: result.url ?? null,
              },
            });
            const typeLabel = txn.type === "BUY" ? "구매" : "판매";
            const resultText = result.success
              ? `✅ 거래 승인 완료 (${typeLabel}).\n아이디: ${txn.user.username}\n금액: ${txn.amount.toLocaleString("ko-KR")}원`
              : `⚠️ 거래 승인했으나 AxPay 실패 (${typeLabel}).\n아이디: ${txn.user.username}\n${result.message ?? ""}${result.rawResponse ? "\n" + result.rawResponse : ""}`;
            await bot.editMessageText(resultText, { chat_id: chatId, message_id: messageId }).catch((e) => {
              console.error("[webhook] editMessageText 실패:", e);
            });
          } catch (err) {
            console.error("[webhook] AxPay login error:", err);
            await prisma.transaction.update({
              where: { id: txnId },
              data: { status: "APPROVED", apiStatus: "FAILED" },
            }).catch((e) => console.error("[webhook] transaction update 실패:", e));
            const typeLabel = txn.type === "BUY" ? "구매" : "판매";
            const errMsg = `⚠️ 거래 승인 처리 중 오류 (${typeLabel}).\n아이디: ${txn.user.username}`;
            await bot.editMessageText(errMsg, { chat_id: chatId, message_id: messageId }).catch((e) => {
              console.error("[webhook] editMessageText(오류) 실패:", e);
            });
          }
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
        select: { username: true, accountHolder: true },
      });

      const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
      await prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });

      const memberInfo = user ? `\n회원 아이디: ${user.username}\n예금주: ${user.accountHolder}` : "";
      const resultText =
        action === "approve"
          ? `✅ 승인되었습니다.${memberInfo}`
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
      await bot.sendMessage(
        chatId,
        `이 채팅방은 가맹점 "벳이스트" 전용방입니다.\n궁금하신점은 본사로 문의주세여`
      );
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
