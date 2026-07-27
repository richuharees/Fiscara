import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { accounts } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

const defaultAccounts = [
  { name: "ING Current", institution: "ING", type: "bank" as const, color: "#ff6200" },
  { name: "Cash wallet", institution: "Cash", type: "cash" as const, color: "#42efb1" },
  { name: "Emergency savings", institution: "Manual", type: "savings" as const, color: "#a78bfa" },
];

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const db = await getDb();
    let rows = await db.select().from(accounts).where(eq(accounts.userEmail, user.email));
    if (!rows.length) {
      rows = await db.insert(accounts).values(
        defaultAccounts.map((account) => ({ ...account, userEmail: user.email })),
      ).returning();
    }
    return Response.json({ accounts: rows.map(toClientAccount) });
  } catch {
    return Response.json({ error: "Your accounts could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim().slice(0, 60);
  const institution = String(body.institution ?? "Manual").trim().slice(0, 50);
  const type = validType(String(body.type)) ? String(body.type) as typeof accounts.$inferInsert.type : "bank";
  const balance = Number(body.currentBalance) || 0;
  if (!name) return Response.json({ error: "Account name is required." }, { status: 400 });
  const db = await getDb();
  const [row] = await db.insert(accounts).values({
    userEmail: user.email,
    name,
    institution,
    type,
    currentBalance: balance,
    lastFour: String(body.lastFour ?? "").replace(/\D/g, "").slice(-4) || null,
    color: String(body.color ?? "#42efb1").slice(0, 20),
  }).returning();
  return Response.json({ account: toClientAccount(row) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Authentication required" }, { status: 401 });
  const body = (await request.json()) as Record<string, unknown>;
  const id = Number(body.id);
  const balance = Number(body.currentBalance);
  if (!id || !Number.isFinite(balance)) return Response.json({ error: "Valid account and balance required." }, { status: 400 });
  const db = await getDb();
  const [row] = await db.update(accounts)
    .set({ currentBalance: Math.round(balance * 100) / 100 })
    .where(and(eq(accounts.id, id), eq(accounts.userEmail, user.email)))
    .returning();
  return row
    ? Response.json({ account: toClientAccount(row) })
    : Response.json({ error: "Account not found." }, { status: 404 });
}

function validType(value: string) {
  return ["bank", "credit", "debit", "cash", "savings", "stock", "investment", "crypto", "property", "pension", "loan", "income", "other"].includes(value);
}

function toClientAccount(row: typeof accounts.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    institution: row.institution,
    type: row.type,
    currency: row.currency,
    currentBalance: row.currentBalance,
    lastFour: row.lastFour,
    color: row.color,
  };
}
