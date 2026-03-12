/**
 * DB 연결 테스트 (node scripts/test-db-connection.js)
 * 127.0.0.1:51214 에 실제로 접속되는지 확인
 */
const url = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:51214/template1?sslmode=disable";
const { Client } = require("pg");

const client = new Client({ connectionString: url });

client
  .connect()
  .then(() => {
    console.log("OK: DB 연결 성공");
    return client.query("SELECT 1");
  })
  .then(() => {
    console.log("OK: 쿼리 실행 성공");
    client.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error("연결 실패:", err.message);
    client.end().catch(() => {});
    process.exit(1);
  });
