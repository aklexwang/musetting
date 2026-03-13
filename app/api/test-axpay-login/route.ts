import { NextResponse } from "next/server";
import { login as axpayLogin } from "@/lib/axpay";

/**
 * Netlify(98.92.91.201)에서 AxPay 로그인 API를 호출해 봄.
 * 브라우저나 curl로 이 URL 호출 → Netlify 서버가 AxPay 호출 → 요청 출발지 IP = 98.92.91.201
 *
 * 사용: GET https://papaya-sorbet-3708f7.netlify.app/api/test-axpay-login
 * (테스트 후 이 라우트 삭제하거나 비활성화 권장)
 */
export async function GET() {
  const result = await axpayLogin({
    username: "killman",
    bankName: "산업은행",
    accountNumber: "234342342334",
    accountHolder: "이순신",
    amount: 10000,
    type: "BUY",
  });
  return NextResponse.json({
    note: "이 요청은 Netlify(98.92.91.201)에서 AxPay로 나갑니다.",
    axpay_result: result,
  });
}
