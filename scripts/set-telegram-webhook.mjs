/**
 * 텔레그램 봇 웹훅 등록
 * - 승인/거절 버튼 등 callback_query가 서버로 전달되려면 반드시 웹훅 등록 필요
 *
 * 사용법:
 *   node scripts/set-telegram-webhook.mjs https://your-site.netlify.app
 *   또는 .env에 TELEGRAM_WEBHOOK_URL=https://your-site.netlify.app 설정 후
 *   node scripts/set-telegram-webhook.mjs
 *
 * 웹훅 URL 예: https://papaya-sorbet-3708f7.netlify.app/api/telegram/webhook
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

const token = process.env.TELEGRAM_BOT_TOKEN;
const baseUrl = process.argv[2] || process.env.TELEGRAM_WEBHOOK_URL;

if (!token) {
  console.error("TELEGRAM_BOT_TOKEN이 .env에 없습니다.");
  process.exit(1);
}

if (!baseUrl) {
  console.error("사용법: node scripts/set-telegram-webhook.mjs <웹훅_베이스_URL>");
  console.error("예: node scripts/set-telegram-webhook.mjs https://papaya-sorbet-3708f7.netlify.app");
  process.exit(1);
}

const url = baseUrl.replace(/\/$/, "") + "/api/telegram/webhook";

async function setWebhook() {
  const apiUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`;
  const res = await fetch(apiUrl);
  const json = await res.json();
  if (json.ok) {
    console.log("웹훅 등록 성공:", url);
    return;
  }
  console.error("웹훅 등록 실패:", json.description || json);
  process.exit(1);
}

setWebhook();
