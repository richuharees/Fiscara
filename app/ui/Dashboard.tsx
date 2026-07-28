"use client";

import Link from "next/link";
import Brand from "./Brand";
import { authenticatedFetch } from "../lib/api-client";
import {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  categories,
  FinanceAccount,
  ImportRow,
  monthSeries,
  parseIngCsv,
  parseIngPdfLines,
  recurringGroups,
  Transaction,
} from "../lib/finance";

type Section = "Overview" | "Budget" | "Transactions" | "Accounts" | "Savings" | "Insights";
type Modal = "transaction" | "import" | "account" | "balance" | "budget" | null;
type BudgetItem = { id: number; monthKey: string; name: string; category: string; amount: number; kind: "expense" | "income"; note?: string | null };
type Totals = {
  income: number;
  spending: number;
  liquid: number;
  savings: number;
  credit: number;
  netWorth: number;
  savingRate: number;
};

const demoAccounts: FinanceAccount[] = [
  { id: 1, name: "ING Current", institution: "ING", type: "bank", currency: "EUR", currentBalance: 3240, lastFour: "4821", color: "#ff6200" },
  { id: 2, name: "ING Student Card", institution: "ING", type: "credit", currency: "EUR", currentBalance: -186, lastFour: "9432", color: "#6b73ff" },
  { id: 3, name: "Cash wallet", institution: "Cash", type: "cash", currency: "EUR", currentBalance: 85, lastFour: null, color: "#42efb1" },
  { id: 4, name: "Emergency savings", institution: "Manual", type: "savings", currency: "EUR", currentBalance: 1700, lastFour: null, color: "#a78bfa" },
];

const demoTransactions: Transaction[] = [
  { id: 1, accountId: 1, name: "DUWO rent", category: "Housing", amount: 650, kind: "expense", date: "2026-05-01", source: "ing_csv", fingerprint: "d1" },
  { id: 2, accountId: 1, name: "DUWO rent", category: "Housing", amount: 650, kind: "expense", date: "2026-06-01", source: "ing_csv", fingerprint: "d2" },
  { id: 3, accountId: 1, name: "DUWO rent", category: "Housing", amount: 650, kind: "expense", date: "2026-07-01", source: "ing_csv", fingerprint: "d3" },
  { id: 4, accountId: 1, name: "Internship allowance", category: "Income", amount: 800, kind: "income", date: "2026-07-02", source: "ing_csv", fingerprint: "d4" },
  { id: 5, accountId: 1, name: "Albert Heijn", category: "Groceries", amount: 48.25, kind: "expense", date: "2026-07-05", source: "ing_csv", fingerprint: "d5" },
  { id: 6, accountId: 1, name: "NS travel", category: "Transport", amount: 32.4, kind: "expense", date: "2026-07-08", source: "ing_csv", fingerprint: "d6" },
  { id: 7, accountId: 1, name: "Zilveren Kruis", category: "Insurance", amount: 140, kind: "expense", date: "2026-06-10", source: "ing_csv", fingerprint: "d7" },
  { id: 8, accountId: 1, name: "Zilveren Kruis", category: "Insurance", amount: 140, kind: "expense", date: "2026-07-10", source: "ing_csv", fingerprint: "d8" },
  { id: 9, accountId: 1, name: "Restaurant shift", category: "Income", amount: 412, kind: "income", date: "2026-07-14", source: "manual", fingerprint: "d9" },
  { id: 10, accountId: 3, name: "Coffee with friends", category: "Dining", amount: 18.5, kind: "expense", date: "2026-07-19", source: "manual", fingerprint: "d10" },
  { id: 11, accountId: 2, name: "ChatGPT", category: "Subscriptions", amount: 23, kind: "expense", date: "2026-06-21", source: "manual", fingerprint: "d11" },
  { id: 12, accountId: 2, name: "ChatGPT", category: "Subscriptions", amount: 23, kind: "expense", date: "2026-07-21", source: "manual", fingerprint: "d12" },
];

const demoBudgetItems: BudgetItem[] = [
  { id: 1, monthKey: "2026-07", name: "DUWO rent", category: "Housing", amount: 650, kind: "expense", note: "Fixed monthly rent" },
  { id: 2, monthKey: "2026-07", name: "Groceries", category: "Groceries", amount: 180, kind: "expense", note: "Monthly grocery allowance" },
  { id: 3, monthKey: "2026-07", name: "Subscriptions", category: "Subscriptions", amount: 38, kind: "expense", note: "ChatGPT and entertainment" },
  { id: 4, monthKey: "2026-07", name: "Internship allowance", category: "Salary", amount: 800, kind: "income", note: "Expected monthly allowance" },
  { id: 5, monthKey: "2026-07", name: "Restaurant tips", category: "Tips", amount: 75, kind: "income", note: "Variable estimate" },
];

const euro = new Intl.NumberFormat("en-NL", { style: "currency", currency: "EUR" });

export default function Dashboard({
  user,
  signOutHref,
  demo = false,
}: {
  user: { name: string; email: string };
  signOutHref: string;
  demo?: boolean;
}) {
  const [active, setActive] = useState<Section>("Overview");
  const [modal, setModal] = useState<Modal>(null);
  const [transactions, setTransactions] = useState<Transaction[]>(demo ? demoTransactions : []);
  const [accounts, setAccounts] = useState<FinanceAccount[]>(demo ? demoAccounts : []);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");
  const [loading, setLoading] = useState(!demo);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importAccount, setImportAccount] = useState<number>(demoAccounts[0].id);
  const [importStep, setImportStep] = useState<"choose" | "preview" | "complete">("choose");
  const [importMessage, setImportMessage] = useState("");
  const [importPending, setImportPending] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [balanceAccount, setBalanceAccount] = useState<FinanceAccount | null>(null);
  const [budgetMonth, setBudgetMonth] = useState("2026-07");
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(demo ? demoBudgetItems : []);
  const [budgetTarget, setBudgetTarget] = useState(demo ? 1000 : 0);
  const [editingBudget, setEditingBudget] = useState<BudgetItem | null>(null);
  const [budgetKind, setBudgetKind] = useState<"expense" | "income">("expense");
  const [budgetError, setBudgetError] = useState("");
  const [accountError, setAccountError] = useState("");

  useEffect(() => {
    if (demo) return;
    Promise.all([
      authenticatedFetch("/api/transactions").then((response) => response.json()),
      authenticatedFetch("/api/accounts").then((response) => response.json()),
    ]).then(([transactionData, accountData]) => {
      setTransactions(transactionData.transactions ?? []);
      setAccounts(accountData.accounts ?? []);
      if (accountData.accounts?.[0]) setImportAccount(accountData.accounts[0].id);
    }).finally(() => setLoading(false));
  }, [demo]);

  useEffect(() => {
    if (demo) return;
    authenticatedFetch(`/api/budget?month=${budgetMonth}`).then((response) => response.json()).then((data) => {
      setBudgetItems(data.items ?? []);
      setBudgetTarget(data.target ?? 0);
    });
  }, [demo, budgetMonth]);

  const totals = useMemo(() => {
    const latestMonth = [...transactions].sort((a, b) => b.date.localeCompare(a.date))[0]?.date.slice(0, 7);
    const currentMonth = latestMonth ? transactions.filter((item) => item.date.startsWith(latestMonth)) : transactions;
    const income = currentMonth.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
    const spending = currentMonth.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
    const liquid = accounts.filter((account) => ["bank", "debit", "cash", "income"].includes(account.type)).reduce((sum, account) => sum + account.currentBalance, 0);
    const savings = accounts.filter((account) => account.type === "savings").reduce((sum, account) => sum + account.currentBalance, 0);
    const credit = accounts.filter((account) => account.type === "credit").reduce((sum, account) => sum + Math.min(0, account.currentBalance), 0);
    const netWorth = accounts.reduce((sum, account) => sum + account.currentBalance, 0);
    return { income, spending, liquid, savings, credit, netWorth, savingRate: income ? Math.max(0, (income - spending) / income * 100) : 0 };
  }, [transactions, accounts]);

  const filtered = useMemo(() => transactions
    .filter((item) => category === "All" || item.category === category)
    .filter((item) => accountFilter === "All" || item.accountId === Number(accountFilter))
    .filter((item) => `${item.name} ${item.category}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date)), [transactions, category, accountFilter, query]);

  const recurring = useMemo(() => recurringGroups(transactions), [transactions]);
  const monthly = useMemo(() => monthSeries(transactions), [transactions]);
  const categoryTotals = useMemo(() => {
    const result = new Map<string, number>();
    transactions.filter((item) => item.kind === "expense").forEach((item) => result.set(item.category, (result.get(item.category) ?? 0) + item.amount));
    return [...result.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [transactions]);
  const accountName = (id: number | null) => accounts.find((account) => account.id === id)?.name ?? "Unassigned";
  const firstName = user.name.includes("@") ? "there" : user.name.split(" ")[0];

  async function addTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const item = {
      name: String(form.get("name") ?? ""),
      category: String(form.get("category") ?? "Other"),
      amount: Number(form.get("amount") ?? 0),
      kind: String(form.get("kind") ?? "expense") as "expense" | "income",
      date: String(form.get("date") ?? new Date().toISOString().slice(0, 10)),
      accountId: Number(form.get("accountId")) || accounts[0]?.id || null,
    };
    if (!item.name || !item.amount) return;
    if (demo) setTransactions((current) => [...current, { ...item, id: Date.now(), source: "manual" }]);
    else {
      const response = await authenticatedFetch("/api/transactions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(item) });
      const data = await response.json();
      if (data.transaction) setTransactions((current) => [...current, data.transaction]);
    }
    setModal(null);
  }

  async function addAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAccountError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      institution: String(form.get("institution") ?? "Manual"),
      type: String(form.get("type") ?? "bank"),
      currentBalance: Number(form.get("currentBalance")) || 0,
      lastFour: String(form.get("lastFour") ?? ""),
      color: String(form.get("color") ?? "#42efb1"),
    };
    if (!payload.name) return;
    if (demo) setAccounts((current) => [...current, { ...payload, id: Date.now(), currency: "EUR", type: payload.type as FinanceAccount["type"] }]);
    else {
      const response = await authenticatedFetch("/api/accounts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.account) {
        setAccountError(data.error ?? "The account could not be added. Please sign in again and retry.");
        return;
      }
      setAccounts((current) => [...current, data.account]);
      if (!accounts.length) setImportAccount(data.account.id);
    }
    setModal(null);
  }

  async function updateBalance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!balanceAccount) return;
    const balance = Number(new FormData(event.currentTarget).get("balance"));
    if (!Number.isFinite(balance)) return;
    if (demo) setAccounts((current) => current.map((account) => account.id === balanceAccount.id ? { ...account, currentBalance: balance } : account));
    else {
      const response = await authenticatedFetch("/api/accounts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: balanceAccount.id, currentBalance: balance }) });
      const data = await response.json();
      if (data.account) setAccounts((current) => current.map((account) => account.id === data.account.id ? data.account : account));
    }
    setModal(null);
    setBalanceAccount(null);
  }

  async function saveBudgetItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBudgetError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      id: editingBudget?.id,
      monthKey: budgetMonth,
      name: String(form.get("name") ?? ""),
      category: String(form.get("category") ?? "Other"),
      kind: budgetKind,
      amount: Number(form.get("amount")),
      note: String(form.get("note") ?? ""),
    };
    if (!payload.name || !Number.isFinite(payload.amount) || payload.amount <= 0) return;
    if (demo) {
      setBudgetItems((current) => editingBudget
        ? current.map((item) => item.id === editingBudget.id ? { ...item, ...payload } as BudgetItem : item)
        : [...current, { ...payload, id: Date.now() } as BudgetItem]);
    } else {
      const response = await authenticatedFetch("/api/budget", {
        method: editingBudget ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setBudgetError(data.error ?? "This budget item could not be saved.");
        return;
      }
      setBudgetItems((current) => editingBudget
        ? current.map((item) => item.id === editingBudget.id ? data.item : item)
        : [...current, data.item]);
    }
    setEditingBudget(null);
    setModal(null);
  }

  async function deleteBudgetItem(id: number) {
    if (!demo) await authenticatedFetch(`/api/budget?id=${id}`, { method: "DELETE" });
    setBudgetItems((current) => current.filter((item) => item.id !== id));
  }

  async function saveBudgetTarget(value: number) {
    const target = Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : 0;
    setBudgetTarget(target);
    if (!demo) await authenticatedFetch("/api/budget", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "target", monthKey: budgetMonth, monthlyTarget: target }),
    });
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvError("");
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const rows = isPdf
        ? parseIngPdfLines(await (await import("../lib/pdf-client")).extractPdfLines(file))
        : parseIngCsv(await file.text());
      const existing = new Set(transactions.map((item) => item.fingerprint).filter(Boolean));
      setImportRows(rows.map((row) => ({ ...row, duplicate: existing.has(row.fingerprint), selected: !existing.has(row.fingerprint) })));
      setImportStep("preview");
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "This file could not be read.");
    }
    event.target.value = "";
  }

  async function confirmImport() {
    const selected = importRows.filter((row) => row.selected && !row.duplicate);
    if (!selected.length || importPending) return;
    setCsvError("");
    setImportPending(true);
    try {
      if (demo) {
        setTransactions((current) => [...current, ...selected.map((row, index) => ({ ...row, accountId: importAccount, id: Date.now() + index }))]);
        setImportMessage(`${selected.length} transactions imported. ${importRows.filter((row) => row.duplicate).length} duplicates skipped.`);
      } else {
      const response = await authenticatedFetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: importAccount, rows: selected }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "The transactions could not be saved. Please try again.");
        setTransactions((current) => [...current, ...(data.transactions ?? [])]);
        setImportMessage(`${data.imported ?? 0} transactions imported. ${data.duplicates ?? 0} duplicates skipped.`);
      }
      setImportStep("complete");
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : "The transactions could not be saved. Please try again.");
    } finally {
      setImportPending(false);
    }
  }

  function openImport() {
    setImportRows([]);
    setImportStep("choose");
    setImportMessage("");
    setCsvError("");
    setImportPending(false);
    if (accounts[0]) setImportAccount(accounts[0].id);
    setModal("import");
  }

  return (
    <main className="dashboard-page finance-v2">
      <aside className="dash-sidebar">
        <Brand />
        <nav className="dash-nav" aria-label="Finance sections">
          {(["Overview", "Budget", "Transactions", "Accounts", "Savings", "Insights"] as Section[]).map((item) => (
            <button className={active === item ? "active" : ""} key={item} onClick={() => setActive(item)}>{item}</button>
          ))}
        </nav>
        <div className="sidebar-user">
          <strong>{user.name}</strong><small>{user.email}</small>
          <Link href={signOutHref}>{demo ? "Exit demo" : "Sign out"} →</Link>
        </div>
      </aside>

      <section className="dash-main">
        {demo && <div className="demo-banner"><span>You’re exploring sample data. Imports and edits reset when you leave.</span><Link href="/login">Create your space</Link></div>}
        <header className="dash-header">
          <div><small>{active === "Overview" ? "Your complete money picture" : "Fiscara workspace"}</small><h1>{active === "Overview" ? `Good evening, ${firstName}.` : active}</h1></div>
          <div className="dash-actions">
            <button className="dash-button import-button" onClick={openImport}>⇧ Import statement</button>
            <button className="dash-button primary" onClick={() => setModal("transaction")}>＋ Add transaction</button>
          </div>
        </header>

        {loading ? <div className="loading-panel">Preparing your financial workspace…</div> : (
          <>
            {active === "Overview" && <Overview totals={totals} accounts={accounts} monthly={monthly} categoryTotals={categoryTotals} transactions={transactions} onNavigate={setActive} />}
            {active === "Budget" && <BudgetView month={budgetMonth} setMonth={setBudgetMonth} items={budgetItems.filter((item) => item.monthKey === budgetMonth)} target={budgetTarget} onTarget={saveBudgetTarget} onAdd={(kind) => { setEditingBudget(null); setBudgetKind(kind); setBudgetError(""); setModal("budget"); }} onEdit={(item) => { setEditingBudget(item); setBudgetKind(item.kind); setBudgetError(""); setModal("budget"); }} onDelete={deleteBudgetItem} />}
            {active === "Transactions" && <TransactionsView transactions={filtered} allTransactions={transactions} accounts={accounts} query={query} setQuery={setQuery} category={category} setCategory={setCategory} accountFilter={accountFilter} setAccountFilter={setAccountFilter} accountName={accountName} onImport={openImport} />}
            {active === "Accounts" && <AccountsView accounts={accounts} transactions={transactions} onAdd={() => { setAccountError(""); setModal("account"); }} onBalance={(account) => { setBalanceAccount(account); setModal("balance"); }} />}
            {active === "Savings" && <SavingsView accounts={accounts} totals={totals} onAdd={() => { setAccountError(""); setModal("account"); }} onBalance={(account) => { setBalanceAccount(account); setModal("balance"); }} />}
            {active === "Insights" && <InsightsView transactions={transactions} monthly={monthly} recurring={recurring} categoryTotals={categoryTotals} />}
          </>
        )}
      </section>

      {modal === "transaction" && (
        <ModalShell onClose={() => setModal(null)}>
          <form className="modal" onSubmit={addTransaction}>
            <h2>Add a transaction</h2><p>Choose where it happened so every account stays accurate.</p>
            <div className="form-grid">
              <Field label="Description" full><input name="name" placeholder="e.g. Weekly groceries" required autoFocus /></Field>
              <Field label="Amount (€)"><input name="amount" type="number" min=".01" step=".01" placeholder="0.00" required /></Field>
              <Field label="Type"><select name="kind"><option value="expense">Expense</option><option value="income">Income</option></select></Field>
              <Field label="Account"><select name="accountId">{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></Field>
              <Field label="Category"><select name="category">{categories.map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Date" full><input name="date" type="date" defaultValue="2026-07-27" required /></Field>
            </div>
            <ModalActions onClose={() => setModal(null)} submit="Add transaction" />
          </form>
        </ModalShell>
      )}

      {modal === "account" && (
        <ModalShell onClose={() => setModal(null)}>
          <form className="modal" onSubmit={addAccount}>
            <h2>Add a financial account</h2><p>Add assets or liabilities. Its current balance becomes part of your overall funds and net worth.</p>
            <div className="form-grid">
              <Field label="Account name" full><input name="name" placeholder="e.g. ING Student Card" required autoFocus /></Field>
              <Field label="Type"><select name="type"><option value="bank">Bank account</option><option value="debit">Debit card</option><option value="credit">Credit card</option><option value="cash">Cash wallet</option><option value="savings">Savings account</option><option value="stock">Stocks / shares</option><option value="investment">Investment fund</option><option value="crypto">Bitcoin / cryptocurrency</option><option value="property">Property / real estate</option><option value="pension">Pension</option><option value="loan">Loan / debt</option><option value="income">Income balance</option><option value="other">Other asset or liability</option></select></Field>
              <Field label="Institution"><input name="institution" placeholder="ING, Cash, Revolut…" /></Field>
              <Field label="Current balance"><input name="currentBalance" type="number" step=".01" defaultValue="0" /></Field>
              <Field label="Last four digits"><input name="lastFour" inputMode="numeric" maxLength={4} placeholder="4821" /></Field>
              <Field label="Accent colour"><input name="color" type="color" defaultValue="#42efb1" /></Field>
            </div>
            {accountError && <p className="form-error">{accountError}</p>}
            <ModalActions onClose={() => setModal(null)} submit="Add account" />
          </form>
        </ModalShell>
      )}

      {modal === "balance" && balanceAccount && (
        <ModalShell onClose={() => setModal(null)}>
          <form className="modal compact-modal" onSubmit={updateBalance}>
            <h2>Update {balanceAccount.name}</h2>
            <p>{balanceAccount.type === "cash" ? "Count the cash physically in your wallet and enter the total." : "Enter the latest account balance."}</p>
            <Field label="Current balance (€)" full><input name="balance" type="number" step=".01" defaultValue={balanceAccount.currentBalance} required autoFocus /></Field>
            <ModalActions onClose={() => setModal(null)} submit="Save balance" />
          </form>
        </ModalShell>
      )}

      {modal === "budget" && (
        <ModalShell onClose={() => setModal(null)}>
          <form className="modal" onSubmit={saveBudgetItem}>
            <h2>{editingBudget ? `Edit planned ${editingBudget.kind}` : "Add a monthly plan"}</h2>
            <p>This is planning-only and will never change transactions, balances or insights.</p>
            <div className="form-grid">
              <Field label="Plan type"><select name="kind" value={budgetKind} onChange={(event) => setBudgetKind(event.target.value as "expense" | "income")}><option value="expense">Planned expense</option><option value="income">Planned income</option></select></Field>
              <Field label="Name"><input name="name" defaultValue={editingBudget?.name} placeholder="e.g. Salary, tips or rent" required autoFocus /></Field>
              <Field label="Monthly amount (€)"><input name="amount" type="number" min=".01" step=".01" defaultValue={editingBudget?.amount} required /></Field>
              <Field label="Category"><select name="category" defaultValue={editingBudget?.category ?? (budgetKind === "income" ? "Salary" : "Subscriptions")}><option>Salary</option><option>Royalties</option><option>Pocket money</option><option>Tips</option><option>Freelance</option><option>Benefits</option><option>Investment income</option>{categories.filter((item) => item !== "Income").map((item) => <option key={item}>{item}</option>)}</select></Field>
              <Field label="Note" full><input name="note" defaultValue={editingBudget?.note ?? ""} placeholder="Optional planning note" /></Field>
            </div>
            {budgetError && <p className="form-error">{budgetError}</p>}
            <ModalActions onClose={() => setModal(null)} submit={editingBudget ? "Save changes" : "Add to monthly plan"} />
          </form>
        </ModalShell>
      )}

      {modal === "import" && (
        <ImportModal
          step={importStep}
          rows={importRows}
          accounts={accounts}
          accountId={importAccount}
          setAccountId={setImportAccount}
          onFile={handleImportFile}
          onRows={setImportRows}
          onConfirm={confirmImport}
          onClose={() => setModal(null)}
          error={csvError}
          message={importMessage}
          pending={importPending}
        />
      )}
    </main>
  );
}

function Overview({ totals, accounts, monthly, categoryTotals, transactions, onNavigate }: {
  totals: Totals;
  accounts: FinanceAccount[];
  monthly: ReturnType<typeof monthSeries>;
  categoryTotals: Array<[string, number]>;
  transactions: Transaction[];
  onNavigate: (section: Section) => void;
}) {
  const cash = accounts.filter((account) => account.type === "cash").reduce((sum, account) => sum + account.currentBalance, 0);
  return <>
    <section className="kpi-grid overview-kpis" aria-label="Financial summary">
      <Kpi label="Net worth" value={euro.format(totals.netWorth)} note="Across every account" good={totals.netWorth >= 0} />
      <Kpi label="Spendable money" value={euro.format(totals.liquid)} note="Bank, debit and cash" />
      <Kpi label="Total savings" value={euro.format(totals.savings)} note={`${Math.round(totals.savingRate)}% savings rate`} good />
      <Kpi label="Cash in hand" value={euro.format(cash)} note="Last manually counted" />
    </section>
    <section className="dashboard-grid">
      <article className="dash-card">
        <div className="dash-card-head"><div><small>All accounts</small><h2>Income and spending trend</h2></div><button onClick={() => onNavigate("Insights")}>See insights</button></div>
        <TrendChart monthly={monthly} />
      </article>
      <article className="dash-card">
        <div className="dash-card-head"><div><small>Where it goes</small><h2>Top categories</h2></div><span>{transactions.length} transactions</span></div>
        <CategoryBars data={categoryTotals} />
      </article>
      <article className="dash-card transaction-card">
        <div className="dash-card-head"><div><small>Money locations</small><h2>Accounts, cards and cash</h2></div><button onClick={() => onNavigate("Accounts")}>Manage all</button></div>
        <div className="account-strip">
          {accounts.map((account) => <AccountMini key={account.id} account={account} />)}
        </div>
      </article>
    </section>
  </>;
}

function BudgetView({ month, setMonth, items, target, onTarget, onAdd, onEdit, onDelete }: {
  month: string;
  setMonth: (value: string) => void;
  items: BudgetItem[];
  target: number;
  onTarget: (value: number) => void;
  onAdd: (kind: "expense" | "income") => void;
  onEdit: (item: BudgetItem) => void;
  onDelete: (id: number) => void;
}) {
  const expenses = items.filter((item) => item.kind !== "income");
  const incomes = items.filter((item) => item.kind === "income");
  const planned = expenses.reduce((sum, item) => sum + item.amount, 0);
  const projectedIncome = incomes.reduce((sum, item) => sum + item.amount, 0);
  const projectedBalance = projectedIncome - planned;
  const remaining = target - planned;
  const progress = target ? Math.min(100, planned / target * 100) : 0;
  return <section className="budget-layout">
    <div className="section-toolbar budget-toolbar">
      <div><span>Independent planning workspace</span><p>Nothing here changes your accounts, transactions or financial insights.</p></div>
      <div className="budget-toolbar-actions"><input aria-label="Budget month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} /><button className="dash-button" onClick={() => onAdd("expense")}>＋ Expense</button><button className="dash-button primary" onClick={() => onAdd("income")}>＋ Income</button></div>
    </div>
    <div className="budget-summary-grid">
      <article className="budget-target-card">
        <small>Monthly expense target</small>
        <div className="editable-target"><span>€</span><input aria-label="Monthly expense target" type="number" min="0" step=".01" value={target || ""} placeholder="0.00" onChange={(event) => onTarget(Number(event.target.value))} /></div>
        <p>Edit this target at any time. It is used only for comparison on this page.</p>
      </article>
      <Kpi label="Planned monthly total" value={euro.format(planned)} note={`${expenses.length} planned expenses`} />
      <Kpi label={remaining >= 0 ? "Room left in target" : "Over target"} value={euro.format(Math.abs(remaining))} note={target ? `${Math.round(progress)}% of target planned` : "Set a target to compare"} good={remaining >= 0} />
    </div>
    <div className="income-projection-grid">
      <Kpi label="Projected monthly income" value={euro.format(projectedIncome)} note={`${incomes.length} expected income sources`} good />
      <Kpi label={projectedBalance >= 0 ? "Projected monthly surplus" : "Projected monthly shortfall"} value={euro.format(Math.abs(projectedBalance))} note="Expected income minus planned expenses" good={projectedBalance >= 0} />
    </div>
    <article className="dash-card budget-list-card income-plan-card">
      <div className="dash-card-head"><div><small>Expected and variable earnings</small><h2>Monthly income projection</h2></div><span>Salary, royalties, tips and more</span></div>
      {incomes.length ? <div className="planned-expense-list planned-income-list">{incomes.map((item) => <article key={item.id}>
        <span className="planned-category">＋</span>
        <div><strong>{item.name}</strong><small>{item.category}{item.note ? ` · ${item.note}` : ""}</small></div>
        <b>{euro.format(item.amount)}</b>
        <div className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-link" onClick={() => onDelete(item.id)}>Delete</button></div>
      </article>)}</div> : <Empty title="No planned income for this month" text="Add salary, royalties, pocket money, tips, freelance work or any other expected income." />}
    </article>
    <article className="dash-card budget-list-card">
      <div className="dash-card-head"><div><small>Fixed and flexible plans</small><h2>Monthly expense plan</h2></div><span>{new Date(`${month}-01T12:00:00`).toLocaleDateString("en-NL", { month: "long", year: "numeric" })}</span></div>
      {target > 0 && <div className="budget-total-progress"><i style={{ width: `${progress}%` }} /></div>}
      {expenses.length ? <div className="planned-expense-list">{expenses.map((item) => <article key={item.id}>
        <span className="planned-category">{item.category.slice(0, 1)}</span>
        <div><strong>{item.name}</strong><small>{item.category}{item.note ? ` · ${item.note}` : ""}</small></div>
        <b>{euro.format(item.amount)}</b>
        <div className="row-actions"><button onClick={() => onEdit(item)}>Edit</button><button className="danger-link" onClick={() => onDelete(item.id)}>Delete</button></div>
      </article>)}</div> : <Empty title="No planned expenses for this month" text="Add subscriptions, groceries, rent or any other expected monthly cost." />}
    </article>
  </section>;
}

function TransactionsView({ transactions, allTransactions, accounts, query, setQuery, category, setCategory, accountFilter, setAccountFilter, accountName, onImport }: {
  transactions: Transaction[];
  allTransactions: Transaction[];
  accounts: FinanceAccount[];
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  accountFilter: string;
  setAccountFilter: (value: string) => void;
  accountName: (id: number | null) => string;
  onImport: () => void;
}) {
  const totalIncome = allTransactions.filter((item) => item.kind === "income").reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = allTransactions.filter((item) => item.kind === "expense").reduce((sum, item) => sum + item.amount, 0);
  return <section>
    <div className="transaction-summary">
      <Kpi label="Total income recorded" value={euro.format(totalIncome)} note={`${allTransactions.filter((item) => item.kind === "income").length} incoming transactions`} good />
      <Kpi label="Total expenditure recorded" value={euro.format(totalExpense)} note={`${allTransactions.filter((item) => item.kind === "expense").length} outgoing transactions`} />
      <Kpi label="Recorded cash flow" value={euro.format(totalIncome - totalExpense)} note="Income minus expenditure" good={totalIncome >= totalExpense} />
    </div>
    <article className="dash-card full-page-card">
    <div className="dash-card-head"><div><small>Every movement</small><h2>Transaction history</h2></div><button className="inline-action" onClick={onImport}>Import a file</button></div>
    <div className="transaction-tools three-filters">
      <input aria-label="Search transactions" placeholder="Search merchant or category…" value={query} onChange={(event) => setQuery(event.target.value)} />
      <select aria-label="Filter account" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}><option>All</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select>
      <select aria-label="Filter category" value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
    </div>
    {transactions.length ? <TransactionTable transactions={transactions} accountName={accountName} /> : <Empty title="No matching transactions" text="Try another filter or import an ING CSV or PDF statement." />}
    </article>
  </section>;
}

function AccountsView({ accounts, transactions, onAdd, onBalance }: {
  accounts: FinanceAccount[];
  transactions: Transaction[];
  onAdd: () => void;
  onBalance: (account: FinanceAccount) => void;
}) {
  return <section>
    <div className="section-toolbar"><div><span>{accounts.length} money locations</span><p>Assets increase your net worth; cards, loans and other negative balances reduce it.</p></div><button className="dash-button primary" onClick={onAdd}>＋ Add financial account</button></div>
    <div className="accounts-grid">
      {accounts.map((account) => {
        const count = transactions.filter((item) => item.accountId === account.id).length;
        return <article className="account-card" key={account.id} style={{ "--account-color": account.color } as CSSProperties}>
          <div className="account-card-top"><span className="account-symbol">{accountSymbol(account.type)}</span><span className={`type-pill ${account.type}`}>{account.type}</span></div>
          <small>{account.institution}{account.lastFour ? ` •••• ${account.lastFour}` : ""}</small>
          <h2>{account.name}</h2>
          <strong className={account.currentBalance < 0 ? "negative" : ""}>{euro.format(account.currentBalance)}</strong>
          <footer><span>{count} transactions</span><button onClick={() => onBalance(account)}>Update balance</button></footer>
        </article>;
      })}
    </div>
  </section>;
}

function SavingsView({ accounts, totals, onAdd, onBalance }: {
  accounts: FinanceAccount[];
  totals: Totals;
  onAdd: () => void;
  onBalance: (account: FinanceAccount) => void;
}) {
  const savings = accounts.filter((account) => account.type === "savings");
  const target = 5000;
  const percent = Math.min(100, totals.savings / target * 100);
  return <section className="savings-layout">
    <article className="savings-hero">
      <div><p className="eyebrow"><span /> Savings position</p><h2>{euro.format(totals.savings)}</h2><p>Money currently marked as savings across all your accounts.</p></div>
      <div className="savings-ring" style={{ "--goal-progress": `${percent}%` } as CSSProperties}><strong>{Math.round(percent)}%</strong><span>of €5,000</span></div>
    </article>
    <div className="savings-grid">
      <article className="dash-card">
        <div className="dash-card-head"><div><small>Dedicated savings</small><h2>Your savings accounts</h2></div><button onClick={onAdd}>Add savings account</button></div>
        <div className="saving-account-list">
          {savings.length ? savings.map((account) => <button key={account.id} onClick={() => onBalance(account)}><span style={{ background: account.color }} /><div><strong>{account.name}</strong><small>{account.institution}</small></div><b>{euro.format(account.currentBalance)}</b></button>) : <Empty title="No savings account yet" text="Add one to separate savings from spendable money." />}
        </div>
      </article>
      <article className="dash-card">
        <div className="dash-card-head"><div><small>Next milestone</small><h2>Emergency fund</h2></div><span>€5,000 target</span></div>
        <div className="goal-summary"><strong>{euro.format(Math.max(0, target - totals.savings))}</strong><span>left to reach your target</span><div className="goal-progress"><i style={{ width: `${percent}%` }} /></div><p>At €250 per month, you could reach this goal in approximately {Math.max(1, Math.ceil((target - totals.savings) / 250))} months.</p></div>
      </article>
    </div>
  </section>;
}

function InsightsView({ transactions, monthly, recurring, categoryTotals }: {
  transactions: Transaction[];
  monthly: ReturnType<typeof monthSeries>;
  recurring: ReturnType<typeof recurringGroups>;
  categoryTotals: Array<[string, number]>;
}) {
  const recent = monthly.at(-1);
  const previous = monthly.at(-2);
  const change = recent && previous && previous.expense ? (recent.expense - previous.expense) / previous.expense * 100 : 0;
  const predictable = recurring.reduce((sum, item) => sum + item.average, 0);
  return <section className="insights-layout">
    <div className="insight-summary-grid">
      <Kpi label="Usual monthly commitments" value={euro.format(predictable)} note={`${recurring.length} repeating groups`} />
      <Kpi label="Spending trend" value={`${change >= 0 ? "+" : ""}${Math.round(change)}%`} note="Compared with last month" good={change <= 0} />
      <Kpi label="Transactions analysed" value={String(transactions.length)} note="Across all accounts" />
    </div>
    <div className="dashboard-grid">
      <article className="dash-card">
        <div className="dash-card-head"><div><small>Usual trend</small><h2>Six-month cash flow</h2></div><span>All accounts</span></div>
        <TrendChart monthly={monthly} />
      </article>
      <article className="dash-card">
        <div className="dash-card-head"><div><small>Behaviour pattern</small><h2>Category concentration</h2></div></div>
        <CategoryBars data={categoryTotals} />
      </article>
      <article className="dash-card transaction-card">
        <div className="dash-card-head"><div><small>Constant transactions</small><h2>Likely recurring payments</h2></div><span>Detected automatically</span></div>
        {recurring.length ? <div className="recurring-grid">{recurring.map((item) => <article key={item.merchant}><span className="recurring-icon">↻</span><div><strong>{item.merchant}</strong><small>{item.category} · {item.count} occurrences</small></div><b>{euro.format(item.average)}<small>usual</small></b></article>)}</div> : <Empty title="No recurring pattern yet" text="Patterns appear after at least two similar payments are imported." />}
      </article>
    </div>
  </section>;
}

function ImportModal({ step, rows, accounts, accountId, setAccountId, onFile, onRows, onConfirm, onClose, error, message, pending }: {
  step: "choose" | "preview" | "complete";
  rows: ImportRow[];
  accounts: FinanceAccount[];
  accountId: number;
  setAccountId: (id: number) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
  onRows: (rows: ImportRow[]) => void;
  onConfirm: () => void;
  onClose: () => void;
  error: string;
  message: string;
  pending: boolean;
}) {
  const selectedCount = rows.filter((row) => row.selected && !row.duplicate).length;
  return <ModalShell onClose={onClose} wide>
    <div className="modal import-modal">
      <div className="import-head">
        <div><span className="step-label">ING FILE IMPORT · {step === "choose" ? "1 OF 3" : step === "preview" ? "2 OF 3" : "3 OF 3"}</span><h2>{step === "choose" ? "Bring your history into focus" : step === "preview" ? "Review before anything changes" : "Import complete"}</h2></div>
        <button aria-label="Close import" onClick={onClose}>×</button>
      </div>
      {step === "choose" && <>
        <p>Select the account the statement belongs to, then choose the CSV or text-based PDF downloaded from Mijn ING.</p>
        <Field label="Import into" full><select value={accountId} onChange={(event) => setAccountId(Number(event.target.value))}>{accounts.filter((account) => account.type !== "cash" && account.type !== "savings").map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></Field>
        <label className="csv-drop">
          <input type="file" accept=".csv,.pdf,text/csv,application/pdf" onChange={onFile} />
          <span className="upload-symbol">⇧</span><strong>Choose an ING CSV or PDF</strong><small>Text-based statements are supported. The original file is not retained.</small>
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="privacy-note"><b>Private by design</b><span>Only confirmed transactions are saved to your account.</span></div>
      </>}
      {step === "preview" && <>
        <div className="import-stats"><span><strong>{rows.length}</strong> detected</span><span><strong>{rows.filter((row) => row.duplicate).length}</strong> duplicates</span><span><strong>{selectedCount}</strong> ready</span></div>
        <div className="import-table-wrap">
          <table className="import-table">
            <thead><tr><th>Use</th><th>Date</th><th>Description</th><th>Type</th><th>Category</th><th>Amount</th></tr></thead>
            <tbody>{rows.map((row, index) => <tr key={`${row.fingerprint}-${index}`} className={row.duplicate ? "duplicate-row" : ""}>
              <td><input aria-label={`Include ${row.name}`} type="checkbox" checked={row.selected} disabled={row.duplicate} onChange={(event) => onRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, selected: event.target.checked } : item))} /></td>
              <td>{shortDate(row.date)}</td><td><strong>{row.name}</strong>{row.duplicate && <small>Likely duplicate</small>}</td>
              <td><span className={`kind-chip ${row.kind}`}>{row.kind}</span></td>
              <td><select aria-label={`Category for ${row.name}`} value={row.category} onChange={(event) => onRows(rows.map((item, itemIndex) => itemIndex === index ? { ...item, category: event.target.value } : item))}>{categories.map((item) => <option key={item}>{item}</option>)}</select></td>
              <td className={row.kind === "income" ? "amount-income" : ""}>{row.kind === "income" ? "+" : "−"}{euro.format(row.amount)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button className="dash-button" disabled={pending} onClick={onClose}>Cancel</button><button className="dash-button primary" disabled={!selectedCount || pending} onClick={onConfirm}>{pending ? "Importing…" : `Import ${selectedCount} transactions`}</button></div>
      </>}
      {step === "complete" && <div className="import-complete"><span>✓</span><h3>{message}</h3><p>Your balances, account history and insights have been recalculated.</p><button className="dash-button primary" onClick={onClose}>View updated dashboard</button></div>}
    </div>
  </ModalShell>;
}

function TransactionTable({ transactions, accountName }: { transactions: Transaction[]; accountName: (id: number | null) => string }) {
  return <table className="transaction-table">
    <thead><tr><th>Transaction</th><th>Account</th><th>Category</th><th>Date</th><th>Amount</th></tr></thead>
    <tbody>{transactions.map((item) => <tr key={item.id}>
      <td><div className="transaction-name"><span className="transaction-icon">{item.kind === "income" ? "↙" : "↗"}</span><div>{item.name}<small>{item.source === "ing_csv" ? "Imported from ING" : "Manual entry"}</small></div></div></td>
      <td>{accountName(item.accountId)}</td><td>{item.category}</td><td>{shortDate(item.date)}</td>
      <td className={item.kind === "income" ? "amount-income" : "amount-expense"}>{item.kind === "income" ? "+" : "−"}{euro.format(item.amount)}</td>
    </tr>)}</tbody>
  </table>;
}

function TrendChart({ monthly }: { monthly: ReturnType<typeof monthSeries> }) {
  const fallback = [{ label: "Feb", income: 1000, expense: 650 }, { label: "Mar", income: 1100, expense: 720 }, { label: "Apr", income: 900, expense: 680 }, { label: "May", income: 1200, expense: 800 }, { label: "Jun", income: 1250, expense: 760 }, { label: "Jul", income: 1212, expense: 889 }];
  const data = monthly.length ? monthly : fallback;
  const max = Math.max(...data.flatMap((item) => [item.income, item.expense]), 1);
  return <div className="big-chart">{data.map((item) => <div key={item.label}><i title={`Income ${euro.format(item.income)}`} style={{ height: `${Math.max(3, item.income / max * 92)}%` }} /><i className="current" title={`Spending ${euro.format(item.expense)}`} style={{ height: `${Math.max(3, item.expense / max * 92)}%` }} /><small>{item.label}</small></div>)}</div>;
}

function CategoryBars({ data }: { data: Array<[string, number]> }) {
  const max = data[0]?.[1] ?? 1;
  return <div className="budget-list category-bars">{data.length ? data.map(([name, value], index) => <div className="budget-row" key={name}><div><span>{name}</span><span>{euro.format(value)}</span></div><div className="budget-track"><i style={{ "--width": `${value / max * 100}%`, "--fill": ["#42c998", "#657ee8", "#a78bfa", "#f2a15f", "#55a5e8", "#da6d87"][index] } as CSSProperties} /></div></div>) : <Empty title="No spending yet" text="Your category picture will appear here." />}</div>;
}

function AccountMini({ account }: { account: FinanceAccount }) {
  return <article><span style={{ background: account.color }}>{accountSymbol(account.type)}</span><div><small>{account.institution}</small><strong>{account.name}</strong></div><b className={account.currentBalance < 0 ? "negative" : ""}>{euro.format(account.currentBalance)}</b></article>;
}

function accountSymbol(type: FinanceAccount["type"]) {
  if (type === "cash") return "€";
  if (type === "credit" || type === "debit") return "▰";
  if (type === "savings" || type === "pension") return "◇";
  if (type === "stock" || type === "investment") return "↗";
  if (type === "crypto") return "₿";
  if (type === "property") return "⌂";
  if (type === "loan") return "−";
  if (type === "income") return "+";
  return "◫";
}

function Kpi({ label, value, note, good = false }: { label: string; value: string; note: string; good?: boolean }) {
  return <article className="kpi-card"><small>{label}</small><strong>{value}</strong><em className={good ? "good" : ""}>{note}</em></article>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><strong>{title}</strong><span>{text}</span></div>;
}

function Field({ label, full = false, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <label className={`field ${full ? "full" : ""}`}><span>{label}</span>{children}</label>;
}

function ModalShell({ onClose, wide = false, children }: { onClose: () => void; wide?: boolean; children: React.ReactNode }) {
  return <div className={`modal-backdrop ${wide ? "wide-backdrop" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>{children}</div>;
}

function ModalActions({ onClose, submit }: { onClose: () => void; submit: string }) {
  return <div className="modal-actions"><button type="button" className="dash-button" onClick={onClose}>Cancel</button><button className="dash-button primary">{submit}</button></div>;
}

function shortDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-NL", { day: "numeric", month: "short", year: "numeric" });
}
