/**
 * AxPay 화이트리스트 확인: 로그인 정보 재조회 API(3.6) order_info 호출
 * - multipart/form-data, token + user_id만 전송
 * - 요청 직전 "실제 요청을 보내는 서버의 외부 IP" 로그
 * - 응답이 token error! / tokenabsent! 인지 확인
 *
 * 실행: node scripts/check-axpay-whitelist.mjs
 * .env 의 AXPAY_TOKEN, (선택) AXPAY_TEST_USER_ID 사용
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  content.split("\n").forEach((line) => {
    const i = line.indexOf("=");
    if (i <= 0) return;
    const key = line.slice(0, i).trim();
    let val = line.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (key) process.env[key] = val;
  });
}
loadEnv();

const AXPAY_BASE_URL = (process.env.AXPAY_BASE_URL || "https://manage.test999.vip").replace(/\/$/, "");
const AXPAY_TOKEN = process.env.AXPAY_TOKEN?.trim();
const TEST_USER_ID = process.env.AXPAY_TEST_USER_ID?.trim() || "test_whitelist_check";

async function getOutboundIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    return json?.ip || null;
  } catch (e) {
    console.warn("외부 IP 조회 실패:", e?.message);
    return null;
  }
}

async function main() {
  console.log("=== AxPay 화이트리스트 확인 (order_info 3.6) ===\n");

  if (!AXPAY_TOKEN) {
    console.error("AXPAY_TOKEN이 .env에 없습니다.");
    process.exit(1);
  }

  const outboundIp = await getOutboundIp();
  console.log("요청을 보내는 서버의 외부 IP:", outboundIp ?? "(조회 실패)\n");

  const url = `${AXPAY_BASE_URL}/api/index/order_info`;
  const form = new FormData();
  form.append("token", String(AXPAY_TOKEN));
  form.append("user_id", String(TEST_USER_ID));

  console.log("요청 URL:", url);
  console.log("필드: token=[SET], user_id=" + TEST_USER_ID + "\n");

  try {
    const res = await fetch(url, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    let json = {};
    try {
      json = JSON.parse(text);
    } catch {}

    const code = json.code;
    const msg = (json.msg ?? json.message ?? "").trim().toLowerCase();

    console.log("HTTP 상태:", res.status);
    console.log("응답 본문:", text.slice(0, 500));
    console.log("");

    if (msg.includes("token error") || msg.includes("tokenerror")) {
      console.log("[체크] token error! → 토큰 오류 (IP/토큰 확인 필요)");
    } else if (msg.includes("tokenabsent") || msg.includes("token absent")) {
      console.log("[체크] tokenabsent! → 토큰 누락 또는 IP 미등록 가능성");
    } else if (code === 0) {
      console.log("[체크] code=0 성공 → IP 화이트리스트에 등록된 것으로 추정");
    } else if (code === 1) {
      console.log("[체크] code=1 실패, msg:", json.msg ?? msg);
    } else {
      console.log("[체크] 기타 응답 (위 본문 참고)");
    }
  } catch (err) {
    console.error("요청 실패:", err?.message ?? err);
    process.exit(1);
  }
}

main();
