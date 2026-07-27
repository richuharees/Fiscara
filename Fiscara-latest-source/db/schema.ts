import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(),
    institution: text("institution").notNull().default("Manual"),
    type: text("type", {
      enum: ["bank", "credit", "debit", "cash", "savings", "stock", "investment", "crypto", "property", "pension", "loan", "income", "other"],
    }).notNull(),
    currency: text("currency").notNull().default("EUR"),
    currentBalance: real("current_balance").notNull().default(0),
    lastFour: text("last_four"),
    color: text("color").notNull().default("#42efb1"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("accounts_user_idx").on(table.userEmail),
  ],
);

export const budgetSettings = sqliteTable(
  "budget_settings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    monthKey: text("month_key").notNull(),
    monthlyTarget: real("monthly_target").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("budget_settings_user_month_uidx").on(table.userEmail, table.monthKey),
  ],
);

export const budgetItems = sqliteTable(
  "budget_items",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    monthKey: text("month_key").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    amount: real("amount").notNull(),
    kind: text("kind", { enum: ["expense", "income"] }).notNull().default("expense"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("budget_items_user_month_idx").on(table.userEmail, table.monthKey),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    accountId: integer("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    category: text("category").notNull(),
    amount: real("amount").notNull(),
    kind: text("kind", { enum: ["expense", "income"] }).notNull(),
    transactionDate: text("transaction_date").notNull(),
    source: text("source").notNull().default("manual"),
    fingerprint: text("fingerprint"),
    originalDescription: text("original_description"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("transactions_user_idx").on(table.userEmail),
    index("transactions_account_idx").on(table.accountId),
    uniqueIndex("transactions_user_fingerprint_uidx").on(
      table.userEmail,
      table.fingerprint,
    ),
  ],
);

export const savingsGoals = sqliteTable(
  "savings_goals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userEmail: text("user_email").notNull(),
    name: text("name").notNull(),
    targetAmount: real("target_amount").notNull(),
    currentAmount: real("current_amount").notNull().default(0),
    targetDate: text("target_date"),
    color: text("color").notNull().default("#42efb1"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("savings_goals_user_idx").on(table.userEmail)],
);
