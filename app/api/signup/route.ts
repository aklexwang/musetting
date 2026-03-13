import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import TelegramBot from "node-telegram-bot-api";
import { prisma } from "@/lib/prisma";

const signupBodySchema = z.object({
  username: z
    .string()
    .min(1, "아이디를 입력해 주세요.")
    .min(2, "아이디는 2자 이상이어야 합니다."),
  password: z
    .string()
    .min(1, "비밀번호를 입력해 주세요.")
    .min(6, "비밀번호는 6자 이상이어야 합니다."),
  bankName: z.string().min(1, "은행명을 입력해 주세요."),
  accountNumber: z
    .string()
    .min(1, "계좌번호를 입력해 주세요.")
    .regex(/^[0-9-]+$/, "계좌번호는 숫자만 입력 가능합니다."),
  accountHolder: z.string().min(1, "예금주를 입력해 주세요."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupBodySchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.flatten().fieldErrors;
      const message =
        Object.values(firstError)[0]?.[0] ?? "입력값을 확인해 주세요.";
      return NextResponse.json(
        { error: message },
        { status: 400 }
      );
    }

    const { username, password, bankName, accountNumber, accountHolder } =
      parsed.data;

    const existing = await prisma.user.findUnique({
      where: { username },
    });

    if (existing) {
      return NextResponse.json(
        { error: "이미 사용 중인 아이디입니다." },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        bankName,
        accountNumber,
        accountHolder,
        role: "USER",
        status: "PENDING",
      },
    });

    const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
    const adminChatIdRaw = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
    let telegramSent = false;
    if (!token) {
      console.warn("[signup] 텔레그램 미발송: TELEGRAM_BOT_TOKEN 없음");
    } else if (!adminChatIdRaw) {
      console.warn("[signup] 텔레그램 미발송: TELEGRAM_ADMIN_CHAT_ID 없음");
    } else {
      const adminChatId = Number(adminChatIdRaw);
      if (Number.isNaN(adminChatId)) {
        console.warn("[signup] 텔레그램 미발송: TELEGRAM_ADMIN_CHAT_ID가 숫자가 아님", adminChatIdRaw);
      } else {
        try {
          const bot = new TelegramBot(token, { polling: false });
          const text = [
            `신규 가입 유저(아이디: ${user.username})가 우리 회원이 맞습니까?`,
            ``,
            `은행: ${user.bankName}`,
            `계좌번호: ${user.accountNumber}`,
            `예금주: ${user.accountHolder}`,
          ].join("\n");
          await bot.sendMessage(adminChatId, text, {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "승인", callback_data: `approve:${user.id}` },
                  { text: "거절", callback_data: `reject:${user.id}` },
                ],
              ],
            },
          });
          telegramSent = true;
          console.log("[signup] 텔레그램 발송 성공:", user.username);
        } catch (err) {
          console.error("[signup] 텔레그램 발송 실패:", err);
        }
      }
    }

    return NextResponse.json(
      {
        message: "가입 요청이 완료되었습니다. 텔레그램에서 관리자 승인을 기다려 주세요.",
        telegramSent,
      },
      { status: 201 }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
    console.error("Signup API error:", err);
    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "가입 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
      },
      { status: 500 }
    );
  }
}
