import { getRequestContext } from "../../../lib/supabase/request";
import { createFingerprint } from "../../lib/finance";

export const dynamic = "force-dynamic";


export async function GET(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const { data, error } = await supabase.from("transactions").select("*")
    .order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(1000);
  return error
    ? Response.json({ error: error.message }, { status: 500 })
    : Response.json({ transactions: (data ?? []).map(toClientTransaction) });
}

export async function POST(request: Request) {
  const { supabase, user } = await getRequestContext(request);
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
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
  const { data, error } = await supabase.from("transactions").insert({
    user_id: user.id, account_id: accountId, name, category,
    amount: Math.round(amount * 100) / 100, kind, transaction_date: date,
    fingerprint: createFingerprint(date, amount, kind, `${name}|manual|${Date.now()}`),
  }).select().single();
  return error
    ? Response.json({ error: error.message }, { status: 400 })
    : Response.json({ transaction: toClientTransaction(data) }, { status: 201 });
}

function toClientTransaction(row: Record<string, unknown>) {
  return {
    id: row.id, accountId: row.account_id, name: row.name, category: row.category,
    amount: row.amount, kind: row.kind, date: row.transaction_date,
    source: row.source, fingerprint: row.fingerprint,
  };
}
