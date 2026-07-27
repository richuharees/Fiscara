import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { transactions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { createFingerprint } from "../../lib/finance";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userEmail, user.email))
      .orderBy(desc(transactions.transactionDate), desc(transactions.id))
      .limit(1000);
    return Response.json({ transactions: rows.map(toClientTransaction) });
  } catch (error) {
    return Response.json({ error: databaseError(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim().slice(0, 100);
    const category = String(body.category ?? "Other").trim().slice(0, 40);
    const amount = Number(body.amount);
    const kind = body.kind === "income" ? "income" : "expense";
    const date = String(body.date ?? "");
    const accountId = Number(body.accountId) || null;

    if (!name || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json({ error: "Please provide a valid description, amount, and date." }, { status: 400 });
    }

    const db = await getDb();
    const [row] = await db
      .insert(transactions)
      .values({
        userEmail: user.email,
        accountId,
        name,
        category,
        amount: Math.round(amount * 100) / 100,
        kind,
        transactionDate: date,
        fingerprint: createFingerprint(date, amount, kind, `${name}|manual|${Date.now()}`),
      })
      .returning();

    return Response.json({ transaction: toClientTransaction(row) }, { status: 201 });
  } catch (error) {
    return Response.json({ error: databaseError(error) }, { status: 500 });
  }
}

function toClientTransaction(row: typeof transactions.$inferSelect) {
  return {
    id: row.id,
    accountId: row.accountId,
    name: row.name,
    category: row.category,
    amount: row.amount,
    kind: row.kind,
    date: row.transactionDate,
    source: row.source,
    fingerprint: row.fingerprint,
  };
}

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected database error";
  return message.includes("no such table")
    ? "The finance database is being prepared. Please try again shortly."
    : "Your transaction could not be loaded. Please try again.";
}
