import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { accounts, transactions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { createFingerprint } from "../../lib/finance";

export const dynamic = "force-dynamic";

type IncomingRow = {
  name?: string;
  category?: string;
  amount?: number;
  kind?: string;
  date?: string;
  fingerprint?: string;
  originalDescription?: string;
  source?: string;
};

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as { accountId?: number; rows?: IncomingRow[] };
  const accountId = Number(body.accountId);
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2500) : [];
  if (!accountId || !rows.length) return Response.json({ error: "Choose an account and provide transactions." }, { status: 400 });

  const db = await getDb();
  const [ownedAccount] = await db.select({ id: accounts.id }).from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userEmail, user.email))).limit(1);
  if (!ownedAccount) return Response.json({ error: "That account is not available." }, { status: 403 });

  const validRows = rows.flatMap((row) => {
    const name = String(row.name ?? "").trim().slice(0, 100);
    const category = String(row.category ?? "Other").trim().slice(0, 40);
    const amount = Number(row.amount);
    const kind = row.kind === "income" ? "income" as const : "expense" as const;
    const date = String(row.date ?? "");
    if (!name || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const fingerprint = String(row.fingerprint ?? "") || createFingerprint(date, amount, kind, String(row.originalDescription ?? name));
    return [{
      userEmail: user.email,
      accountId,
      name,
      category,
      amount: Math.round(amount * 100) / 100,
      kind,
      transactionDate: date,
      source: row.source === "ing_pdf" ? "ing_pdf" : "ing_csv",
      fingerprint,
      originalDescription: String(row.originalDescription ?? name).slice(0, 500),
    }];
  });

  const fingerprints = validRows.map((row) => row.fingerprint);
  const existing: Array<{ fingerprint: string | null }> = [];
  for (let index = 0; index < fingerprints.length; index += 80) {
    const batch = fingerprints.slice(index, index + 80);
    existing.push(...await db.select({ fingerprint: transactions.fingerprint }).from(transactions)
      .where(and(eq(transactions.userEmail, user.email), inArray(transactions.fingerprint, batch))));
  }
  const existingSet = new Set(existing.map((row) => row.fingerprint));
  const seen = new Set<string>();
  const uniqueRows = validRows.filter((row) => {
    if (existingSet.has(row.fingerprint) || seen.has(row.fingerprint)) return false;
    seen.add(row.fingerprint);
    return true;
  });

  const inserted: Array<typeof transactions.$inferSelect> = [];
  for (let index = 0; index < uniqueRows.length; index += 8) {
    inserted.push(...await db.insert(transactions)
      .values(uniqueRows.slice(index, index + 8))
      .onConflictDoNothing()
      .returning());
  }

  return Response.json({
    imported: inserted.length,
    duplicates: validRows.length - inserted.length,
    transactions: inserted.map((row) => ({
      id: row.id,
      accountId: row.accountId,
      name: row.name,
      category: row.category,
      amount: row.amount,
      kind: row.kind,
      date: row.transactionDate,
      source: row.source,
      fingerprint: row.fingerprint,
    })),
  });
}
