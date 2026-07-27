export type AccountType = "bank" | "credit" | "debit" | "cash" | "savings" | "stock" | "investment" | "crypto" | "property" | "pension" | "loan" | "income" | "other";

export type FinanceAccount = {
  id: number;
  name: string;
  institution: string;
  type: AccountType;
  currency: string;
  currentBalance: number;
  lastFour?: string | null;
  color: string;
};

export type Transaction = {
  id: number;
  accountId: number | null;
  name: string;
  category: string;
  amount: number;
  kind: "expense" | "income";
  date: string;
  source?: string;
  fingerprint?: string | null;
};

export type ImportRow = Omit<Transaction, "id" | "accountId"> & {
  selected: boolean;
  duplicate?: boolean;
  originalDescription: string;
};

export const categories = [
  "Housing",
  "Groceries",
  "Dining",
  "Transport",
  "Insurance",
  "Bills",
  "Subscriptions",
  "Shopping",
  "Health",
  "Education",
  "Lifestyle",
  "Savings",
  "Income",
  "Transfers",
  "Other",
];

export function categorise(description: string, kind: "expense" | "income") {
  const text = description.toLowerCase();
  if (kind === "income") {
    if (/(transfer|overboeking|eigen rekening)/.test(text)) return "Transfers";
    return "Income";
  }
  const rules: Array<[RegExp, string]> = [
    [/(duwo|huur|rent|housing|woon)/, "Housing"],
    [/(albert heijn|jumbo|lidl|aldi|dirk|plus |spar|supermarkt|grocery)/, "Groceries"],
    [/(restaurant|cafe|coffee|thuisbezorgd|ubereats|deliveroo|food|mcdonald|burger king)/, "Dining"],
    [/(ns |ns\.|gvb|ovpay|uber|bolt|train|tram|metro|bus|fiets|bike)/, "Transport"],
    [/(zilveren kruis|insurance|verzekering|verzeker)/, "Insurance"],
    [/(vattenfall|waternet|kpn|odido|vodafone|lebara|energie|electric|internet|phone)/, "Bills"],
    [/(netflix|spotify|chatgpt|apple\.com\/bill|subscription|abonnement)/, "Subscriptions"],
    [/(amazon|bol\.com|primark|hema|action|ikea|shopping)/, "Shopping"],
    [/(apotheek|pharmacy|doctor|hospital|tandarts|health)/, "Health"],
    [/(tio|university|school|course|udemy|coursera|book)/, "Education"],
    [/(savings|spaar|deposit)/, "Savings"],
    [/(transfer|overboeking|eigen rekening|tikkie)/, "Transfers"],
  ];
  return rules.find(([rule]) => rule.test(text))?.[1] ?? "Other";
}

export function parseIngCsv(text: string): ImportRow[] {
  const delimiter = detectDelimiter(text);
  const matrix = parseDelimited(text.replace(/^\uFEFF/, ""), delimiter);
  if (matrix.length < 2) throw new Error("This CSV does not contain transaction rows.");

  const headers = matrix[0].map(normaliseHeader);
  const indexFor = (...names: string[]) =>
    headers.findIndex((header) => names.some((name) => header.includes(name)));

  const dateIndex = indexFor("datum", "date");
  const amountIndex = indexFor("bedrag", "amount");
  const directionIndex = indexFor("af bij", "debit credit", "credit debit");
  const nameIndex = indexFor("naam omschrijving", "name description", "omschrijving");
  const detailsIndex = indexFor("mededelingen", "details", "description");

  if (dateIndex < 0 || amountIndex < 0) {
    throw new Error("The ING date or amount column could not be identified.");
  }

  return matrix.slice(1).flatMap((row) => {
    if (!row.some((value) => value.trim())) return [];
    const rawAmount = parseAmount(row[amountIndex]);
    if (!Number.isFinite(rawAmount) || rawAmount === 0) return [];
    const direction = directionIndex >= 0 ? row[directionIndex].trim().toLowerCase() : "";
    const kind: "expense" | "income" =
      direction === "af" || direction.includes("debit") || rawAmount < 0
        ? "expense"
        : "income";
    const rawName = [nameIndex >= 0 ? row[nameIndex] : "", detailsIndex >= 0 ? row[detailsIndex] : ""]
      .filter(Boolean)
      .join(" · ")
      .replace(/\s+/g, " ")
      .trim() || "Imported transaction";
    const date = parseDate(row[dateIndex]);
    if (!date) return [];
    const amount = Math.abs(rawAmount);
    const fingerprint = createFingerprint(date, amount, kind, rawName);
    return [{
      name: cleanMerchant(rawName),
      category: categorise(rawName, kind),
      amount,
      kind,
      date,
      source: "ing_csv",
      fingerprint,
      selected: true,
      originalDescription: rawName,
    }];
  });
}

export function parseIngPdfLines(lines: string[]): ImportRow[] {
  const transactions: Array<{
    date: string;
    description: string;
    amount: number;
    kind: "expense" | "income";
  }> = [];
  const ignored = /^(datum|date|omschrijving|description|bedrag|amount|pagina|page|iban|rekening|account|saldo|total)/i;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || ignored.test(line)) continue;
    const dateMatch = line.match(/\b(\d{1,2}[-/]\d{1,2}[-/]\d{4}|\d{4}-\d{2}-\d{2})\b/);
    const amountMatches = [...line.matchAll(/(?:€\s*)?[-+]?\d{1,3}(?:\.\d{3})*(?:,\d{2})|(?:€\s*)?[-+]?\d+(?:\.\d{2})/g)];
    const amountMatch = amountMatches.at(-1);

    if (dateMatch && amountMatch) {
      const date = parseDate(dateMatch[1]);
      const rawAmount = parseAmount(amountMatch[0]);
      if (!date || !Number.isFinite(rawAmount) || rawAmount === 0) continue;
      const directionText = line.toLowerCase();
      const kind: "expense" | "income" =
        /\baf\b|\bdebit\b/.test(directionText) || rawAmount < 0
          ? "expense"
          : /\bbij\b|\bcredit\b/.test(directionText) || rawAmount > 0
            ? "income"
            : "expense";
      const description = line
        .replace(dateMatch[0], "")
        .replace(amountMatch[0], "")
        .replace(/\b(af|bij|debit|credit)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      transactions.push({
        date,
        description: description || "Imported PDF transaction",
        amount: Math.abs(rawAmount),
        kind,
      });
    } else if (transactions.length && !ignored.test(line) && !/^\d+\s*\/\s*\d+$/.test(line)) {
      const current = transactions[transactions.length - 1];
      current.description = `${current.description} ${line}`.slice(0, 500);
    }
  }

  if (!transactions.length) {
    throw new Error(
      "No transaction rows were found. This may be a scanned image, a password-protected PDF, or an unsupported statement layout.",
    );
  }

  return transactions.map((item) => ({
    name: cleanMerchant(item.description),
    category: categorise(item.description, item.kind),
    amount: item.amount,
    kind: item.kind,
    date: item.date,
    source: "ing_pdf",
    fingerprint: createFingerprint(item.date, item.amount, item.kind, item.description),
    selected: true,
    originalDescription: item.description,
  }));
}

export function createFingerprint(
  date: string,
  amount: number,
  kind: string,
  description: string,
) {
  const source = `${date}|${amount.toFixed(2)}|${kind}|${description.toLowerCase().replace(/\s+/g, " ").trim()}`;
  let hash = 5381;
  for (let i = 0; i < source.length; i += 1) hash = ((hash << 5) + hash) ^ source.charCodeAt(i);
  return `fl_${(hash >>> 0).toString(36)}`;
}

export function recurringGroups(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  transactions.filter((item) => item.kind === "expense").forEach((item) => {
    const key = cleanMerchant(item.name).toLowerCase();
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  });
  return [...groups.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([merchant, items]) => ({
      merchant: titleCase(merchant),
      count: items.length,
      average: items.reduce((sum, item) => sum + item.amount, 0) / items.length,
      category: items[0].category,
      lastDate: [...items].sort((a, b) => b.date.localeCompare(a.date))[0].date,
    }))
    .sort((a, b) => b.average - a.average);
}

export function monthSeries(transactions: Transaction[]) {
  const months = new Map<string, { income: number; expense: number }>();
  transactions.forEach((item) => {
    const key = item.date.slice(0, 7);
    const current = months.get(key) ?? { income: 0, expense: 0 };
    current[item.kind] += item.amount;
    months.set(key, current);
  });
  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, values]) => ({
      month,
      label: new Date(`${month}-01T12:00:00`).toLocaleDateString("en-NL", { month: "short" }),
      ...values,
    }));
}

function detectDelimiter(text: string) {
  const header = text.split(/\r?\n/, 1)[0] ?? "";
  const semicolons = (header.match(/;/g) ?? []).length;
  const commas = (header.match(/,/g) ?? []).length;
  return semicolons >= commas ? ";" : ",";
}

function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(value);
      value = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(value);
      if (row.some((cell) => cell.length)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value);
  if (row.some((cell) => cell.length)) rows.push(row);
  return rows;
}

function normaliseHeader(value: string) {
  return value.toLowerCase().replace(/[\/_\-()€]/g, " ").replace(/\s+/g, " ").trim();
}

function parseAmount(value: string) {
  const cleaned = value.replace(/[€\s]/g, "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    return Number(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return Number(cleaned.replace(",", "."));
}

function parseDate(value: string) {
  const cleaned = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) return cleaned.slice(0, 10);
  const match = cleaned.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function cleanMerchant(value: string) {
  return value
    .split("·")[0]
    .replace(/\b(iban|kenmerk|pasvolgnr|transactie)\b.*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 80);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}
