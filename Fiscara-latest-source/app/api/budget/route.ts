import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { budgetItems, budgetSettings } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

function validMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const month = new URL(request.url).searchParams.get("month") ?? "";
  if (!validMonth(month)) return Response.json({ error: "Choose a valid month." }, { status: 400 });
  const db = await getDb();
  const [items, settings] = await Promise.all([
    db.select().from(budgetItems).where(and(eq(budgetItems.userEmail, user.email), eq(budgetItems.monthKey, month))),
    db.select().from(budgetSettings).where(and(eq(budgetSettings.userEmail, user.email), eq(budgetSettings.monthKey, month))).limit(1),
  ]);
  return Response.json({ items, target: settings[0]?.monthlyTarget ?? 0 });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
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
  const db = await getDb();
  const [item] = await db.insert(budgetItems).values({ userEmail: user.email, monthKey, name, category, kind, amount: Math.round(amount * 100) / 100, note }).returning();
  return Response.json({ item }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const db = await getDb();

  if (body.action === "target") {
    const monthKey = String(body.monthKey ?? "");
    const monthlyTarget = Number(body.monthlyTarget);
    if (!validMonth(monthKey) || !Number.isFinite(monthlyTarget) || monthlyTarget < 0) {
      return Response.json({ error: "Enter a valid monthly target." }, { status: 400 });
    }
    const [setting] = await db.insert(budgetSettings)
      .values({ userEmail: user.email, monthKey, monthlyTarget: Math.round(monthlyTarget * 100) / 100 })
      .onConflictDoUpdate({
        target: [budgetSettings.userEmail, budgetSettings.monthKey],
        set: { monthlyTarget: Math.round(monthlyTarget * 100) / 100, updatedAt: new Date().toISOString() },
      }).returning();
    return Response.json({ target: setting.monthlyTarget });
  }

  const id = Number(body.id);
  const name = String(body.name ?? "").trim().slice(0, 80);
  const category = String(body.category ?? "Other").trim().slice(0, 40);
  const kind = body.kind === "income" ? "income" : "expense";
  const amount = Number(body.amount);
  const note = String(body.note ?? "").trim().slice(0, 180) || null;
  if (!id || !name || !Number.isFinite(amount) || amount <= 0) {
    return Response.json({ error: "Provide a name and positive amount." }, { status: 400 });
  }
  const [item] = await db.update(budgetItems)
    .set({ name, category, kind, amount: Math.round(amount * 100) / 100, note, updatedAt: new Date().toISOString() })
    .where(and(eq(budgetItems.id, id), eq(budgetItems.userEmail, user.email))).returning();
  return item ? Response.json({ item }) : Response.json({ error: "Budget item not found." }, { status: 404 });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Budget item required." }, { status: 400 });
  const db = await getDb();
  await db.delete(budgetItems).where(and(eq(budgetItems.id, id), eq(budgetItems.userEmail, user.email)));
  return Response.json({ deleted: true });
}
