import { NextResponse } from "next/server";
import { login as axpayLogin } from "@/lib/axpay";

/**
 * Netlify(98.92.91.201)에서 AxPay 로그인 API를 호출해 봄.
 * ?ascii=1 → 한글 대신 영문으로 전송 (인코딩 차이 테스트)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asciiOnly = searchParams.get("ascii") === "1";

  const result = await axpayLogin({
    username: "killman",
    bankName: asciiOnly ? "KDB" : "산업은행",
    accountNumber: "234342342334",
    accountHolder: asciiOnly ? "Hong" : "이순신",
    amount: 10000,
    type: "BUY",
  });
  return NextResponse.json({
    note: "이 요청은 Netlify(98.92.91.201)에서 AxPay로 나갑니다.",
    test_mode: asciiOnly ? "ASCII only (한글 없음)" : "한글 포함",
    axpay_result: result,
  });
}
