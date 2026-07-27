import { createClient } from "../../../lib/supabase/server";

export const dynamic = "force-dynamic";

const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(request: Request) {
  const { supabase, user } = await context();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!validMonth(month)) return Response.json({ error: "Choose a valid month." }, { status: 400 });
  const [itemsResult, settingsResult] = await Promise.all([
    supabase.from("budget_items").select("*").eq("month_key", month).order("created_at"),
    supabase.from("budget_settings").select("monthly_target").eq("month_key", month).maybeSingle(),
  ]);
  const error = itemsResult.error ?? settingsResult.error;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({
    items: (itemsResult.data ?? []).map(toClientItem),
    target: settingsResult.data?.monthly_target ?? 0,
  });
}

export async function POST(request: Request) {
  const { supabase, user } = await context();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const monthKey = String(body.monthKey ?? "");
  const name = String(body.name ?? "").trim().slice(0, 80);
  const category = String(body.category ?? "Other").trim().slice(0, 40);
  const kind = body.kind === "income" ? "income" : "expense";
  const amount = Number(body.amount);
  const note = String(body.note ?? "").trim().slice(0, 180) || null;
  if (!validMonth(monthKey) || !name || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Provide a name, positive amount and valid month." }, { status: 400 });
  }
  const { data, error } = await supabase.from("budget_items").insert({
    user_id: user.id, month_key: monthKey, name, category, kind,
    amount: Math.round(amount * 100) / 100, note,
  }).select().single();
  return error
    ? Response.json({ error: error.message }, { status: 400 })
    : Response.json({ item: toClientItem(data) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { supabase, user } = await context();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  if (body.action === "target") {
    const monthKey = String(body.monthKey ?? "");
    const monthlyTarget = Number(body.monthlyTarget);
    if (!validMonth(monthKey) || !Number.isFinite(monthlyTarget) || monthlyTarget < 0) {
      return Response.json({ error: "Enter a valid monthly target." }, { status: 400 });
    }
    const rounded = Math.round(monthlyTarget * 100) / 100;
    const { error } = await supabase.from("budget_settings").upsert({
      user_id: user.id, month_key: monthKey, monthly_target: rounded, updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,month_key" });
    return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ target: rounded });
  }
  const id = Number(body.id);
  const name = String(body.name ?? "").trim().slice(0, 80);
  const amount = Number(body.amount);
  if (!id || !name || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Provide a name and positive amount." }, { status: 400 });
  }
  const { data, error } = await supabase.from("budget_items").update({
    name,
    category: String(body.category ?? "Other").trim().slice(0, 40),
    kind: body.kind === "income" ? "income" : "expense",
    amount: Math.round(amount * 100) / 100,
    note: String(body.note ?? "").trim().slice(0, 180) || null,
    updated_at: new Date().toISOString(),
  }).eq("id", id).select().single();
  return error
    ? Response.json({ error: error.message }, { status: 404 })
    : Response.json({ item: toClientItem(data) });
}

export async function DELETE(request: Request) {
  const { supabase, user } = await context();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Budget item required." }, { status: 400 });
  const { error } = await supabase.from("budget_items").delete().eq("id", id);
  return error ? Response.json({ error: error.message }, { status: 400 }) : Response.json({ deleted: true });
}

function toClientItem(row: Record<string, unknown>) {
  return {
    id: row.id, monthKey: row.month_key, name: row.name, category: row.category,
    amount: row.amount, kind: row.kind, note: row.note,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
