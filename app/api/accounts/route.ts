import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const defaultAccounts = [
  { name: "ING Current", institution: "ING", type: "bank", color: "#ff6200" },
  { name: "Cash wallet", institution: "Cash", type: "cash", color: "#42efb1" },
  { name: "Emergency savings", institution: "Manual", type: "savings", color: "#a78bfa" },
];

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await context();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  let { data, error } = await supabase.from("accounts").select("*").order("created_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data?.length) {
    const seeded = await supabase.from("accounts").insert(defaultAccounts.map((account) => ({ ...account, user_id: user.id }))).select();
    data = seeded.data;
    error = seeded.error;
  }
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ accounts: (data ?? []).map(toClientAccount) });
}

export async function POST(request: Request) {
  const { supabase, user } = await context();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 60);
  if (!name) return Response.json({ error: "Account name is required." }, { status: 400 });
  const { data, error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name,
    institution: String(body.institution ?? "Manual").trim().slice(0, 50),
    type: validType(String(body.type)) ? String(body.type) : "bank",
    current_balance: Number(body.currentBalance) || 0,
    last_four: String(body.lastFour ?? "").replace(/\D/g, "").slice(-4) || null,
    color: String(body.color ?? "#42efb1").slice(0, 20),
  }).select().single();
  return error
    ? Response.json({ error: error.message }, { status: 400 })
    : Response.json({ account: toClientAccount(data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await context();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const balance = Number(body.currentBalance);
  if (!id || !Number.isFinite(balance)) return Response.json({ error: "Valid account and balance required." }, { status: 400 });
  const { data, error } = await supabase.from("accounts")
    .update({ current_balance: Math.round(balance * 100) / 100 })
    .eq("id", id).select().single();
  return error
    ? Response.json({ error: error.message }, { status: 404 })
    : Response.json({ account: toClientAccount(data) });
}

function validType(value: string) {
  return ["bank", "credit", "debit", "cash", "savings", "stock", "investment", "crypto", "property", "pension", "loan", "income", "other"].includes(value);
}

function toClientAccount(row: Record<string, unknown>) {
  return {
    id: row.id, name: row.name, institution: row.institution, type: row.type,
    currency: row.currency, currentBalance: row.current_balance,
    lastFour: row.last_four, color: row.color,
  };
}
