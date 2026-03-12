/**
 * Prisma migrate가 P1001으로 실패할 때, pg로 마이그레이션 SQL 직접 적용
 * 사용법: node scripts/apply-migration-manual.js
 * (prisma dev 가 켜져 있어야 함)
 */
const path = require("path");
const fs = require("fs");
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach((line) => {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, "");
  });
}
const { Client } = require("pg");

const url = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable";
const migrationDir = path.join(__dirname, "..", "prisma", "migrations", "20260312050000_add_can_buy_can_sell");
const migrationSql = path.join(migrationDir, "migration.sql");

const migrationName = "20260312050000_add_can_buy_can_sell";

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    // 이미 적용됐는지 확인
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id VARCHAR(36) PRIMARY KEY,
        checksum VARCHAR(64) NOT NULL,
        finished_at TIMESTAMPTZ,
        migration_name VARCHAR(255) NOT NULL,
        logs TEXT,
        rolled_back_at TIMESTAMPTZ,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        applied_steps_count INTEGER NOT NULL DEFAULT 0
      )
    `);
    const check = await client.query(
      'SELECT 1 FROM "_prisma_migrations" WHERE migration_name = $1',
      [migrationName]
    );
    if (check.rows.length > 0) {
      console.log("이미 적용된 마이그레이션입니다:", migrationName);
      return;
    }

    const sql = fs.readFileSync(migrationSql, "utf8");
    await client.query(sql);
    console.log("마이그레이션 SQL 실행 완료:", migrationName);

    const checksum = require("crypto").createHash("sha256").update(sql).digest("hex");
    await client.query(
      `INSERT INTO "_prisma_migrations" (id, checksum, migration_name, finished_at, applied_steps_count)
       VALUES ($1, $2, $3, now(), 1)`,
      [require("crypto").randomUUID(), checksum, migrationName]
    );
    console.log("_prisma_migrations 에 기록 완료. 이제 prisma migrate dev 는 이 마이그레이션을 적용된 것으로 인식합니다.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
