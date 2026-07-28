import { createClient } from "../../lib/supabase/client";
import { createFingerprint } from "./finance";

/**
 * Browser-side data gateway.
 *
 * Fiscara authenticates in the browser with Supabase. Performing the database
 * operations with that same browser client keeps the JWT and the database
 * request in one place and lets Supabase Row Level Security enforce ownership.
 * This avoids relying on a Next.js/Vercel server function to reconstruct the
 * browser session from cookies.
 */
export async function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  try {
    const url = resolveUrl(input);
    const method = (init.method ?? "GET").toUpperCase();

    if (url.pathname === "/api/accounts") {
      return handleAccounts(method, init);
    }
    if (url.pathname === "/api/transactions") {
      return handleTransactions(method, init);
    }
    if (url.pathname === "/api/budget") {
      return handleBudget(method, url, init);
    }
    if (url.pathname === "/api/import") {
      return handleImport(method, init);
    }

    return fetch(input, { ...init, credentials: "include", cache: "no-store" });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unexpected application error." },
      500,
    );
  }
}

async function authenticatedClient() {
  const supabase = createClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error(sessionError.message);

  let session = sessionData.session;
  if (!session) {
    const { data: refreshed, error } = await supabase.auth.refreshSession();
    if (error) throw new Error(error.message);
    session = refreshed.session;
  }

  if (!session?.user) return { supabase, user: null };
  return { supabase, user: session.user };
}

async function handleAccounts(method: string, init: RequestInit) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return json({ error: "Authentication required" }, 401);

  if (method === "GET") {
    let { data, error } = await supabase.from("accounts").select("*").order("created_at");
    if (error) return json({ error: error.message }, 500);

    if (!data?.length) {
      const defaults = [
        { name: "ING Current", institution: "ING", type: "bank", color: "#ff6200" },
        { name: "Cash wallet", institution: "Cash", type: "cash", color: "#42efb1" },
        { name: "Emergency savings", institution: "Manual", type: "savings", color: "#a78bfa" },
      ].map((account) => ({ ...account, user_id: user.id }));
      const seeded = await supabase.from("accounts").insert(defaults).select();
      data = seeded.data;
      error = seeded.error;
    }

    if (error) return json({ error: error.message }, 500);
    return json({ accounts: (data ?? []).map(toClientAccount) });
  }

  const body = await readJson(init);

  if (method === "POST") {
    const name = String(body.name ?? "").trim().slice(0, 60);
    if (!name) return json({ error: "Account name is required." }, 400);
    const type = String(body.type ?? "bank");
    const validTypes = ["bank", "credit", "debit", "cash", "savings", "stock", "investment", "crypto", "property", "pension", "loan", "income", "other"];
    const { data, error } = await supabase.from("accounts").insert({
      user_id: user.id,
      name,
      institution: String(body.institution ?? "Manual").trim().slice(0, 50),
      type: validTypes.includes(type) ? type : "bank",
      current_balance: Number(body.currentBalance) || 0,
      last_four: String(body.lastFour ?? "").replace(/\D/g, "").slice(-4) || null,
      color: String(body.color ?? "#42efb1").slice(0, 20),
    }).select().single();
    return error
      ? json({ error: error.message }, 400)
      : json({ account: toClientAccount(data) }, 201);
  }

  if (method === "PATCH") {
    const id = Number(body.id);
    const balance = Number(body.currentBalance);
    if (!id || !Number.isFinite(balance)) {
      return json({ error: "Valid account and balance required." }, 400);
    }
    const { data, error } = await supabase.from("accounts")
      .update({ current_balance: Math.round(balance * 100) / 100 })
      .eq("id", id)
      .select()
      .single();
    return error
      ? json({ error: error.message }, 404)
      : json({ account: toClientAccount(data) });
  }

  return json({ error: "Method not allowed." }, 405);
}

async function handleTransactions(method: string, init: RequestInit) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return json({ error: "Authentication required" }, 401);

  if (method === "GET") {
    const { data, error } = await supabase.from("transactions").select("*")
      .order("transaction_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(1000);
    return error
      ? json({ error: error.message }, 500)
      : json({ transactions: (data ?? []).map(toClientTransaction) });
  }

  if (method === "POST") {
    const body = await readJson(init);
    const name = String(body.name ?? "").trim().slice(0, 100);
    const category = String(body.category ?? "Other").trim().slice(0, 40);
    const amount = Number(body.amount);
    const kind = body.kind === "income" ? "income" : "expense";
    const date = String(body.date ?? "");
    const accountId = Number(body.accountId) || null;
    if (!name || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: "Please provide a valid description, amount, and date." }, 400);
    }
    const { data, error } = await supabase.from("transactions").insert({
      user_id: user.id,
      account_id: accountId,
      name,
      category,
      amount: Math.round(amount * 100) / 100,
      kind,
      transaction_date: date,
      source: "manual",
      fingerprint: createFingerprint(date, amount, kind, `${name}|manual|${Date.now()}`),
    }).select().single();
    return error
      ? json({ error: error.message }, 400)
      : json({ transaction: toClientTransaction(data) }, 201);
  }

  return json({ error: "Method not allowed." }, 405);
}

async function handleImport(method: string, init: RequestInit) {
  if (method !== "POST") return json({ error: "Method not allowed." }, 405);
  const { supabase, user } = await authenticatedClient();
  if (!user) return json({ error: "Authentication required" }, 401);

  const body = await readJson(init);
  const accountId = Number(body.accountId);
  const rows = Array.isArray(body.rows) ? body.rows.slice(0, 2500) : [];
  if (!accountId || !rows.length) {
    return json({ error: "Choose an account and provide transactions." }, 400);
  }

  const { data: account, error: accountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (accountError) return json({ error: accountError.message }, 400);
  if (!account) return json({ error: "That account is not available." }, 403);

  const validRows = rows.flatMap((row: Record<string, unknown>) => {
    const name = String(row.name ?? "").trim().slice(0, 100);
    const category = String(row.category ?? "Other").trim().slice(0, 40);
    const amount = Number(row.amount);
    const kind = row.kind === "income" ? "income" : "expense";
    const date = String(row.date ?? "");
    if (!name || !Number.isFinite(amount) || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return [];
    const originalDescription = String(row.originalDescription ?? name).slice(0, 500);
    return [{
      user_id: user.id,
      account_id: accountId,
      name,
      category,
      amount: Math.round(amount * 100) / 100,
      kind,
      transaction_date: date,
      source: row.source === "ing_pdf" ? "ing_pdf" : "ing_csv",
      fingerprint: String(row.fingerprint ?? "") || createFingerprint(date, amount, kind, originalDescription),
      original_description: originalDescription,
    }];
  });

  const fingerprints = validRows.map((row) => row.fingerprint);
  const existing = fingerprints.length
    ? await supabase.from("transactions").select("fingerprint").in("fingerprint", fingerprints)
    : { data: [], error: null };
  if (existing.error) return json({ error: existing.error.message }, 400);

  const existingSet = new Set((existing.data ?? []).map((row) => row.fingerprint));
  const seen = new Set<string>();
  const uniqueRows = validRows.filter((row) => {
    if (existingSet.has(row.fingerprint) || seen.has(row.fingerprint)) return false;
    seen.add(row.fingerprint);
    return true;
  });

  if (!uniqueRows.length) {
    return json({ imported: 0, duplicates: validRows.length, transactions: [] });
  }

  // Keep insert batches moderate for mobile browsers and Supabase gateway limits.
  const insertedRows: Record<string, unknown>[] = [];
  for (let index = 0; index < uniqueRows.length; index += 500) {
    const batch = uniqueRows.slice(index, index + 500);
    const inserted = await supabase.from("transactions").insert(batch).select();
    if (inserted.error) return json({ error: inserted.error.message }, 400);
    insertedRows.push(...(inserted.data ?? []));
  }

  return json({
    imported: insertedRows.length,
    duplicates: validRows.length - insertedRows.length,
    transactions: insertedRows.map(toClientTransaction),
  });
}

async function handleBudget(method: string, url: URL, init: RequestInit) {
  const { supabase, user } = await authenticatedClient();
  if (!user) return json({ error: "Authentication required" }, 401);
  const validMonth = (value: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);

  if (method === "GET") {
    const month = url.searchParams.get("month") ?? "";
    if (!validMonth(month)) return json({ error: "Choose a valid month." }, 400);
    const [itemsResult, settingsResult] = await Promise.all([
      supabase.from("budget_items").select("*").eq("month_key", month).order("created_at"),
      supabase.from("budget_settings").select("monthly_target").eq("month_key", month).maybeSingle(),
    ]);
    const error = itemsResult.error ?? settingsResult.error;
    if (error) return json({ error: error.message }, 500);
    return json({
      items: (itemsResult.data ?? []).map(toClientBudgetItem),
      target: settingsResult.data?.monthly_target ?? 0,
    });
  }

  if (method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    if (!id) return json({ error: "Budget item required." }, 400);
    const { error } = await supabase.from("budget_items").delete().eq("id", id);
    return error ? json({ error: error.message }, 400) : json({ deleted: true });
  }

  const body = await readJson(init);

  if (method === "POST") {
    const monthKey = String(body.monthKey ?? "");
    const name = String(body.name ?? "").trim().slice(0, 80);
    const category = String(body.category ?? "Other").trim().slice(0, 40);
    const kind = body.kind === "income" ? "income" : "expense";
    const amount = Number(body.amount);
    const note = String(body.note ?? "").trim().slice(0, 180) || null;
    if (!validMonth(monthKey) || !name || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Provide a name, positive amount and valid month." }, 400);
    }
    const { data, error } = await supabase.from("budget_items").insert({
      user_id: user.id,
      month_key: monthKey,
      name,
      category,
      kind,
      amount: Math.round(amount * 100) / 100,
      note,
    }).select().single();
    return error
      ? json({ error: error.message }, 400)
      : json({ item: toClientBudgetItem(data) }, 201);
  }

  if (method === "PATCH") {
    if (body.action === "target") {
      const monthKey = String(body.monthKey ?? "");
      const monthlyTarget = Number(body.monthlyTarget);
      if (!validMonth(monthKey) || !Number.isFinite(monthlyTarget) || monthlyTarget < 0) {
        return json({ error: "Enter a valid monthly target." }, 400);
      }
      const rounded = Math.round(monthlyTarget * 100) / 100;
      const { error } = await supabase.from("budget_settings").upsert({
        user_id: user.id,
        month_key: monthKey,
        monthly_target: rounded,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,month_key" });
      return error ? json({ error: error.message }, 400) : json({ target: rounded });
    }

    const id = Number(body.id);
    const name = String(body.name ?? "").trim().slice(0, 80);
    const amount = Number(body.amount);
    if (!id || !name || !Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Provide a name and positive amount." }, 400);
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
      ? json({ error: error.message }, 404)
      : json({ item: toClientBudgetItem(data) });
  }

  return json({ error: "Method not allowed." }, 405);
}

function resolveUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input, window.location.origin);
  return new URL(input.url, window.location.origin);
}

async function readJson(init: RequestInit): Promise<Record<string, any>> {
  if (!init.body) return {};
  if (typeof init.body === "string") return JSON.parse(init.body) as Record<string, any>;
  throw new Error("Unsupported request body.");
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function toClientAccount(row: Record<string, any>) {
  return {
    id: row.id,
    name: row.name,
    institution: row.institution,
    type: row.type,
    currency: row.currency,
    currentBalance: row.current_balance,
    lastFour: row.last_four,
    color: row.color,
  };
}

function toClientTransaction(row: Record<string, any>) {
  return {
    id: row.id,
    accountId: row.account_id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    kind: row.kind,
    date: row.transaction_date,
    source: row.source,
    fingerprint: row.fingerprint,
  };
}

function toClientBudgetItem(row: Record<string, any>) {
  return {
    id: row.id,
    monthKey: row.month_key,
    name: row.name,
    category: row.category,
    amount: row.amount,
    kind: row.kind,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
