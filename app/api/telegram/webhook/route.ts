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

  const getListText = async (listType: "signup" | "buy" | "sell"): Promise<string> => {
    const limit = 15;
    try {
      if (listType === "signup") {
        const users = await prisma.user.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          select: { username: true, status: true, accountHolder: true, createdAt: true },
        });
        let text = "📋 최근 가입 요청/회원 (최대 15건)\n\n";
        if (users.length === 0) text += "데이터 없음.";
        else {
          users.forEach((u, i) => {
            const dateStr = new Date(u.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
            const statusEmoji = u.status === "APPROVED" ? "✅" : u.status === "REJECTED" ? "❌" : "⏳";
            text += `${i + 1}. ${statusEmoji} ${u.username} | ${u.accountHolder} | ${dateStr}\n`;
          });
        }
        return text;
      }
      const type = listType === "buy" ? "BUY" : "SELL";
      const label = listType === "buy" ? "구매" : "판매";
      const rows = await prisma.transaction.findMany({
        where: { type: type },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: { user: { select: { username: true } } },
      });
      let text = `📋 최근 ${label} 요청 (최대 15건)\n\n`;
      if (rows.length === 0) text += "데이터 없음.";
      else {
        rows.forEach((t, i) => {
          const dateStr = new Date(t.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
          const statusEmoji = t.status === "APPROVED" ? "✅" : t.status === "REJECTED" ? "❌" : "⏳";
          text += `${i + 1}. ${statusEmoji} ${t.user.username} | ${t.amount.toLocaleString("ko-KR")}원 | ${dateStr}\n`;
        });
      }
      return text;
    } catch (e) {
      console.error("[webhook] list query error:", e);
      return "목록 조회 중 오류가 발생했습니다.";
    }
  };

  try {
    if (body.callback_query) {
      const { id: queryId, data } = body.callback_query;
      const chatId = body.callback_query.message?.chat.id;
      const messageId = body.callback_query.message?.message_id;

      if (!data || !chatId || messageId == null) {
        await bot.answerCallbackQuery(queryId);
        return NextResponse.json({ ok: true });
      }

      // 목록 조회 (인라인 콜백): list:signup | list:buy | list:sell
      if (data.startsWith("list:")) {
        const listType = data.slice(5) as "signup" | "buy" | "sell";
        const text = listType === "signup" || listType === "buy" || listType === "sell" ? await getListText(listType) : "잘못된 목록 타입입니다.";
        await bot.answerCallbackQuery(queryId);
        await bot.sendMessage(chatId, text).catch((e) => console.error("[webhook] sendMessage list 실패:", e));
        return NextResponse.json({ ok: true });
      }

      // 계좌 변경 승인/거부: acc:approve:id | acc:reject:id
      if (data.startsWith("acc:")) {
        const [, accAction, reqId] = data.split(":");
        if (!reqId || (accAction !== "approve" && accAction !== "reject")) {
          await bot.answerCallbackQuery(queryId);
          return NextResponse.json({ ok: true });
        }

        const accReq = await prisma.accountChangeRequest.findUnique({
          where: { id: reqId },
          include: { user: { select: { username: true } } },
        });
        if (!accReq || accReq.status !== "PENDING") {
          await bot.answerCallbackQuery(queryId);
          return NextResponse.json({ ok: true });
        }

        const processedAt = new Date();
        if (accAction === "approve") {
          await prisma.$transaction([
            prisma.user.update({
              where: { id: accReq.userId },
              data: {
                accountHolder: accReq.afterHolder,
                bankName: accReq.afterBank,
                accountNumber: accReq.afterAccount,
              },
            }),
            prisma.accountChangeRequest.update({
              where: { id: reqId },
              data: { status: "APPROVED", processedAt },
            }),
          ]);
          const resultText =
            `✅ 계좌 변경 승인\n` +
            `아이디: ${accReq.user.username}\n` +
            `변경 전: ${accReq.beforeHolder} / ${accReq.beforeBank} / ${accReq.beforeAccount}\n` +
            `변경 후: ${accReq.afterHolder} / ${accReq.afterBank} / ${accReq.afterAccount}`;
          await bot.answerCallbackQuery(queryId);
          await bot.editMessageText(resultText, { chat_id: chatId, message_id: messageId }).catch(() => {});
        } else {
          await prisma.accountChangeRequest.update({
            where: { id: reqId },
            data: { status: "REJECTED", processedAt },
          });
          const resultText =
            `❌ 계좌 변경 거부\n` +
            `아이디: ${accReq.user.username}\n` +
            `요청 계좌: ${accReq.afterHolder} / ${accReq.afterBank} / ${accReq.afterAccount}`;
          await bot.answerCallbackQuery(queryId);
          await bot.editMessageText(resultText, { chat_id: chatId, message_id: messageId }).catch(() => {});
        }
        return NextResponse.json({ ok: true });
      }

      // 거래 승인/거절: txn:approve:id | txn:reject:id
      if (data.startsWith("txn:")) {
        const [, txnAction, txnId] = data.split(":");
        if (!txnId || (txnAction !== "approve" && txnAction !== "reject")) {
          await bot.answerCallbackQuery(queryId);
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
          await bot.answerCallbackQuery(queryId);
          return NextResponse.json({ ok: true });
        }

        const typeIcon = txn.type === "BUY" ? "🔵" : "🔴";
        const typeLabel = txn.type === "BUY" ? "구매" : "판매";
        const dateStr = txn.createdAt
          ? new Date(txn.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
          : "";
        const rejectDateStr = txn.createdAt
          ? (() => {
              const d = new Date(txn.createdAt);
              const ampm = d.getHours() < 12 ? "AM" : "PM";
              const h = String(d.getHours() % 12 || 12).padStart(2, "0");
              const min = String(d.getMinutes()).padStart(2, "0");
              return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${ampm} ${h}:${min}`;
            })()
          : "";

        if (txnAction === "approve") {
          await prisma.transaction.update({
            where: { id: txnId },
            data: { status: "APPROVED" },
          });
          const resultText = `${typeIcon} ${typeLabel} 승인\n아이디: ${txn.user.username}\n금액: ${txn.amount.toLocaleString("ko-KR")}원\n날짜: ${dateStr}`;
          await bot.answerCallbackQuery(queryId);
          await bot.editMessageText(resultText, { chat_id: chatId, message_id: messageId }).catch((e) => {
            console.error("[webhook] editMessageText 실패:", e);
          });
        } else {
          await prisma.transaction.update({
            where: { id: txnId },
            data: { status: "REJECTED" },
          });
          const resultText = `❌ ${typeIcon}${typeLabel} 승인 거절\n아이디: ${txn.user.username}\n금액: ${txn.amount.toLocaleString("ko-KR")}원\n날짜: ${rejectDateStr}`;
          await bot.answerCallbackQuery(queryId);
          await bot.editMessageText(resultText, { chat_id: chatId, message_id: messageId }).catch(() => {});
        }
        return NextResponse.json({ ok: true });
      }

      // 회원 가입 승인/거절: approve:userId | reject:userId
      const [action, userId] = data.split(":");
      if (!userId || (action !== "approve" && action !== "reject")) {
        await bot.answerCallbackQuery(queryId);
        return NextResponse.json({ ok: true });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, bankName: true, accountNumber: true, accountHolder: true, createdAt: true },
      });

      const newStatus = action === "approve" ? "APPROVED" : "REJECTED";
      await prisma.user.update({
        where: { id: userId },
        data: { status: newStatus },
      });

      const formatSignupDate = (date: Date) => {
        const d = new Date(date);
        const ampm = d.getHours() < 12 ? "AM" : "PM";
        const h = String(d.getHours() % 12 || 12).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, "0")}. ${String(d.getDate()).padStart(2, "0")}. ${ampm} ${h}:${min}`;
      };
      const memberInfo = user
        ? `\n회원 아이디: ${user.username}\n은행명: ${user.bankName}\n계좌번호: ${user.accountNumber}\n예금주: ${user.accountHolder}${user.createdAt ? `\n가입날짜: ${formatSignupDate(user.createdAt)}` : ""}`
        : "";
      const resultText =
        action === "approve"
          ? `✅ BETEAST AXPAY 회원 가입 승인${memberInfo}`
          : `❌ BETEAST AXPAY 회원 가입 거부${memberInfo}`;
      await bot.answerCallbackQuery(queryId);
      await bot.editMessageText(resultText, {
        chat_id: chatId,
        message_id: messageId,
      }).catch(() => {});

      return NextResponse.json({ ok: true });
    }

    if (body.message?.text === "/start") {
      const chatId = body.message.chat.id;
      const reply_markup = {
        keyboard: [[{ text: "ADMIN" }]],
        resize_keyboard: true,
      };
      try {
        await bot.sendMessage(
          chatId,
          `이 채팅방은 가맹점 "벳이스트" 전용방입니다.\n궁금하신점은 본사로 문의주세여`,
          { reply_markup: reply_markup as unknown as Record<string, unknown> }
        );
      } catch (e) {
        console.error("[webhook] /start sendMessage 실패:", e);
        await bot.sendMessage(chatId, `이 채팅방은 가맹점 "벳이스트" 전용방입니다.\n궁금하신점은 본사로 문의주세여`).catch(() => {});
      }
      return NextResponse.json({ ok: true });
    }

    // 키보드 버튼 "ADMIN" 탭 → 인라인 URL 버튼 (탭 시 링크 바로 열림)
    if (body.message?.text === "ADMIN") {
      const chatId = body.message.chat.id;
      const adminUrl = "https://papaya-sorbet-3708f7.netlify.app/admin";
      const reply_markup = {
        inline_keyboard: [[{ text: "ADMIN", url: adminUrl }]],
      };
      await bot.sendMessage(chatId, "관리자페이지 열기", {
        reply_markup: reply_markup as unknown as Record<string, unknown>,
      }).catch((e) => console.error("[webhook] Admin 버튼 전송 실패:", e));
      return NextResponse.json({ ok: true });
    }
  } catch (err) {
    console.error("Telegram webhook error:", err);
  }

  return NextResponse.json({ ok: true });
}
