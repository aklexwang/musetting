/**
 * "관리자 승인중입니다" 걸린 계좌 변경 신청 전부 초기화
 * - status = 'PENDING' 인 AccountChangeRequest 를 'REJECTED' 로 변경
 * - 실행 후 해당 회원들은 다시 계좌 변경 신청 가능
 *
 * 사용법: node scripts/reset-pending-account-requests.mjs
 * .env 의 DATABASE_URL 필요
 */

import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pg from "pg";

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

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL이 .env에 없습니다.");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query(
      `UPDATE "AccountChangeRequest"
       SET status = 'REJECTED', "processedAt" = now(), "processedVia" = 'admin_reset'
       WHERE status = 'PENDING'
       RETURNING id, "userId"`
    );
    const count = res.rowCount ?? 0;
    console.log(`초기화 완료: PENDING → REJECTED ${count}건`);
    if (count > 0 && res.rows?.length) {
      res.rows.forEach((r) => console.log(`  - id: ${r.id}, userId: ${r.userId}`));
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
