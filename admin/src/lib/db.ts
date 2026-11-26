import "server-only";

import mysql from "mysql2/promise";

// admin은 back과 별개인 Next.js 앱이고 엔티티·마이그레이션은 back이 소유한다. admin은 카탈로그 조회와
// SCHEDULED 작품·회차 insert만 하므로 TypeORM 엔티티를 복제하지 않고 mysql2 SQL을 직접 쓴다.

const globalForDb = globalThis as unknown as { db?: mysql.Pool };

function createPool() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    timezone: "Z",
    connectionLimit: 5,
  });
  // DB 시간은 UTC로 저장한다(common-rules.md). 서버 시간대가 KST여도 CURRENT_TIMESTAMP 기본값이 UTC가 되게 한다.
  pool.on("connection", (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  return pool;
}

// next dev가 모듈을 다시 읽어도 연결 풀을 하나만 쓴다.
export const db = globalForDb.db ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}
