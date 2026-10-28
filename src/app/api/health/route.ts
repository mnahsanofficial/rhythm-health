import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function GET() {
  await connection(); // run per request, not at build time
  const row = db.get<{ version: string }>(sql`select sqlite_version() as version`);
  return Response.json({ ok: true, sqlite: row.version });
}
