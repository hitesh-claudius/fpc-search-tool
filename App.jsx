import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";

/* ─── Tokens ─────────────────────────────────────────────────────────── */
const C = {
  bg: "#07101f", surface: "#0c1628", card: "#0f1e35", border: "#1a2d47",
  accent: "#f59e0b", text: "#e2e8f0", textSec: "#607a99", textDim: "#2a3f5a",
  stars: "#f59e0b", cows: "#a78bfa", qmarks: "#2dd4bf", dogs: "#f87171",
};

const QUAD = {
  STARS:          { label: "PRIME MOVERS",  color: C.stars,  bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)",  action: "Scaling and profitable. Account engines. Push bids, expand budgets, harvest top terms into exact match." },
  CASH_COWS:      { label: "HUNGRY GIANTS", color: C.cows,   bg: "rgba(167,139,250,0.07)", border: "rgba(167,139,250,0.25)", action: "Spending big but leaking margin. Step bids down 10-15% and let them stabilize over 2 weeks." },
  QUESTION_MARKS: { label: "DARK HORSES",   color: C.qmarks, bg: "rgba(45,212,191,0.07)",  border: "rgba(45,212,191,0.25)",  action: "Efficient but underexposed. Nobody is betting on them yet. Raise bids and give them room to run." },
  DOGS:           { label: "DEAD WEIGHT",   color: C.dogs,   bg: "rgba(248,113,113,0.07)", border: "rgba(248,113,113,0.25)", action: "Pulling the account down. Negate in exact match, pause the ad group, or cut bids 50% now." },
};

/* ─── CSV Parser ─────────────────────────────────────────────────────── */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter(Boolean);
  const split = (line) => {
    const out = []; let cur = ""; let q = false;
    for (const c of line) {
      if (c === '"') q = !q;
      else if (c === "," && !q) { out.push(cur.trim()); cur = ""; }
      else cur += c;
    }
    out.push(cur.trim());
    return out.map((v) => v.replace(/^"|"$/g, ""));
  };
  let hi = 0;
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const l = lines[i].toLowerCase();
    if (l.includes("customer search term") || l.includes("search term") || (l.includes("clicks") && l.includes("spend"))) { hi = i; break; }
  }
  const headers = split(lines[hi]);
  const rows = lines.slice(hi + 1).map((l) => {
    const v = split(l); const o = {};
    headers.forEach((h, i) => { o[h] = v[i] ?? ""; });
    return o;
  }).filter((r) => headers.some((h) => r[h] && r[h].trim()));
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
function analyze(rows, headers, targetAcos, minSpend) {
  const cols = {
    term:   findCol(headers, ["customer search term", "search term"]),
    spend:  findCol(headers, ["spend", "cost"]),
    sales:  findCol(headers, ["7 day total sales", "14 day total sales", "total sales", "sales"]),
    orders: findCol(headers, ["7 day total orders", "14 day total orders", "total orders", "orders", "purchases"]),
    clicks: findCol(headers, ["clicks"]),
    impr:   findCol(headers, ["impressions"]),
    match:  findCol(headers, ["match type"]),
    camp:   findCol(headers, ["campaign name", "campaign"]),
  };

  const parsed = rows.map((r) => {
    const spend  = toNum(r[cols.spend]);
    const sales  = toNum(r[cols.sales]);
    const orders = toNum(r[cols.orders]);
    const clicks = toNum(r[cols.clicks]);
    const impr   = toNum(r[cols.impr]);
    const acos   = sales > 0 ? (spend / sales) * 100 : spend > 0 ? 9999 : 0;
    return {
      term:   r[cols.term]  || "Unknown",
      spend, sales, orders, clicks, impr, acos,
      match:  r[cols.match] || "",
      camp:   r[cols.camp]  || "",
      ctr:    impr   > 0 ? (clicks / impr)   * 100 : 0,
      cvr:    clicks > 0 ? (orders / clicks) * 100 : 0,
      cpc:    clicks > 0 ? spend  / clicks        : 0,
      cpa:    orders > 0 ? spend  / orders        : 0,
      roas:   spend  > 0 ? sales  / spend         : 0,
    };
  }).filter((r) => r.spend >= minSpend || r.sales > 0);

  const salesVals = parsed.filter((r) => r.sales > 0).map((r) => r.sales).sort((a, b) => a - b);
  const salesMid  = salesVals.length ? salesVals[Math.floor(salesVals.length * 0.4)] : 1;

  const quads = { STARS: [], CASH_COWS: [], QUESTION_MARKS: [], DOGS: [] };
  parsed.forEach((r) => {
    if (r.orders === 0) { quads.DOGS.push(r); return; }
    const hi  = r.sales >= salesMid;
    const eff = r.acos  <= targetAcos;
    if      ( hi &&  eff) quads.STARS.push(r);
    else if ( hi && !eff) quads.CASH_COWS.push(r);
    else if (!hi &&  eff) quads.QUESTION_MARKS.push(r);
    else                  quads.DOGS.push(r);
  });

  const zeroSales     = parsed.filter((r) => r.orders === 0 && r.spend > 0).sort((a, b) => b.spend - a.spend);
  const highAcos      = parsed.filter((r) => r.orders > 0 && r.acos > targetAcos * 1.5).sort((a, b) => b.spend - a.spend);
  const totalWaste    = zeroSales.reduce((s, r) => s + r.spend, 0);
  const highAcosWaste = highAcos.reduce((s, r) => s + Math.max(0, r.spend - r.sales * targetAcos / 100), 0);

  return { quads, parsed, zeroSales, highAcos, totalWaste, highAcosWaste };
}

/* ─── Formatters ─────────────────────────────────────────────────────── */
const fmt$ = (n) => (!n || isNaN(n)) ? "$0.00" : n >= 1000 ? `$${(n/1000).toFixed(1)}K` : `$${n.toFixed(2)}`;
const fmtP = (n) => (!n || isNaN(n) || n >= 9999) ? "N/A" : `${n.toFixed(1)}%`;
const fmtK = (n) => (!n || isNaN(n)) ? "0" : n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(Math.round(n));
const fmtX = (n) => (n == null || isNaN(n) || n === 0) ? "—" : `${Number(n).toFixed(2)}x`;

/* ─── CSV Export ─────────────────────────────────────────────────────── */
function buildCSV(rows) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const safe$ = (n) => (n != null && !isNaN(n)) ? Number(n).toFixed(2) : "0.00";
  const safeP = (n) => (n != null && !isNaN(n) && n < 9999) ? Number(n).toFixed(1) : "N/A";
  const hdr = ["Search Term","Quadrant","Spend","Sales","Orders","ACOS %","ROAS","CPA","Clicks","CVR %","CPC","Match Type","Campaign"];
  const body = rows.map((r) => [
    esc(r.term), esc(r.quadrant ?? ""),
    safe$(r.spend), safe$(r.sales), r.orders ?? 0,
    safeP(r.acos),
    safe$(r.roas ?? 0),
    (r.cpa != null && r.cpa > 0) ? safe$(r.cpa) : "N/A",
    r.clicks ?? 0, safeP(r.cvr), safe$(r.cpc ?? 0),
    esc(r.match), esc(r.camp),
  ].join(","));
  return [hdr.join(","), ...body].join("\n");
}

function triggerDownload(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─── Pill ───────────────────────────────────────────────────────────── */
function Pill({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 100, padding: "14px 16px", background: C.card, borderTop: `2px solid ${color}`, textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "DM Mono, monospace", color, letterSpacing: "-0.5px" }}>{value}</div>
      <div style={{ fontSize: 9, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 3 }}>{label}</div>
    </div>
  );
}

/* ─── QuadCard ───────────────────────────────────────────────────────── */
function QuadCard({ type, rows, isActive, onClick }) {
  const cfg   = QUAD[type];
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const sales = rows.reduce((s, r) => s + r.sales, 0);
  const acos  = sales > 0 ? (spend / sales) * 100 : 0;
  return (
    <div onClick={() => onClick(type)} style={{
      borderRadius: 12, border: `1px solid ${isActive ? cfg.color : C.border}`,
      background: isActive ? cfg.bg : "rgba(255,255,255,0.01)",
      padding: "16px 18px", cursor: "pointer", transition: "all 0.18s ease",
      boxShadow: isActive ? `0 0 0 1px ${cfg.color}33` : "none",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: cfg.color, textTransform: "uppercase", marginBottom: 6 }}>{cfg.label}</div>
          <div style={{ fontSize: 34, fontWeight: 900, fontFamily: "DM Mono, monospace", color: C.text, lineHeight: 1 }}>{rows.length}</div>
          <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>terms</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "DM Mono, monospace", color: cfg.color }}>{fmt$(spend)}</div>
          <div style={{ fontSize: 9, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>spend</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontFamily: "DM Mono, monospace", color: C.text }}>{fmtP(acos)}</div>
          <div style={{ fontSize: 9, color: C.textSec, textTransform: "uppercase", letterSpacing: "0.08em" }}>avg acos</div>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 9, fontSize: 11, color: C.textSec, lineHeight: 1.55 }}>{cfg.action}</div>
    </div>
  );
}

/* ─── SortTable ──────────────────────────────────────────────────────── */
function SortTable({ rows, color, targetAcos }) {
  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");
  const [page,    setPage]    = useState(0);
  const PER = 10;

  useEffect(() => { setPage(0); }, [rows]);

  const sorted = useMemo(() =>
    [...rows].sort((a, b) => sortDir === "desc" ? b[sortCol] - a[sortCol] : a[sortCol] - b[sortCol]),
    [rows, sortCol, sortDir]
  );
  const paged = sorted.slice(page * PER, (page + 1) * PER);
  const pages = Math.ceil(rows.length / PER);

  const onSort = (col) => {
    if (col === sortCol) setSortDir((d) => d === "desc" ? "asc" : "desc");
    else { setSortCol(col); setSortDir("desc"); }
    setPage(0);
  };

  const TH = ({ col, label, align = "right" }) => (
    <th onClick={() => onSort(col)} style={{
      padding: "8px 12px", textAlign: align, fontSize: 10, fontWeight: 800,
      letterSpacing: "0.1em", textTransform: "uppercase",
      color: sortCol === col ? color : C.textSec,
      cursor: "pointer", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap",
    }}>
      {label} {sortCol === col ? (sortDir === "desc" ? "↓" : "↑") : <span style={{ opacity: 0.25 }}>↕</span>}
    </th>
  );

  if (!rows.length) return (
    <div style={{ padding: "24px 0", textAlign: "center", color: C.textSec, fontSize: 13 }}>No terms in this group.</div>
  );

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <TH col="term"   label="Search Term" align="left" />
              <TH col="spend"  label="Spend" />
              <TH col="sales"  label="Sales" />
              <TH col="orders" label="Orders" />
              <TH col="acos"   label="ACOS" />
              <TH col="roas"   label="ROAS" />
              <TH col="cpa"    label="CPA" />
              <TH col="clicks" label="Clicks" />
              <TH col="cvr"    label="CVR%" />
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => {
              const acosColor = r.acos >= 9999 ? C.dogs
                : r.acos <= targetAcos       ? C.qmarks
                : r.acos <= targetAcos * 1.5 ? C.stars
                : C.dogs;
              return (
                <tr key={i}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "9px 12px", color: C.text, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.term}>{r.term}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: C.text }}>{fmt$(r.spend)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: C.text }}>{fmt$(r.sales)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: C.text }}>{r.orders}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: acosColor, fontWeight: 700 }}>{fmtP(r.acos)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: (r.roas ?? 0) >= 3 ? C.qmarks : (r.roas ?? 0) >= 1 ? C.stars : C.dogs, fontWeight: 700 }}>{fmtX(r.roas)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: C.textSec }}>{(r.cpa != null && r.cpa > 0) ? fmt$(r.cpa) : "—"}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: C.textSec }}>{fmtK(r.clicks)}</td>
                  <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: "DM Mono, monospace", color: C.textSec }}>{fmtP(r.cvr)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {/* Prev */}
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: "4px 9px", borderRadius: 5, border: `1px solid ${C.border}`, background: "transparent", color: page === 0 ? C.textDim : C.textSec, cursor: page === 0 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>‹</button>

            {/* Page numbers with ellipsis */}
            {(() => {
              const delta = 1;
              const range = [];
              const rangeWithDots = [];
              for (let i = Math.max(0, page - delta); i <= Math.min(pages - 1, page + delta); i++) range.push(i);
              if (range[0] > 0) { rangeWithDots.push(0); if (range[0] > 1) rangeWithDots.push("..."); }
              rangeWithDots.push(...range);
              if (range[range.length - 1] < pages - 1) { if (range[range.length - 1] < pages - 2) rangeWithDots.push("..."); rangeWithDots.push(pages - 1); }
              return rangeWithDots.map((item, i) =>
                item === "..." ? (
                  <span key={`dot-${i}`} style={{ fontSize: 11, color: C.textDim, padding: "0 1px" }}>…</span>
                ) : (
                  <button key={item} onClick={() => setPage(item)} style={{
                    padding: "4px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700, cursor: "pointer", lineHeight: 1,
                    border: `1px solid ${item === page ? color : C.border}`,
                    background: item === page ? color : "transparent",
                    color: item === page ? "#000" : C.textSec,
                    minWidth: 28, textAlign: "center",
                  }}>{item + 1}</button>
                )
              );
            })()}

            {/* Next */}
            <button onClick={() => setPage((p) => Math.min(pages - 1, p + 1))} disabled={page === pages - 1}
              style={{ padding: "4px 9px", borderRadius: 5, border: `1px solid ${C.border}`, background: "transparent", color: page === pages - 1 ? C.textDim : C.textSec, cursor: page === pages - 1 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>›</button>
          </div>
          <div style={{ textAlign: "center", fontSize: 10, color: C.textDim, marginTop: 6 }}>
            Page {page + 1} of {pages} · {rows.length} terms
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Scatter Tooltip ────────────────────────────────────────────────── */
function ScatterTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d   = payload[0]?.payload;
  const cfg = QUAD[d?.type];
  if (!d || !cfg) return null;
  return (
    <div style={{ background: C.surface, border: `1px solid ${cfg.color}`, borderRadius: 8, padding: "10px 14px", maxWidth: 220 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: cfg.color, marginBottom: 4 }}>{cfg.label}</div>
      <div style={{ fontSize: 11, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>{d.name}</div>
      {[["Sales", fmt$(d.x)], ["ACOS", fmtP(d.y)], ["Spend", fmt$(d.spend)], ["Orders", d.orders]].map(([l, v]) => (
        <div key={l} style={{ fontSize: 10 }}>
          <span style={{ color: C.textSec }}>{l}: </span>
          <span style={{ color: C.text, fontFamily: "DM Mono, monospace", fontWeight: 600 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Lead Capture Modal ─────────────────────────────────────────────── */
function LeadModal({ leadName, setLeadName, leadEmail, setLeadEmail, onSubmit, onClose }) {
  const disabled = !leadName.trim() || !leadEmail.trim();
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(5,13,26,0.88)", backdropFilter: "blur(6px)" }}>
      <div style={{ background: C.surface, border: "1px solid rgba(245,158,11,0.3)", borderRadius: 20, padding: "36px 36px 28px", maxWidth: 420, width: "calc(100% - 40px)", boxShadow: "0 0 60px rgba(245,158,11,0.15)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 14, right: 16, background: "transparent", border: "none", color: C.textSec, cursor: "pointer", fontSize: 20, lineHeight: 1 }}>&#x2715;</button>
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, marginBottom: 10 }}>First Page Consultants</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: "0.03em", lineHeight: 1.1, marginBottom: 10 }}>
            Your report is ready.<br />
            <span style={{ color: C.accent }}>Where should we send updates?</span>
          </div>
          <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7, fontWeight: 300 }}>
            File downloads instantly. We may share Amazon PPC tips and audit insights. No spam, ever.
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textSec, marginBottom: 6 }}>Your Name</div>
            <input autoFocus type="text" value={leadName} placeholder="e.g. Sarah Johnson"
              onChange={(e) => setLeadName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              onFocus={(e) => (e.target.style.borderColor = "rgba(245,158,11,0.5)")}
              onBlur={(e)  => (e.target.style.borderColor = C.border)}
              style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", color: C.text, fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textSec, marginBottom: 6 }}>Email Address</div>
            <input type="email" value={leadEmail} placeholder="e.g. sarah@brand.com"
              onChange={(e) => setLeadEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              onFocus={(e) => (e.target.style.borderColor = "rgba(245,158,11,0.5)")}
              onBlur={(e)  => (e.target.style.borderColor = C.border)}
              style={{ width: "100%", background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px", color: C.text, fontSize: 14, fontFamily: "DM Sans, sans-serif", outline: "none" }} />
          </div>
        </div>
        <button onClick={onSubmit} disabled={disabled}
          style={{ width: "100%", padding: "13px", border: "none", borderRadius: 10, fontWeight: 800, fontSize: 14, letterSpacing: "0.05em", cursor: disabled ? "not-allowed" : "pointer", transition: "all .18s",
            background: disabled ? "rgba(245,158,11,0.25)" : "linear-gradient(135deg,#f59e0b,#d97706)",
            color: disabled ? "rgba(0,0,0,0.35)" : "#000",
            boxShadow: disabled ? "none" : "0 0 24px rgba(245,158,11,0.3)" }}>
          Download My Report
        </button>
        <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginTop: 10 }}>
          We respect your privacy. No spam, unsubscribe anytime.
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────── */
export default function App() {
  const [raw,       setRaw]       = useState(null);
  const [target,    setTarget]    = useState(35);
  const [minSpend,  setMinSpend]  = useState(1);
  const [brandName, setBrandName] = useState("");
  const [tab,       setTab]       = useState("quadrant");
  const [activeQ,   setActiveQ]   = useState("STARS");
  const [dragging,  setDragging]  = useState(false);
  const [modal,     setModal]     = useState(false);
  const [leadName,  setLeadName]  = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadDone,  setLeadDone]  = useState(false);
  const [pendingDL, setPendingDL] = useState(null); // { rows, filename }
  const fileRef = useRef();

  /* Fonts + animations + XLSX */
  useEffect(() => {
    // Add Google Fonts link
    if (!document.getElementById("fpc-fonts")) {
      const link = document.createElement("link");
      link.id   = "fpc-fonts";
      link.rel  = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600;700&display=swap";
      document.head.appendChild(link);
    }

    // Add XLSX script
    if (!document.getElementById("fpc-xlsx")) {
      const script  = document.createElement("script");
      script.id     = "fpc-xlsx";
      script.src    = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async  = true;
      document.head.appendChild(script);
    }

    // Add CSS animations
    if (!document.getElementById("fpc-styles")) {
      const style = document.createElement("style");
      style.id    = "fpc-styles";
      style.textContent = `
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.1)}}
        @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-30px,40px) scale(0.9)}}
        @keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(100vh)}}
        @keyframes pulse{0%,100%{opacity:0.5}50%{opacity:1}}
        .fu1{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) .1s both}
        .fu2{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) .22s both}
        .fu3{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) .34s both}
        .fu4{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) .46s both}
        .fu5{animation:fadeUp .7s cubic-bezier(.22,1,.36,1) .58s both}
        .fi{animation:fadeIn 1s ease .1s both}
        .hov-card:hover{transform:translateY(-3px);border-color:rgba(245,158,11,0.35)!important;transition:all .2s ease!important}
        .hov-feat:hover{transform:translateY(-2px);background:rgba(255,255,255,0.04)!important;transition:all .2s ease!important}
        .hov-cta:hover{transform:translateY(-2px);box-shadow:0 0 40px rgba(245,158,11,0.5)!important;transition:all .18s ease!important}
        .hov-drop:hover{border-color:rgba(245,158,11,0.6)!important;background:rgba(245,158,11,0.04)!important}
        .fpc-input:focus{border-color:rgba(245,158,11,0.5)!important;outline:none!important}
        *{box-sizing:border-box}
      `;
      document.head.appendChild(style);
    }
    // No cleanup — these are permanent global styles, safe to leave in DOM
  }, []);

  /* File loader — handles CSV and XLSX */
  const loadFile = useCallback((file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isCSV  = name.endsWith(".csv");
    const isXLSX = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!isCSV && !isXLSX) { alert("Please upload a .csv or .xlsx file."); return; }

    const fr = new FileReader();

    if (isCSV) {
      fr.onload = (e) => {
        try {
          const { headers, rows } = parseCSV(e.target.result);
          if (!rows.length) { alert("No data rows found. Check that this is an Amazon Search Term Report."); return; }
          setRaw({ headers, rows });
          setTab("quadrant");
          setActiveQ("STARS");
        } catch (_) {
          alert("Could not parse this file. Make sure it is an Amazon Search Term Report CSV.");
        }
      };
      fr.readAsText(file);
    }

    if (isXLSX) {
      fr.onload = (e) => {
        try {
          const XLSX = window.XLSX;
          if (!XLSX) { alert("XLSX parser is still loading. Please try again in a moment."); return; }
          const wb = XLSX.read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          // Find the header row — Amazon reports often have a summary row at the top
          const raw2d = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
          let hi = 0;
          for (let i = 0; i < Math.min(8, raw2d.length); i++) {
            const rowStr = raw2d[i].join(" ").toLowerCase();
            if (rowStr.includes("search term") || (rowStr.includes("clicks") && rowStr.includes("spend"))) {
              hi = i; break;
            }
          }
          const headers = raw2d[hi].map((h) => String(h).trim());
          const rows = raw2d.slice(hi + 1).map((row) => {
            const o = {};
            headers.forEach((h, i) => { o[h] = row[i] !== undefined ? String(row[i]) : ""; });
            return o;
          }).filter((r) => headers.some((h) => r[h] && String(r[h]).trim()));

          if (!rows.length) { alert("No data rows found. Check that this is an Amazon Search Term Report."); return; }
          setRaw({ headers, rows });
          setTab("quadrant");
          setActiveQ("STARS");
        } catch (err) {
          alert("Could not parse this XLSX file. Make sure it is an Amazon Search Term Report.");
        }
      };
      fr.readAsArrayBuffer(file);
    }
  }, []);

  /* Core analysis — recomputes when target or minSpend changes */
  const result = useMemo(() => {
    if (!raw) return null;
    return analyze(raw.rows, raw.headers, target, minSpend);
  }, [raw, target, minSpend]);

  /* Summary totals */
  const totals = useMemo(() => {
    if (!result) return null;
    const p = result.parsed;
    const spend = p.reduce((s, r) => s + r.spend, 0);
    const sales = p.reduce((s, r) => s + r.sales, 0);
    return { count: p.length, spend, sales, acos: sales > 0 ? (spend/sales)*100 : 0, orders: p.reduce((s,r)=>s+r.orders,0), waste: result.totalWaste };
  }, [result]);

  /* Brand tokens */
  const brandTokens = useMemo(() =>
    brandName.trim() ? brandName.toLowerCase().split(",").map((t) => t.trim()).filter(Boolean) : [],
    [brandName]
  );

  const isBranded = useCallback((term) =>
    brandTokens.length > 0 && brandTokens.some((t) => term.toLowerCase().includes(t)),
    [brandTokens]
  );

  /* Brand split */
  const brandSplit = useMemo(() => {
    if (!result || brandTokens.length === 0) return null;
    const branded    = result.parsed.filter((r) => isBranded(r.term));
    const nonBranded = result.parsed.filter((r) => !isBranded(r.term));
    const sum = (arr) => {
      const spend = arr.reduce((s,r) => s+r.spend, 0);
      const sales = arr.reduce((s,r) => s+r.sales, 0);
      return { spend, sales, orders: arr.reduce((s,r)=>s+r.orders,0), acos: sales>0?(spend/sales)*100:0, count: arr.length, rows: arr };
    };
    return { branded: sum(branded), nonBranded: sum(nonBranded) };
  }, [result, brandTokens, isBranded]);

  /* Downloads — gated by lead capture modal */
  const QMAP = { STARS:"Prime Movers", CASH_COWS:"Hungry Giants", QUESTION_MARKS:"Dark Horses", DOGS:"Dead Weight" };
  const today = () => new Date().toISOString().slice(0, 10);

  const requestDownload = useCallback((rows, filename) => {
    if (!rows.length) return;
    if (leadDone) { triggerDownload(buildCSV(rows), filename); return; }
    setPendingDL({ rows, filename });
    setModal(true);
  }, [leadDone]);

  const downloadFull = useCallback(() => {
    if (!result) return;
    const rows = Object.entries(result.quads).flatMap(([type, arr]) =>
      arr.map((r) => ({ ...r, quadrant: QMAP[type] + (brandName.trim() ? (isBranded(r.term) ? " - Branded" : " - Non-Branded") : "") }))
    );
    requestDownload(rows, `FPC-Full-Export-${today()}.csv`);
  }, [result, brandName, isBranded, requestDownload]);

  const downloadTab = useCallback(() => {
    if (!result) return;
    let rows = [], filename = "";
    const d = today();
    if (tab === "quadrant") {
      rows = result.quads[activeQ].map((r) => ({ ...r, quadrant: QMAP[activeQ] }));
      filename = `FPC-${QMAP[activeQ].replace(/ /g,"-")}-${d}.csv`;
    } else if (tab === "waste") {
      rows = [...result.zeroSales.map((r)=>({...r,quadrant:"Dead Weight - Zero Sales"})), ...result.highAcos.map((r)=>({...r,quadrant:"Hungry Giant - High ACOS"}))];
      filename = `FPC-Wasted-Spend-${d}.csv`;
    } else if (tab === "brand" && brandSplit) {
      rows = [...brandSplit.branded.rows.map((r)=>({...r,quadrant:"Branded"})), ...brandSplit.nonBranded.rows.map((r)=>({...r,quadrant:"Non-Branded"}))];
      filename = `FPC-Brand-Split-${d}.csv`;
    }
    requestDownload(rows, filename);
  }, [result, tab, activeQ, brandSplit, brandName, isBranded, requestDownload]);

  const handleModalSubmit = useCallback(async () => {
    if (!leadName.trim() || !leadEmail.trim()) return;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim());
    if (!emailOk) { alert("Please enter a valid email address."); return; }

    // Save lead to Supabase
    try {
      await fetch("https://todttjcnmjbrawnbvxxi.supabase.co/rest/v1/fpc_leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZHR0amNubWpicmF3bmJ2eHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTkzNzMsImV4cCI6MjA5MDc5NTM3M30.pEiXUu-QxRDWYegEYFgqfC49PBWopP7menUErpdpfDc",
          "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZHR0amNubWpicmF3bmJ2eHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTkzNzMsImV4cCI6MjA5MDc5NTM3M30.pEiXUu-QxRDWYegEYFgqfC49PBWopP7menUErpdpfDc",
          "Prefer": "return=minimal",
        },
        body: JSON.stringify({
          name:            leadName.trim(),
          email:           leadEmail.trim().toLowerCase(),
          downloaded_file: pendingDL?.filename ?? "unknown",
          source:          "Search Term Intelligence Tool",
        }),
      });
    } catch (_) {
      // Silently continue — never block the download on a network error
    }

    setLeadDone(true);
    setModal(false);
    if (pendingDL) {
      triggerDownload(buildCSV(pendingDL.rows), pendingDL.filename);
      setPendingDL(null);
    }
  }, [leadName, leadEmail, pendingDL]);

  const reset = () => { setRaw(null); setTab("quadrant"); setActiveQ("STARS"); };

  /* ─── LANDING PAGE ────────────────────────────────────────────────── */
  if (!raw) return (
    <div style={{ background: "#050d1a", minHeight: "100vh", fontFamily: "DM Sans, sans-serif", color: C.text, overflowX: "hidden" }}>
      {/* BG */}
      <div className="fi" style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(245,158,11,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.04) 1px,transparent 1px)", backgroundSize: "48px 48px" }} />
        <div style={{ position: "absolute", top: "8%", left: "10%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle,rgba(245,158,11,0.12) 0%,transparent 70%)", animation: "orb1 12s ease-in-out infinite", filter: "blur(2px)" }} />
        <div style={{ position: "absolute", bottom: "15%", right: "8%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(45,212,191,0.07) 0%,transparent 70%)", animation: "orb2 16s ease-in-out infinite", filter: "blur(4px)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(245,158,11,0.12),transparent)", animation: "scanline 8s linear infinite" }} />
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%,transparent 40%,rgba(5,13,26,0.6) 100%)" }} />
      </div>

      {/* Nav */}
      <nav className="fu1" style={{ position: "relative", zIndex: 10, padding: "16px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(245,158,11,0.1)", backdropFilter: "blur(12px)", background: "rgba(5,13,26,0.6)" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em" }}>First Page Consultants</div>
          <div style={{ fontSize: 9, color: C.textSec, letterSpacing: "0.15em", textTransform: "uppercase" }}>Amazon Advertising · Since 2013</div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <a href="https://www.firstpageconsultants.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textSec, textDecoration: "none" }}>Website ↗</a>
          <a href="https://www.firstpageconsultants.com" target="_blank" rel="noopener noreferrer" className="hov-cta" style={{ fontSize: 11, fontWeight: 700, padding: "7px 18px", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 6, color: C.accent, textDecoration: "none", transition: "all .18s" }}>Free Audit →</a>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 960, margin: "0 auto", padding: "72px 40px 0", textAlign: "center" }}>
        <div className="fu1" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 24, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", marginBottom: 28 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.accent, display: "inline-block", animation: "pulse 2s ease infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.accent, letterSpacing: "0.12em", textTransform: "uppercase" }}>Free Tool · No Login · Zero Data Upload</span>
        </div>
        <h1 className="fu2" style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(60px,10vw,108px)", fontWeight: 400, margin: "0 0 8px", lineHeight: 0.95, letterSpacing: "0.02em" }}>
          Stop Guessing.<br />
          <span style={{ WebkitTextStroke: "2px rgba(245,158,11,0.8)", color: "transparent" }}>Start Knowing.</span>
        </h1>
        <p className="fu3" style={{ fontSize: 16, color: C.textSec, maxWidth: 540, margin: "24px auto 0", lineHeight: 1.8, fontWeight: 300 }}>
          Most Amazon sellers spend <span style={{ color: C.text, fontWeight: 600 }}>hours inside spreadsheets</span> trying to figure out which search terms are working. We cut that to <span style={{ color: C.accent, fontWeight: 600 }}>under 60 seconds.</span>
        </p>
      </div>

      {/* Ticker */}
      <div className="fu3" style={{ position: "relative", zIndex: 10, margin: "48px 0 0", borderTop: "1px solid rgba(245,158,11,0.08)", borderBottom: "1px solid rgba(245,158,11,0.08)", padding: "12px 0", overflow: "hidden", background: "rgba(245,158,11,0.02)" }}>
        <div style={{ display: "flex", animation: "ticker 22s linear infinite", width: "max-content" }}>
          {[...Array(4)].flatMap(() => [["PRIME MOVERS",C.stars],["HUNGRY GIANTS",C.cows],["DARK HORSES",C.qmarks],["DEAD WEIGHT",C.dogs],["WASTED SPEND DETECTOR",C.dogs],["BRANDED vs NON-BRANDED",C.qmarks]]).map(([label, color], i) => (
            <span key={i} style={{ padding: "0 28px", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, display: "inline-block", opacity: 0.7 }} />
              {label}<span style={{ marginLeft: 16, color: "rgba(245,158,11,0.15)", fontSize: 8 }}>◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* Pain Row */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 960, margin: "0 auto", padding: "52px 40px 0" }}>
        <div className="fu3" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {[
            { pain: "2 hours of manual sorting per report", win: "Every term classified in under 60 seconds", color: C.stars },
            { pain: "Wasted spend hiding across hundreds of terms", win: "Zero-sale burn surfaced and sorted automatically", color: C.dogs },
            { pain: "Zero visibility on brand vs discovery spend", win: "Branded split with ACOS, spend, and sales side by side", color: C.qmarks },
          ].map((item, i) => (
            <div key={i} className="hov-card" style={{ background: "rgba(12,22,40,0.7)", border: "1px solid rgba(245,158,11,0.1)", borderRadius: 16, padding: "22px 20px", backdropFilter: "blur(8px)", transition: "all .2s ease" }}>
              <div style={{ fontSize: 11, color: "#f8717155", fontWeight: 700, marginBottom: 6, textDecoration: "line-through", lineHeight: 1.5 }}>{item.pain}</div>
              <div style={{ width: 20, height: 2, background: `${item.color}50`, borderRadius: 2, marginBottom: 6 }} />
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, lineHeight: 1.6 }}>{item.win}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Settings + Upload */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 560, margin: "52px auto 0", padding: "0 40px" }}>

        {/* Step 1 */}
        <div className="fu4" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, color: C.accent, flexShrink: 0 }}>1</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.08em" }}>Configure Your Settings</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(245,158,11,0.2),transparent)" }} />
        </div>

        <div className="fu4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div style={{ background: "rgba(12,22,40,0.85)", border: "1px solid rgba(245,158,11,0.18)", borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: C.accent, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke={C.accent} strokeWidth="1.2"/><circle cx="6" cy="6" r="2.5" stroke={C.accent} strokeWidth="1.2"/><circle cx="6" cy="6" r="0.8" fill={C.accent}/></svg>
              TARGET ACOS
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={target} min={1} max={200} onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))} className="fpc-input"
                style={{ flex: 1, background: "rgba(5,13,26,0.8)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8, padding: "10px 12px", color: C.accent, fontSize: 22, fontFamily: "DM Mono, monospace", fontWeight: 700, textAlign: "center", width: "100%", transition: "all .18s" }} />
              <span style={{ fontSize: 18, color: C.textSec, fontWeight: 700 }}>%</span>
            </div>
            <div style={{ fontSize: 10, color: C.textSec, marginTop: 8, lineHeight: 1.55 }}>Threshold that drives all quadrant logic.</div>
          </div>
          <div style={{ background: "rgba(12,22,40,0.85)", border: "1px solid rgba(45,212,191,0.18)", borderRadius: 14, padding: "16px 18px", backdropFilter: "blur(8px)" }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: C.qmarks, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="2.5" width="7" height="8" rx="1.2" stroke={C.qmarks} strokeWidth="1.2"/><path d="M8 5h2a1 1 0 010 2H8" stroke={C.qmarks} strokeWidth="1.2" strokeLinecap="round"/><path d="M3.5 5.5h3M3.5 7.5h2" stroke={C.qmarks} strokeWidth="1.2" strokeLinecap="round"/></svg>
              BRAND NAME
            </div>
            <input type="text" value={brandName} placeholder="e.g. ACME, acme brand" onChange={(e) => setBrandName(e.target.value)} className="fpc-input"
              style={{ width: "100%", background: "rgba(5,13,26,0.8)", border: "1px solid rgba(45,212,191,0.2)", borderRadius: 8, padding: "10px 12px", color: C.text, fontSize: 13, fontFamily: "DM Sans, sans-serif", transition: "all .18s" }} />
            <div style={{ fontSize: 10, color: C.textSec, marginTop: 8, lineHeight: 1.55 }}>Optional. Unlocks branded split tab.</div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="fu5" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, color: C.accent, flexShrink: 0 }}>2</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.08em" }}>Load Your Search Term Report</div>
          <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,rgba(245,158,11,0.2),transparent)" }} />
        </div>

        <div className="fu5 hov-drop"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current.click()}
          style={{ width: "100%", border: `1.5px dashed ${dragging ? C.accent : "rgba(245,158,11,0.25)"}`, borderRadius: 16, padding: "34px 28px", textAlign: "center", cursor: "pointer", background: dragging ? "rgba(245,158,11,0.06)" : "rgba(12,22,40,0.7)", backdropFilter: "blur(8px)", transition: "all .2s ease", marginBottom: 10 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.05em", marginBottom: 6 }}>Drop your CSV or XLSX here</div>
          <div style={{ fontSize: 12, color: C.textSec, marginBottom: 20, lineHeight: 1.75 }}>
            Seller Central → Reports → Advertising Reports<br />
            Campaign Type: <span style={{ color: C.text }}>Sponsored Products</span> → Report Type: <span style={{ color: C.text }}>Search Term</span><br />
            <span style={{ color: C.textSec, fontSize: 11 }}>Accepts .csv and .xlsx formats</span>
          </div>
          <div className="hov-cta" style={{ display: "inline-block", padding: "12px 36px", background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 8, color: "#000", fontWeight: 800, fontSize: 13, letterSpacing: "0.06em", boxShadow: "0 0 24px rgba(245,158,11,0.3)", transition: "all .18s ease" }}>
            CHOOSE FILE
          </div>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) loadFile(e.target.files[0]); }} />
        </div>
        <div className="fu5" style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 60 }}>
          Your data never leaves this browser. Nothing is uploaded or stored.
        </div>
      </div>

      {/* What You Get */}
      <div style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(245,158,11,0.08)", background: "rgba(12,22,40,0.5)", padding: "56px 40px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, marginBottom: 10 }}>What you get</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 38, fontWeight: 400, letterSpacing: "0.02em" }}>Built by PPC strategists. Not generic SaaS.</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {[
              { title: "Prime Movers",  color: C.stars,  border: "rgba(245,158,11,0.2)",   desc: "Your highest-converting, most efficient terms. The tool finds them instantly. Push bids and budget, no deliberation needed." },
              { title: "Hungry Giants", color: C.cows,   border: "rgba(167,139,250,0.2)",  desc: "Big spend, leaking margin. These terms convert but bleed above your target ACOS. You get the exact list and the bid move to make." },
              { title: "Dark Horses",   color: C.qmarks, border: "rgba(45,212,191,0.2)",   desc: "Efficient but starved of budget. Most accounts have hidden wins here that never get attention. Raise bids and give them room." },
              { title: "Dead Weight",   color: C.dogs,   border: "rgba(248,113,113,0.2)",  desc: "Every dollar burned on zero-sale terms, surfaced and sorted by spend. Cut this budget today and redeploy it to what actually works." },
            ].map((f) => (
              <div key={f.title} className="hov-feat" style={{ display: "flex", gap: 18, padding: "22px", background: "rgba(5,13,26,0.6)", border: `1px solid ${f.border}`, borderRadius: 14, transition: "all .2s ease", backdropFilter: "blur(6px)" }}>
                <div style={{ width: 44, height: 44, borderRadius: 10, background: `${f.color}10`, border: `1px solid ${f.color}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: f.color }}>{f.title.split(" ")[0][0]}</div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, letterSpacing: "0.05em", color: f.color, marginBottom: 6 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* About */}
      <div style={{ position: "relative", zIndex: 10, maxWidth: 960, margin: "0 auto", padding: "60px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: C.accent, marginBottom: 14 }}>About First Page Consultants</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 36, lineHeight: 1.05, marginBottom: 20 }}>We have been inside Amazon Ads since 2013. This is how we think.</div>
            <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.85, marginBottom: 14, fontWeight: 300 }}>We built this tool because our team was losing too much time on manual search term analysis before every audit. We automated our own thinking and are sharing it free because better tools make better sellers.</p>
            <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.85, marginBottom: 28, fontWeight: 300 }}>We manage ad spend across the US, Canada, UK, Europe, and India for 30+ brands. If you want this level of thinking applied to your full account, the first audit is on us.</p>
            <a href="https://www.firstpageconsultants.com" target="_blank" rel="noopener noreferrer" className="hov-cta"
              style={{ display: "inline-block", padding: "13px 32px", background: "linear-gradient(135deg,#f59e0b,#d97706)", borderRadius: 8, color: "#000", fontWeight: 800, fontSize: 13, textDecoration: "none", letterSpacing: "0.06em", boxShadow: "0 0 28px rgba(245,158,11,0.28)", transition: "all .18s ease" }}>
              BOOK A FREE AUDIT →
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {[["13+","Years on Amazon",C.accent],["5","Global Marketplaces",C.qmarks],["30+","Active Brands",C.cows],["∞","Terms Analyzed",C.stars]].map(([num, label, color]) => (
              <div key={label} style={{ background: "rgba(12,22,40,0.8)", border: `1px solid ${color}22`, borderRadius: 14, padding: "22px 16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 44, color, lineHeight: 1, marginBottom: 8 }}>{num}</div>
                <div style={{ fontSize: 11, color: C.textSec, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Landing Footer */}
      <div style={{ position: "relative", zIndex: 10, borderTop: "1px solid rgba(245,158,11,0.08)", padding: "18px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, background: "rgba(5,13,26,0.7)" }}>
        <div style={{ fontSize: 11, color: C.textDim }}>© First Page Consultants · Amazon Advertising Specialists</div>
        <div style={{ fontSize: 11, color: C.textDim }}>
          <a href="https://www.firstpageconsultants.com" target="_blank" rel="noopener noreferrer" style={{ color: C.accent, textDecoration: "none", fontWeight: 600 }}>firstpageconsultants.com</a> · No data stored · No login required
        </div>
      </div>
    </div>
  );

  /* ─── DASHBOARD ──────────────────────────────────────────────────── */
  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "DM Sans, sans-serif", color: C.text }}>
      {modal && <LeadModal leadName={leadName} setLeadName={setLeadName} leadEmail={leadEmail} setLeadEmail={setLeadEmail} onSubmit={handleModalSubmit} onClose={() => { setModal(false); setPendingDL(null); }} />}

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 20, gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", color: C.accent, textTransform: "uppercase" }}>First Page Consultants</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, letterSpacing: "0.05em" }}>Search Term Intelligence</div>
          </div>
          <div style={{ width: 1, height: 28, background: C.border }} />
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, color: C.textSec, display: "flex", alignItems: "center", gap: 6 }}>
              Target ACOS
              <input type="number" value={target} min={1} max={200}
                onChange={(e) => setTarget(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: 50, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", color: C.accent, fontSize: 13, fontFamily: "DM Mono, monospace", textAlign: "center", outline: "none" }} />
              <span style={{ color: C.textSec }}>%</span>
            </label>
            <label style={{ fontSize: 11, color: C.textSec, display: "flex", alignItems: "center", gap: 6 }}>
              Min Spend $
              <input type="number" value={minSpend} min={0}
                onChange={(e) => setMinSpend(Math.max(0, Number(e.target.value) || 0))}
                style={{ width: 50, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 6px", color: C.text, fontSize: 13, fontFamily: "DM Mono, monospace", textAlign: "center", outline: "none" }} />
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={downloadTab} style={{ padding: "6px 13px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, color: C.accent, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>↓ Export Tab</button>
          <button onClick={downloadFull} style={{ padding: "6px 13px", background: C.accent, border: "none", borderRadius: 6, color: "#000", cursor: "pointer", fontSize: 11, fontWeight: 800 }}>↓ Full Export</button>
          <button onClick={reset} style={{ padding: "6px 14px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 6, color: C.textSec, cursor: "pointer", fontSize: 11, fontWeight: 600 }}>← New Report</button>
        </div>
      </div>

      {/* Summary Strip */}
      <div style={{ display: "flex", gap: 1, background: C.border, borderBottom: `1px solid ${C.border}` }}>
        <Pill label="Terms"        value={fmtK(totals.count)}   color={C.text} />
        <Pill label="Total Spend"  value={fmt$(totals.spend)}   color={C.text} />
        <Pill label="Total Sales"  value={fmt$(totals.sales)}   color={C.qmarks} />
        <Pill label="Overall ACOS" value={fmtP(totals.acos)}    color={totals.acos <= target ? C.qmarks : C.dogs} />
        <Pill label="Orders"       value={fmtK(totals.orders)}  color={C.text} />
        <Pill label="Dead Weight"  value={fmt$(totals.waste)}   color={C.dogs} />
      </div>

      {/* Tabs */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 20px", display: "flex" }}>
        {[["quadrant","📊  Quadrant Analysis"],["waste","💸  Wasted Spend"],["brand", brandName.trim() ? "🏷️  Branded vs Non-Branded" : "🏷️  Branded vs Non-Branded  (enter brand name in settings to unlock)"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: "12px 16px", background: "transparent", border: "none",
            borderBottom: `2px solid ${tab === id ? C.accent : "transparent"}`,
            color: tab === id ? C.accent : (id === "brand" && !brandName.trim()) ? C.textDim : C.textSec,
            cursor: "pointer", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
          }}>{label}</button>
        ))}
      </div>

      <div style={{ padding: "18px 20px" }}>

        {/* ── Quadrant Tab ── */}
        {tab === "quadrant" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
              {Object.entries(result.quads).map(([type, rows]) => (
                <QuadCard key={type} type={type} rows={rows} isActive={activeQ === type} onClick={setActiveQ} />
              ))}
            </div>

            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "18px 18px 10px", marginBottom: 18 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, letterSpacing: "0.04em", marginBottom: 3 }}>Sales vs ACOS Map</div>
              <div style={{ fontSize: 11, color: C.textSec, marginBottom: 14 }}>Each dot is one search term. Dashed line = your target ACOS ({target}%). Right and below = better performance.</div>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 26, left: 8 }}>
                  <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
                  <XAxis dataKey="x" type="number" name="Sales" tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v}`} tick={{ fill: C.textSec, fontSize: 10 }} label={{ value: "Sales ($)", position: "insideBottom", offset: -14, fill: C.textSec, fontSize: 10 }} />
                  <YAxis dataKey="y" type="number" name="ACOS" domain={[0, Math.min(250, target * 5)]} tickFormatter={(v) => `${v}%`} tick={{ fill: C.textSec, fontSize: 10 }} label={{ value: "ACOS %", angle: -90, position: "insideLeft", offset: 10, fill: C.textSec, fontSize: 10 }} />
                  <ReferenceLine y={target} stroke={C.accent} strokeDasharray="5 3" label={{ value: `Target ${target}%`, fill: C.accent, fontSize: 10, position: "insideTopRight" }} />
                  <Tooltip content={<ScatterTip />} />
                  {Object.entries(result.quads).map(([type, rows]) => (
                    <Scatter key={type} data={rows.filter((r) => r.acos < 300 && r.sales > 0).map((r) => ({ x: r.sales, y: r.acos, name: r.term, type, spend: r.spend, orders: r.orders }))} fill={QUAD[type].color} opacity={0.75} r={4} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 4 }}>
                {Object.entries(QUAD).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.textSec }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: v.color }} />{v.label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${QUAD[activeQ].color}40`, padding: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: QUAD[activeQ].color, letterSpacing: "0.04em" }}>{QUAD[activeQ].label}</div>
                <div style={{ fontSize: 11, color: C.textSec }}>{result.quads[activeQ].length} terms · click headers to sort</div>
              </div>
              <SortTable key={activeQ} rows={result.quads[activeQ]} color={QUAD[activeQ].color} targetAcos={target} />
            </div>
          </div>
        )}

        {/* ── Waste Tab ── */}
        {tab === "waste" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
              {[
                { label: "Dead Weight Spend",  value: fmt$(result.totalWaste),                                    sub: `${result.zeroSales.length} terms burned budget with zero conversions`,    color: C.dogs,   bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)" },
                { label: "Hungry Giant Bleed", value: fmt$(Math.max(0, result.highAcosWaste)),                    sub: `${result.highAcos.length} terms converting but leaking above target ACOS`, color: C.stars,  bg: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.25)"  },
                { label: "Total Recoverable",  value: fmt$(result.totalWaste + Math.max(0, result.highAcosWaste)),sub: "Shift this to Prime Movers and Dark Horses",                               color: C.qmarks, bg: "rgba(45,212,191,0.07)",  border: "rgba(45,212,191,0.25)"  },
              ].map((card) => (
                <div key={card.label} style={{ padding: "20px 22px", borderRadius: 12, background: card.bg, border: `1px solid ${card.border}` }}>
                  <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "DM Mono, monospace", color: card.color, marginBottom: 4 }}>{card.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: card.color, marginBottom: 5 }}>{card.label}</div>
                  <div style={{ fontSize: 11, color: C.textSec, lineHeight: 1.55 }}>{card.sub}</div>
                </div>
              ))}
            </div>
            <div style={{ background: C.card, borderRadius: 12, border: "1px solid rgba(248,113,113,0.25)", padding: 18, marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: C.dogs, marginBottom: 4, letterSpacing: "0.04em" }}>Dead Weight Terms</div>
              <div style={{ fontSize: 11, color: C.textSec, marginBottom: 12 }}>Spent budget, returned nothing. Negate in exact match across every campaign today.</div>
              <SortTable key="zero" rows={result.zeroSales} color={C.dogs} targetAcos={target} />
            </div>
            <div style={{ background: C.card, borderRadius: 12, border: "1px solid rgba(167,139,250,0.25)", padding: 18 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: C.cows, marginBottom: 4, letterSpacing: "0.04em" }}>Hungry Giants Bleeding Margin</div>
              <div style={{ fontSize: 11, color: C.textSec, marginBottom: 12 }}>Converting but above 1.5x your target ACOS. Reduce bids 15-25% and reassess in two weeks.</div>
              <SortTable key="high" rows={result.highAcos} color={C.cows} targetAcos={target} />
            </div>
          </div>
        )}

        {/* ── Brand Tab ── */}
        {tab === "brand" && (
          <div>
            {!brandName.trim() ? (
              <div style={{ textAlign: "center", padding: "60px 24px" }}>
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 22, marginBottom: 10 }}>Brand Name Not Set</div>
                <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7, maxWidth: 340, margin: "0 auto" }}>Enter your brand name in the header settings above. Separate multiple names with commas (e.g. duradry, dr g).</div>
              </div>
            ) : !brandSplit ? (
              <div style={{ textAlign: "center", padding: "40px", color: C.textSec }}>Loading brand data...</div>
            ) : (() => {
              const { branded, nonBranded } = brandSplit;
              const ts = branded.spend + nonBranded.spend;
              const tsl = branded.sales + nonBranded.sales;
              const bSp = ts > 0 ? Math.round(branded.spend / ts * 100) : 0;
              const bSa = tsl > 0 ? Math.round(branded.sales / tsl * 100) : 0;
              return (
                <div>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 14 }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, marginBottom: 14, letterSpacing: "0.04em" }}>
                      Brand split for: <span style={{ color: C.accent }}>{brandName}</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                      {[["Terms", branded.count, nonBranded.count, (v)=>v], ["Spend", branded.spend, nonBranded.spend, fmt$], ["Sales", branded.sales, nonBranded.sales, fmt$], ["ACOS", branded.acos, nonBranded.acos, fmtP]].map(([label, b, nb, fn]) => (
                        <div key={label} style={{ background: "rgba(5,13,26,0.5)", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", textAlign: "center" }}>
                          <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textSec, marginBottom: 8 }}>{label}</div>
                          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                            <div><div style={{ fontSize: 16, fontWeight: 900, fontFamily: "DM Mono, monospace", color: C.accent }}>{fn(b)}</div><div style={{ fontSize: 9, color: C.textSec, marginTop: 2 }}>Branded</div></div>
                            <div style={{ width: 1, height: 32, background: C.border }} />
                            <div><div style={{ fontSize: 16, fontWeight: 900, fontFamily: "DM Mono, monospace", color: C.qmarks }}>{fn(nb)}</div><div style={{ fontSize: 9, color: C.textSec, marginTop: 2 }}>Non-Brand</div></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {[["Spend Share", bSp, 100-bSp, fmt$(branded.spend), fmt$(nonBranded.spend)], ["Sales Share", bSa, 100-bSa, fmt$(branded.sales), fmt$(nonBranded.sales)]].map(([title, bp, nbp, bv, nbv]) => (
                    <div key={title} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: "16px 18px", marginBottom: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.12em", color: C.textSec, marginBottom: 10 }}>{title}</div>
                      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 26, marginBottom: 8 }}>
                        <div style={{ width: `${bp}%`, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#000", minWidth: bp > 8 ? 0 : "auto" }}>{bp > 8 ? `${bp}%` : ""}</div>
                        <div style={{ width: `${nbp}%`, background: C.qmarks, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#000" }}>{nbp > 8 ? `${nbp}%` : ""}</div>
                      </div>
                      <div style={{ display: "flex", gap: 20, fontSize: 11 }}>
                        <div><span style={{ color: C.accent }}>■</span> <span style={{ color: C.textSec }}>Branded </span><span style={{ fontFamily: "DM Mono, monospace", color: C.text }}>{bp}% · {bv}</span></div>
                        <div><span style={{ color: C.qmarks }}>■</span> <span style={{ color: C.textSec }}>Non-Branded </span><span style={{ fontFamily: "DM Mono, monospace", color: C.text }}>{nbp}% · {nbv}</span></div>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ background: C.card, borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: C.accent, letterSpacing: "0.04em" }}>Branded Terms</div>
                        <div style={{ fontSize: 11, color: C.textSec }}>· {branded.rows.length} terms</div>
                      </div>
                      <div style={{ fontSize: 11, color: C.textSec, marginBottom: 12 }}>Defense spend. Protect your name. Watch ACOS here — branded terms inflate overall efficiency scores.</div>
                      <SortTable key="br" rows={branded.rows} color={C.accent} targetAcos={target} />
                    </div>
                    <div style={{ background: C.card, borderRadius: 12, border: "1px solid rgba(45,212,191,0.3)", padding: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 16, color: C.qmarks, letterSpacing: "0.04em" }}>Non-Branded Terms</div>
                        <div style={{ fontSize: 11, color: C.textSec }}>· {nonBranded.rows.length} terms</div>
                      </div>
                      <div style={{ fontSize: 11, color: C.textSec, marginBottom: 12 }}>Your growth engine. These terms bring in new customers. Higher ACOS here is expected and normal.</div>
                      <SortTable key="nb" rows={nonBranded.rows} color={C.qmarks} targetAcos={target} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>

      {/* Dashboard Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, background: C.surface, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 11, color: C.textSec }}><span style={{ color: C.accent, fontWeight: 700 }}>First Page Consultants</span> — Amazon advertising specialists since 2013.</div>
        <a href="https://www.firstpageconsultants.com" target="_blank" rel="noopener noreferrer"
          style={{ padding: "8px 20px", background: C.accent, borderRadius: 6, color: "#000", fontWeight: 800, fontSize: 11, textDecoration: "none", letterSpacing: "0.04em" }}>
          Get a Free Account Audit →
        </a>
      </div>
    </div>
  );
}
