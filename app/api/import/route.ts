import { getRequestContext } from "../../../lib/supabase/request";
import { createFingerprint } from "../../lib/finance";

export const dynamic = "force-dynamic";

type IncomingRow = {
  name?: string; category?: string; amount?: number; kind?: string; date?: string;
  fingerprint?: string; originalDescription?: string; source?: string;
};

export async function POST(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as { accountId?: number; rows?: IncomingRow[] };
  const accountId = Number(body.accountId);
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2500) : [];
  if (!accountId || !rows.length) return Response.json({ error: "Choose an account and provide transactions." }, { status: 400 });

  const owned = await supabase.from("accounts").select("id").eq("id", accountId).maybeSingle();
  if (!owned.data) return Response.json({ error: "That account is not available." }, { status: 403 });

  const validRows = rows.flatMap((row) => {
    const name = String(row.name ?? "").trim().slice(0, 100);
    const category = String(row.category ?? "Other").trim().slice(0, 40);
    const amount = Number(row.amount);
    const kind = row.kind === "income" ? "income" : "expense";
    const date = String(row.date ?? "");
    if (!name || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    return [{
      user_id: user.id, account_id: accountId, name, category,
      amount: Math.round(amount * 100) / 100, kind, transaction_date: date,
      source: row.source === "ing_pdf" ? "ing_pdf" : "ing_csv",
      fingerprint: String(row.fingerprint ?? "") || createFingerprint(date, amount, kind, String(row.originalDescription ?? name)),
      original_description: String(row.originalDescription ?? name).slice(0, 500),
    }];
  });

  const fingerprints = validRows.map((row) => row.fingerprint);
  const existing = fingerprints.length
    ? await supabase.from("transactions").select("fingerprint").in("fingerprint", fingerprints)
    : { data: [], error: null };
  if (existing.error) return Response.json({ error: existing.error.message }, { status: 400 });
  const existingSet = new Set((existing.data ?? []).map((row) => row.fingerprint));
  const seen = new Set<string>();
  const uniqueRows = validRows.filter((row) => {
    if (existingSet.has(row.fingerprint) || seen.has(row.fingerprint)) return false;
    seen.add(row.fingerprint);
    return true;
  });
  if (!uniqueRows.length) return Response.json({ imported: 0, duplicates: validRows.length, transactions: [] });
  const inserted = await supabase.from("transactions").insert(uniqueRows).select();
  if (inserted.error) return Response.json({ error: inserted.error.message }, { status: 400 });
  return Response.json({
    imported: inserted.data.length,
    duplicates: validRows.length - inserted.data.length,
    transactions: inserted.data.map((row) => ({
      id: row.id, accountId: row.account_id, name: row.name, category: row.category,
      amount: row.amount, kind: row.kind, date: row.transaction_date,
      source: row.source, fingerprint: row.fingerprint,
    })),
  });
}
