import { NextResponse } from "next/server";

/**
 * 배포된 서버(Netlify 등)에서 AxPay 등으로 요청을 보낼 때 쓰는 아웃바운드 IP 확인용.
 * 이 URL을 브라우저에서 열면, 그 요청을 처리한 서버의 공인 IP가 반환됨.
 * AxPay 화이트리스트에 등록할 IP 확인용.
 */
export async function GET() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000),
    });
    const json = await res.json().catch(() => ({}));
    const ip = (json as { ip?: string })?.ip ?? null;
    return NextResponse.json({ outbound_ip: ip, note: "이 IP를 AxPay 화이트리스트에 등록하세요." });
  } catch (e) {
    return NextResponse.json(
      { error: "IP 조회 실패", message: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
