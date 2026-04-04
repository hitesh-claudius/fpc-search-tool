/* ─── CSV Parser ─────────────────────────────────────────────────────── */
export function parseCSV(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter(Boolean);

  const split = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (const c of line) {
      if (c === '"') q = !q;
      else if (c === "," && !q) {
        out.push(cur.trim());
        cur = "";
      } else cur += c;
    }
    out.push(cur.trim());
    return out.map((v) => v.replace(/^"|"$/g, ""));
  };

  let hi = 0;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i].toLowerCase();
    if (
      l.includes("customer search term") ||
      l.includes("search term") ||
      (l.includes("clicks") && l.includes("spend"))
    ) {
      hi = i;
      break;
    }
  }

  const headers = split(lines[hi]);
  const rows = lines
    .slice(hi + 1)
    .map((l) => {
      const v = split(l);
      const o = {};
      headers.forEach((h, i) => {
        o[h] = v[i] ?? "";
      });
      return o;
    })
    .filter((r) => headers.some((h) => r[h] && r[h].trim()));

  return { headers, rows };
}

function findCol(headers, candidates) {
  for (const c of candidates) {
    const f = headers.find((h) => h.toLowerCase().includes(c.toLowerCase()));
    if (f) return f;
  }
  return null;
}

const toNum = (v) => parseFloat(String(v ?? "").replace(/[$,%\s]/g, "")) || 0;

/* ─── Data Engine ────────────────────────────────────────────────────── */
export function analyze(rows, headers, targetAcos, minSpend) {
  const cols = {
    term: findCol(headers, ["customer search term", "search term"]),
    spend: findCol(headers, ["spend", "cost"]),
    sales: findCol(headers, [
      "7 day total sales",
      "14 day total sales",
      "total sales",
      "sales",
    ]),
    orders: findCol(headers, [
      "7 day total orders",
      "14 day total orders",
      "total orders",
      "orders",
      "purchases",
    ]),
    clicks: findCol(headers, ["clicks"]),
    impr: findCol(headers, ["impressions"]),
    match: findCol(headers, ["match type"]),
    camp: findCol(headers, ["campaign name", "campaign"]),
  };

  const parsed = rows
    .map((r) => {
      const spend = toNum(r[cols.spend]);
      const sales = toNum(r[cols.sales]);
      const orders = toNum(r[cols.orders]);
      const clicks = toNum(r[cols.clicks]);
      const impr = toNum(r[cols.impr]);
      const acos = sales > 0 ? (spend / sales) * 100 : spend > 0 ? 9999 : 0;
      return {
        term: r[cols.term] || "Unknown",
        spend,
        sales,
        orders,
        clicks,
        impr,
        acos,
        match: r[cols.match] || "",
        camp: r[cols.camp] || "",
        ctr: impr > 0 ? (clicks / impr) * 100 : 0,
        cvr: clicks > 0 ? (orders / clicks) * 100 : 0,
        cpc: clicks > 0 ? spend / clicks : 0,
        cpa: orders > 0 ? spend / orders : 0,
        roas: spend > 0 ? sales / spend : 0,
      };
    })
    .filter((r) => r.spend >= minSpend || r.sales > 0);

  const salesVals = parsed
    .filter((r) => r.sales > 0)
    .map((r) => r.sales)
    .sort((a, b) => a - b);
  const salesMid = salesVals.length
    ? salesVals[Math.floor(salesVals.length * 0.4)]
    : 1;

  const quads = { STARS: [], CASH_COWS: [], QUESTION_MARKS: [], DOGS: [] };
  parsed.forEach((r) => {
    if (r.orders === 0) {
      quads.DOGS.push(r);
      return;
    }
    const hi = r.sales >= salesMid;
    const eff = r.acos <= targetAcos;
    if (hi && eff) quads.STARS.push(r);
    else if (hi && !eff) quads.CASH_COWS.push(r);
    else if (!hi && eff) quads.QUESTION_MARKS.push(r);
    else quads.DOGS.push(r);
  });

  const zeroSales = parsed
    .filter((r) => r.orders === 0 && r.spend > 0)
    .sort((a, b) => b.spend - a.spend);
  const highAcos = parsed
    .filter((r) => r.orders > 0 && r.acos > targetAcos * 1.5)
    .sort((a, b) => b.spend - a.spend);
  const totalWaste = zeroSales.reduce((s, r) => s + r.spend, 0);
  const highAcosWaste = highAcos.reduce(
    (s, r) => s + Math.max(0, r.spend - (r.sales * targetAcos) / 100),
    0
  );

  return { quads, parsed, zeroSales, highAcos, totalWaste, highAcosWaste };
}

/* ─── Formatters ─────────────────────────────────────────────────────── */
export const fmt$ = (n) =>
  !n || isNaN(n)
    ? "$0.00"
    : n >= 1000
    ? `$${(n / 1000).toFixed(1)}K`
    : `$${n.toFixed(2)}`;
export const fmtP = (n) =>
  !n || isNaN(n) || n >= 9999 ? "N/A" : `${n.toFixed(1)}%`;
export const fmtK = (n) =>
  !n || isNaN(n)
    ? "0"
    : n >= 1000
    ? `${(n / 1000).toFixed(1)}K`
    : String(Math.round(n));
export const fmtX = (n) =>
  n == null || isNaN(n) || n === 0 ? "\u2014" : `${Number(n).toFixed(2)}x`;

/* ─── CSV Export ─────────────────────────────────────────────────────── */
export function buildCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const safe$ = (n) =>
    n != null && !isNaN(n) ? Number(n).toFixed(2) : "0.00";
  const safeP = (n) =>
    n != null && !isNaN(n) && n < 9999 ? Number(n).toFixed(1) : "N/A";
  const hdr = [
    "Search Term",
    "Quadrant",
    "Spend",
    "Sales",
    "Orders",
    "ACOS %",
    "ROAS",
    "CPA",
    "Clicks",
    "CVR %",
    "CPC",
    "Match Type",
    "Campaign",
  ];
  const body = rows.map((r) =>
    [
      esc(r.term),
      esc(r.quadrant ?? ""),
      safe$(r.spend),
      safe$(r.sales),
      r.orders ?? 0,
      safeP(r.acos),
      safe$(r.roas ?? 0),
      r.cpa != null && r.cpa > 0 ? safe$(r.cpa) : "N/A",
      r.clicks ?? 0,
      safeP(r.cvr),
      safe$(r.cpc ?? 0),
      esc(r.match),
      esc(r.camp),
    ].join(",")
  );
  return [hdr.join(","), ...body].join("\n");
}

export function triggerDownload(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─── Constants ──────────────────────────────────────────────────────── */
export const QUAD = {
  STARS: {
    label: "PRIME MOVERS",
    color: "#f59e0b",
    bgClass: "bg-quad-stars/[0.08]",
    borderClass: "border-quad-stars/25",
    action:
      "Scaling and profitable. Account engines. Push bids, expand budgets, harvest top terms into exact match.",
  },
  CASH_COWS: {
    label: "HUNGRY GIANTS",
    color: "#a78bfa",
    bgClass: "bg-quad-cows/[0.07]",
    borderClass: "border-quad-cows/25",
    action:
      "Spending big but leaking margin. Step bids down 10-15% and let them stabilize over 2 weeks.",
  },
  QUESTION_MARKS: {
    label: "DARK HORSES",
    color: "#2dd4bf",
    bgClass: "bg-quad-qmarks/[0.07]",
    borderClass: "border-quad-qmarks/25",
    action:
      "Efficient but underexposed. Nobody is betting on them yet. Raise bids and give them room to run.",
  },
  DOGS: {
    label: "DEAD WEIGHT",
    color: "#f87171",
    bgClass: "bg-quad-dogs/[0.07]",
    borderClass: "border-quad-dogs/25",
    action:
      "Pulling the account down. Negate in exact match, pause the ad group, or cut bids 50% now.",
  },
};

export const QMAP = {
  STARS: "Prime Movers",
  CASH_COWS: "Hungry Giants",
  QUESTION_MARKS: "Dark Horses",
  DOGS: "Dead Weight",
};
