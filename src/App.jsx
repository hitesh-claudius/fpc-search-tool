import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  parseCSV,
  analyze,
  fmt$,
  fmtP,
  fmtK,
  fmtX,
  buildCSV,
  triggerDownload,
  QUAD,
  QMAP,
} from "./lib/data.js";
import { cn } from "./lib/utils.js";
import {
  Upload,
  Download,
  ArrowLeft,
  Target,
  Tag,
  BarChart3,
  AlertTriangle,
  TrendingUp,
  Zap,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Crosshair,
  FileSpreadsheet,
} from "lucide-react";

/* ─── Pill ───────────────────────────────────────────────────────────── */
function Pill({ label, value, color }) {
  return (
    <div className="flex-1 min-w-[100px] px-4 py-3.5 bg-surface-card text-center">
      <div
        className="text-lg font-extrabold font-mono tracking-tight"
        style={{ color }}
      >
        {value}
      </div>
      <div className="text-[9px] text-text-secondary uppercase tracking-widest mt-0.5">
        {label}
      </div>
    </div>
  );
}

/* ─── QuadCard ───────────────────────────────────────────────────────── */
function QuadCard({ type, rows, isActive, onClick }) {
  const cfg = QUAD[type];
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  const sales = rows.reduce((s, r) => s + r.sales, 0);
  const acos = sales > 0 ? (spend / sales) * 100 : 0;

  return (
    <div
      onClick={() => onClick(type)}
      className={cn(
        "rounded-xl border p-4 cursor-pointer transition-all duration-200 ease-out",
        isActive
          ? cn(cfg.bgClass, cfg.borderClass, "shadow-[0_0_0_1px_var(--tw-shadow-color)]")
          : "bg-white/[0.01] border-border"
      )}
      style={isActive ? { "--tw-shadow-color": `${cfg.color}33` } : undefined}
    >
      <div className="flex justify-between items-start mb-2.5">
        <div>
          <div
            className="text-[9px] font-extrabold tracking-[0.18em] uppercase mb-1.5"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </div>
          <div className="text-[34px] font-black font-mono text-text leading-none">
            {rows.length}
          </div>
          <div className="text-[10px] text-text-secondary mt-0.5">terms</div>
        </div>
        <div className="text-right">
          <div
            className="text-base font-bold font-mono"
            style={{ color: cfg.color }}
          >
            {fmt$(spend)}
          </div>
          <div className="text-[9px] text-text-secondary uppercase tracking-wider mb-1.5">
            spend
          </div>
          <div className="text-[13px] font-bold font-mono text-text">
            {fmtP(acos)}
          </div>
          <div className="text-[9px] text-text-secondary uppercase tracking-wider">
            avg acos
          </div>
        </div>
      </div>
      <div className="border-t border-border pt-2 text-[11px] text-text-secondary leading-relaxed">
        {cfg.action}
      </div>
    </div>
  );
}

/* ─── SortTable ──────────────────────────────────────────────────────── */
function SortTable({ rows, color, targetAcos }) {
  const [sortCol, setSortCol] = useState("spend");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(0);
  const PER = 10;

  useEffect(() => {
    setPage(0);
  }, [rows]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) =>
        sortDir === "desc" ? b[sortCol] - a[sortCol] : a[sortCol] - b[sortCol]
      ),
    [rows, sortCol, sortDir]
  );
  const paged = sorted.slice(page * PER, (page + 1) * PER);
  const pages = Math.ceil(rows.length / PER);

  const onSort = (col) => {
    if (col === sortCol) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortCol(col);
      setSortDir("desc");
    }
    setPage(0);
  };

  const TH = ({ col, label, align = "right" }) => (
    <th
      onClick={() => onSort(col)}
      className={cn(
        "px-3 py-2 text-[10px] font-extrabold tracking-widest uppercase cursor-pointer border-b border-border whitespace-nowrap",
        align === "left" ? "text-left" : "text-right"
      )}
      style={{ color: sortCol === col ? color : undefined }}
    >
      <span className={sortCol !== col ? "text-text-secondary" : undefined}>
        {label}{" "}
        {sortCol === col ? (
          sortDir === "desc" ? (
            "\u2193"
          ) : (
            "\u2191"
          )
        ) : (
          <span className="opacity-25">{"\u2195"}</span>
        )}
      </span>
    </th>
  );

  if (!rows.length)
    return (
      <div className="py-6 text-center text-text-secondary text-[13px]">
        No terms in this group.
      </div>
    );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <TH col="term" label="Search Term" align="left" />
              <TH col="spend" label="Spend" />
              <TH col="sales" label="Sales" />
              <TH col="orders" label="Orders" />
              <TH col="acos" label="ACOS" />
              <TH col="roas" label="ROAS" />
              <TH col="cpa" label="CPA" />
              <TH col="clicks" label="Clicks" />
              <TH col="cvr" label="CVR%" />
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => {
              const acosColor =
                r.acos >= 9999
                  ? "#f87171"
                  : r.acos <= targetAcos
                  ? "#2dd4bf"
                  : r.acos <= targetAcos * 1.5
                  ? "#f59e0b"
                  : "#f87171";
              const roasColor =
                (r.roas ?? 0) >= 3
                  ? "#2dd4bf"
                  : (r.roas ?? 0) >= 1
                  ? "#f59e0b"
                  : "#f87171";
              return (
                <tr
                  key={i}
                  className="border-b border-border hover:bg-white/[0.03] transition-colors"
                >
                  <td
                    className="px-3 py-2.5 text-text max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap"
                    title={r.term}
                  >
                    {r.term}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text tabular-nums">
                    {fmt$(r.spend)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text tabular-nums">
                    {fmt$(r.sales)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text tabular-nums">
                    {r.orders}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-mono font-bold tabular-nums"
                    style={{ color: acosColor }}
                  >
                    {fmtP(r.acos)}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right font-mono font-bold tabular-nums"
                    style={{ color: roasColor }}
                  >
                    {fmtX(r.roas)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-secondary tabular-nums">
                    {r.cpa != null && r.cpa > 0 ? fmt$(r.cpa) : "\u2014"}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-secondary tabular-nums">
                    {fmtK(r.clicks)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-text-secondary tabular-nums">
                    {fmtP(r.cvr)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3.5">
          <div className="flex justify-center items-center gap-1 flex-wrap">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className={cn(
                "px-2.5 py-1 rounded-md border border-border bg-transparent text-xs font-bold leading-none",
                page === 0
                  ? "text-text-dim cursor-not-allowed"
                  : "text-text-secondary cursor-pointer"
              )}
            >
              <ChevronLeft className="w-3.5 h-3.5 inline" />
            </button>

            {(() => {
              const delta = 1;
              const range = [];
              const rangeWithDots = [];
              for (
                let i = Math.max(0, page - delta);
                i <= Math.min(pages - 1, page + delta);
                i++
              )
                range.push(i);
              if (range[0] > 0) {
                rangeWithDots.push(0);
                if (range[0] > 1) rangeWithDots.push("...");
              }
              rangeWithDots.push(...range);
              if (range[range.length - 1] < pages - 1) {
                if (range[range.length - 1] < pages - 2)
                  rangeWithDots.push("...");
                rangeWithDots.push(pages - 1);
              }
              return rangeWithDots.map((item, i) =>
                item === "..." ? (
                  <span
                    key={`dot-${i}`}
                    className="text-[11px] text-text-dim px-0.5"
                  >
                    {"\u2026"}
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={cn(
                      "px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer leading-none min-w-[28px] text-center border",
                      item === page
                        ? "text-black"
                        : "bg-transparent text-text-secondary border-border"
                    )}
                    style={
                      item === page
                        ? { background: color, borderColor: color }
                        : undefined
                    }
                  >
                    {item + 1}
                  </button>
                )
              );
            })()}

            <button
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              disabled={page === pages - 1}
              className={cn(
                "px-2.5 py-1 rounded-md border border-border bg-transparent text-xs font-bold leading-none",
                page === pages - 1
                  ? "text-text-dim cursor-not-allowed"
                  : "text-text-secondary cursor-pointer"
              )}
            >
              <ChevronRight className="w-3.5 h-3.5 inline" />
            </button>
          </div>
          <div className="text-center text-[10px] text-text-dim mt-1.5">
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
  const d = payload[0]?.payload;
  const cfg = QUAD[d?.type];
  if (!d || !cfg) return null;
  return (
    <div
      className="bg-surface rounded-lg p-2.5 px-3.5 max-w-[220px]"
      style={{ border: `1px solid ${cfg.color}` }}
    >
      <div
        className="text-[10px] font-extrabold mb-1"
        style={{ color: cfg.color }}
      >
        {cfg.label}
      </div>
      <div className="text-[11px] text-text mb-1.5 leading-snug">{d.name}</div>
      {[
        ["Sales", fmt$(d.x)],
        ["ACOS", fmtP(d.y)],
        ["Spend", fmt$(d.spend)],
        ["Orders", d.orders],
      ].map(([l, v]) => (
        <div key={l} className="text-[10px]">
          <span className="text-text-secondary">{l}: </span>
          <span className="text-text font-mono font-semibold">{v}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Lead Capture Modal ─────────────────────────────────────────────── */
function LeadModal({
  leadName,
  setLeadName,
  leadEmail,
  setLeadEmail,
  onSubmit,
  onClose,
}) {
  const disabled = !leadName.trim() || !leadEmail.trim();
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(5,13,26,0.88)] backdrop-blur-md">
      <div className="bg-surface border border-accent/30 rounded-[20px] p-9 pb-7 max-w-[420px] w-[calc(100%-40px)] shadow-[0_0_60px_rgba(245,158,11,0.15)] relative">
        <button
          onClick={onClose}
          className="absolute top-3.5 right-4 bg-transparent border-none text-text-secondary cursor-pointer text-xl leading-none hover:text-text transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="mb-5">
          <div className="text-[9px] font-extrabold tracking-[0.2em] uppercase text-accent mb-2.5">
            First Page Consultants
          </div>
          <div className="font-heading text-[28px] tracking-wide leading-tight mb-2.5">
            Your report is ready.
            <br />
            <span className="text-accent">
              Where should we send updates?
            </span>
          </div>
          <div className="text-[13px] text-text-secondary leading-relaxed font-light">
            File downloads instantly. We may share Amazon PPC tips and audit
            insights. No spam, ever.
          </div>
        </div>
        <div className="flex flex-col gap-3 mb-4">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-text-secondary mb-1.5">
              Your Name
            </div>
            <input
              autoFocus
              type="text"
              value={leadName}
              placeholder="e.g. Sarah Johnson"
              onChange={(e) => setLeadName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              className="w-full bg-surface-card border border-border rounded-lg px-3.5 py-2.5 text-text text-sm font-body outline-none fpc-input"
            />
          </div>
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-text-secondary mb-1.5">
              Email Address
            </div>
            <input
              type="email"
              value={leadEmail}
              placeholder="e.g. sarah@brand.com"
              onChange={(e) => setLeadEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSubmit()}
              className="w-full bg-surface-card border border-border rounded-lg px-3.5 py-2.5 text-text text-sm font-body outline-none fpc-input"
            />
          </div>
        </div>
        <button
          onClick={onSubmit}
          disabled={disabled}
          className={cn(
            "w-full py-3.5 border-none rounded-[10px] font-extrabold text-sm tracking-wide transition-all duration-200",
            disabled
              ? "bg-accent/25 text-black/35 cursor-not-allowed"
              : "bg-gradient-to-br from-accent to-accent-hover text-black cursor-pointer shadow-[0_0_24px_rgba(245,158,11,0.3)] cta-hover"
          )}
        >
          Download My Report
        </button>
        <div className="text-[11px] text-text-dim text-center mt-2.5">
          We respect your privacy. No spam, unsubscribe anytime.
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ───────────────────────────────────────────────────────── */
export default function App() {
  const [raw, setRaw] = useState(null);
  const [target, setTarget] = useState(35);
  const [minSpend, setMinSpend] = useState(1);
  const [brandName, setBrandName] = useState("");
  const [tab, setTab] = useState("quadrant");
  const [activeQ, setActiveQ] = useState("STARS");
  const [dragging, setDragging] = useState(false);
  const [modal, setModal] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadDone, setLeadDone] = useState(false);
  const [pendingDL, setPendingDL] = useState(null);
  const fileRef = useRef();

  /* XLSX script loading */
  useEffect(() => {
    if (!document.getElementById("fpc-xlsx")) {
      const script = document.createElement("script");
      script.id = "fpc-xlsx";
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  /* File loader — handles CSV and XLSX */
  const loadFile = useCallback((file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isCSV = name.endsWith(".csv");
    const isXLSX = name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!isCSV && !isXLSX) {
      alert("Please upload a .csv or .xlsx file.");
      return;
    }

    const fr = new FileReader();

    if (isCSV) {
      fr.onload = (e) => {
        try {
          const { headers, rows } = parseCSV(e.target.result);
          if (!rows.length) {
            alert(
              "No data rows found. Check that this is an Amazon Search Term Report."
            );
            return;
          }
          setRaw({ headers, rows });
          setTab("quadrant");
          setActiveQ("STARS");
        } catch (_) {
          alert(
            "Could not parse this file. Make sure it is an Amazon Search Term Report CSV."
          );
        }
      };
      fr.readAsText(file);
    }

    if (isXLSX) {
      fr.onload = (e) => {
        try {
          const XLSX = window.XLSX;
          if (!XLSX) {
            alert(
              "XLSX parser is still loading. Please try again in a moment."
            );
            return;
          }
          const wb = XLSX.read(e.target.result, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const raw2d = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: "",
          });
          let hi = 0;
          for (let i = 0; i < Math.min(8, raw2d.length); i++) {
            const rowStr = raw2d[i].join(" ").toLowerCase();
            if (
              rowStr.includes("search term") ||
              (rowStr.includes("clicks") && rowStr.includes("spend"))
            ) {
              hi = i;
              break;
            }
          }
          const headers = raw2d[hi].map((h) => String(h).trim());
          const rows = raw2d
            .slice(hi + 1)
            .map((row) => {
              const o = {};
              headers.forEach((h, i) => {
                o[h] = row[i] !== undefined ? String(row[i]) : "";
              });
              return o;
            })
            .filter((r) =>
              headers.some((h) => r[h] && String(r[h]).trim())
            );

          if (!rows.length) {
            alert(
              "No data rows found. Check that this is an Amazon Search Term Report."
            );
            return;
          }
          setRaw({ headers, rows });
          setTab("quadrant");
          setActiveQ("STARS");
        } catch (err) {
          alert(
            "Could not parse this XLSX file. Make sure it is an Amazon Search Term Report."
          );
        }
      };
      fr.readAsArrayBuffer(file);
    }
  }, []);

  /* Core analysis */
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
    return {
      count: p.length,
      spend,
      sales,
      acos: sales > 0 ? (spend / sales) * 100 : 0,
      orders: p.reduce((s, r) => s + r.orders, 0),
      waste: result.totalWaste,
    };
  }, [result]);

  /* Brand tokens */
  const brandTokens = useMemo(
    () =>
      brandName.trim()
        ? brandName
            .toLowerCase()
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
    [brandName]
  );

  const isBranded = useCallback(
    (term) =>
      brandTokens.length > 0 &&
      brandTokens.some((t) => term.toLowerCase().includes(t)),
    [brandTokens]
  );

  /* Brand split */
  const brandSplit = useMemo(() => {
    if (!result || brandTokens.length === 0) return null;
    const branded = result.parsed.filter((r) => isBranded(r.term));
    const nonBranded = result.parsed.filter((r) => !isBranded(r.term));
    const sum = (arr) => {
      const spend = arr.reduce((s, r) => s + r.spend, 0);
      const sales = arr.reduce((s, r) => s + r.sales, 0);
      return {
        spend,
        sales,
        orders: arr.reduce((s, r) => s + r.orders, 0),
        acos: sales > 0 ? (spend / sales) * 100 : 0,
        count: arr.length,
        rows: arr,
      };
    };
    return { branded: sum(branded), nonBranded: sum(nonBranded) };
  }, [result, brandTokens, isBranded]);

  /* Downloads — gated by lead capture modal */
  const today = () => new Date().toISOString().slice(0, 10);

  const requestDownload = useCallback(
    (rows, filename) => {
      if (!rows.length) return;
      if (leadDone) {
        triggerDownload(buildCSV(rows), filename);
        return;
      }
      setPendingDL({ rows, filename });
      setModal(true);
    },
    [leadDone]
  );

  const downloadFull = useCallback(() => {
    if (!result) return;
    const rows = Object.entries(result.quads).flatMap(([type, arr]) =>
      arr.map((r) => ({
        ...r,
        quadrant:
          QMAP[type] +
          (brandName.trim()
            ? isBranded(r.term)
              ? " - Branded"
              : " - Non-Branded"
            : ""),
      }))
    );
    requestDownload(rows, `FPC-Full-Export-${today()}.csv`);
  }, [result, brandName, isBranded, requestDownload]);

  const downloadTab = useCallback(() => {
    if (!result) return;
    let rows = [],
      filename = "";
    const d = today();
    if (tab === "quadrant") {
      rows = result.quads[activeQ].map((r) => ({
        ...r,
        quadrant: QMAP[activeQ],
      }));
      filename = `FPC-${QMAP[activeQ].replace(/ /g, "-")}-${d}.csv`;
    } else if (tab === "waste") {
      rows = [
        ...result.zeroSales.map((r) => ({
          ...r,
          quadrant: "Dead Weight - Zero Sales",
        })),
        ...result.highAcos.map((r) => ({
          ...r,
          quadrant: "Hungry Giant - High ACOS",
        })),
      ];
      filename = `FPC-Wasted-Spend-${d}.csv`;
    } else if (tab === "brand" && brandSplit) {
      rows = [
        ...brandSplit.branded.rows.map((r) => ({
          ...r,
          quadrant: "Branded",
        })),
        ...brandSplit.nonBranded.rows.map((r) => ({
          ...r,
          quadrant: "Non-Branded",
        })),
      ];
      filename = `FPC-Brand-Split-${d}.csv`;
    }
    requestDownload(rows, filename);
  }, [result, tab, activeQ, brandSplit, brandName, isBranded, requestDownload]);

  const handleModalSubmit = useCallback(async () => {
    if (!leadName.trim() || !leadEmail.trim()) return;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail.trim());
    if (!emailOk) {
      alert("Please enter a valid email address.");
      return;
    }

    try {
      await fetch(
        "https://todttjcnmjbrawnbvxxi.supabase.co/rest/v1/fpc_leads",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZHR0amNubWpicmF3bmJ2eHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTkzNzMsImV4cCI6MjA5MDc5NTM3M30.pEiXUu-QxRDWYegEYFgqfC49PBWopP7menUErpdpfDc",
            Authorization:
              "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvZHR0amNubWpicmF3bmJ2eHhpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMTkzNzMsImV4cCI6MjA5MDc5NTM3M30.pEiXUu-QxRDWYegEYFgqfC49PBWopP7menUErpdpfDc",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            name: leadName.trim(),
            email: leadEmail.trim().toLowerCase(),
            downloaded_file: pendingDL?.filename ?? "unknown",
            source: "Search Term Intelligence Tool",
          }),
        }
      );
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

  const reset = () => {
    setRaw(null);
    setTab("quadrant");
    setActiveQ("STARS");
  };

  /* ─── LANDING PAGE ────────────────────────────────────────────────── */
  if (!raw)
    return (
      <div className="bg-bg-base min-h-screen font-body text-text overflow-x-hidden">
        {/* BG */}
        <div className="animate-fade-in fixed inset-0 z-0 pointer-events-none overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(245,158,11,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.04) 1px,transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="absolute top-[8%] left-[10%] w-[420px] h-[420px] rounded-full animate-orb1 blur-sm bg-[radial-gradient(circle,rgba(245,158,11,0.12)_0%,transparent_70%)]" />
          <div className="absolute bottom-[15%] right-[8%] w-[500px] h-[500px] rounded-full animate-orb2 blur-md bg-[radial-gradient(circle,rgba(45,212,191,0.07)_0%,transparent_70%)]" />
          <div
            className="absolute left-0 right-0 h-px animate-scanline"
            style={{
              background:
                "linear-gradient(90deg,transparent,rgba(245,158,11,0.12),transparent)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_40%,rgba(5,13,26,0.6)_100%)]" />
        </div>

        {/* Nav */}
        <nav className="animate-fade-up-1 relative z-10 px-10 py-4 flex justify-between items-center border-b border-accent/10 backdrop-blur-xl bg-[rgba(5,13,26,0.6)]">
          <div>
            <div className="text-[13px] font-bold tracking-wide">
              First Page Consultants
            </div>
            <div className="text-[9px] text-text-secondary tracking-[0.15em] uppercase">
              Amazon Advertising · Since 2016
            </div>
          </div>
          <div className="flex gap-5 items-center">
            <a
              href="https://www.firstpageconsultants.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-secondary no-underline hover:text-text transition-colors flex items-center gap-1"
            >
              Website <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="https://www.firstpageconsultants.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold px-4 py-1.5 border border-accent/40 rounded-md text-accent no-underline cta-hover"
            >
              Free Audit <ArrowLeft className="w-3 h-3 inline rotate-180" />
            </a>
          </div>
        </nav>

        {/* Hero */}
        <div className="relative z-10 max-w-[960px] mx-auto px-10 pt-[72px] text-center">
          <div className="animate-fade-up-1 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/[0.08] border border-accent/20 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block animate-pulse" />
            <span className="text-[11px] font-bold text-accent tracking-[0.12em] uppercase">
              Free Tool · No Login · Zero Data Upload
            </span>
          </div>
          <h1 className="animate-fade-up-2 font-heading text-[clamp(60px,10vw,108px)] font-normal m-0 mb-2 leading-[0.95] tracking-wide">
            Stop Guessing.
            <br />
            <span className="text-transparent" style={{ WebkitTextStroke: "2px rgba(245,158,11,0.8)" }}>
              Start Knowing.
            </span>
          </h1>
          <p className="animate-fade-up-3 text-base text-text-secondary max-w-[540px] mx-auto mt-6 leading-relaxed font-light">
            Most Amazon sellers spend{" "}
            <span className="text-text font-semibold">
              hours inside spreadsheets
            </span>{" "}
            trying to figure out which search terms are working. We cut that to{" "}
            <span className="text-accent font-semibold">under 60 seconds.</span>
          </p>
        </div>

        {/* Ticker */}
        <div className="animate-fade-up-3 relative z-10 mt-12 border-t border-b border-accent/[0.08] py-3 overflow-hidden bg-accent/[0.02]">
          <div className="flex animate-ticker w-max">
            {[...Array(4)]
              .flatMap(() => [
                ["PRIME MOVERS", "#f59e0b"],
                ["HUNGRY GIANTS", "#a78bfa"],
                ["DARK HORSES", "#2dd4bf"],
                ["DEAD WEIGHT", "#f87171"],
                ["WASTED SPEND DETECTOR", "#f87171"],
                ["BRANDED vs NON-BRANDED", "#2dd4bf"],
              ])
              .map(([label, color], i) => (
                <span
                  key={i}
                  className="px-7 text-[11px] font-extrabold tracking-[0.14em] whitespace-nowrap inline-flex items-center gap-2.5"
                  style={{ color }}
                >
                  <span
                    className="w-[5px] h-[5px] rounded-full inline-block opacity-70"
                    style={{ background: color }}
                  />
                  {label}
                  <span className="ml-4 text-accent/15 text-[8px]">
                    {"\u25C6"}
                  </span>
                </span>
              ))}
          </div>
        </div>

        {/* Pain Row */}
        <div className="relative z-10 max-w-[960px] mx-auto px-10 pt-[52px]">
          <div className="animate-fade-up-3 grid grid-cols-3 gap-3.5">
            {[
              {
                pain: "2 hours of manual sorting per report",
                win: "Every term classified in under 60 seconds",
                color: "#f59e0b",
              },
              {
                pain: "Wasted spend hiding across hundreds of terms",
                win: "Zero-sale burn surfaced and sorted automatically",
                color: "#f87171",
              },
              {
                pain: "Zero visibility on brand vs discovery spend",
                win: "Branded split with ACOS, spend, and sales side by side",
                color: "#2dd4bf",
              },
            ].map((item, i) => (
              <div
                key={i}
                className="bg-surface/70 border border-accent/10 rounded-2xl p-5 backdrop-blur-lg card-hover"
              >
                <div className="text-[11px] text-quad-dogs/40 font-bold mb-1.5 line-through leading-relaxed">
                  {item.pain}
                </div>
                <div
                  className="w-5 h-0.5 rounded-sm mb-1.5 opacity-50"
                  style={{ background: item.color }}
                />
                <div className="text-[13px] text-text font-semibold leading-relaxed">
                  {item.win}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings + Upload */}
        <div className="relative z-10 max-w-[560px] mx-auto mt-[52px] px-10">
          {/* Step 1 */}
          <div className="animate-fade-up-4 flex items-center gap-3 mb-3.5">
            <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center font-heading text-[15px] text-accent shrink-0">
              1
            </div>
            <div className="font-heading text-[22px] tracking-wider">
              Configure Your Settings
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-accent/20 to-transparent" />
          </div>

          <div className="animate-fade-up-4 grid grid-cols-2 gap-2.5 mb-3.5">
            <div className="bg-surface/85 border border-accent/[0.18] rounded-[14px] p-4 backdrop-blur-lg">
              <div className="text-[9px] font-extrabold tracking-[0.18em] uppercase text-accent mb-2.5 flex items-center gap-1.5">
                <Crosshair className="w-3 h-3" />
                TARGET ACOS
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={target}
                  min={1}
                  max={200}
                  onChange={(e) =>
                    setTarget(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="flex-1 bg-bg-base/80 border border-accent/20 rounded-lg px-3 py-2.5 text-accent text-[22px] font-mono font-bold text-center w-full transition-all duration-200 fpc-input"
                />
                <span className="text-lg text-text-secondary font-bold">
                  %
                </span>
              </div>
              <div className="text-[10px] text-text-secondary mt-2 leading-relaxed">
                Threshold that drives all quadrant logic.
              </div>
            </div>
            <div className="bg-surface/85 border border-quad-qmarks/[0.18] rounded-[14px] p-4 backdrop-blur-lg">
              <div className="text-[9px] font-extrabold tracking-[0.18em] uppercase text-quad-qmarks mb-2.5 flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                BRAND NAME
              </div>
              <input
                type="text"
                value={brandName}
                placeholder="e.g. ACME, acme brand"
                onChange={(e) => setBrandName(e.target.value)}
                className="w-full bg-bg-base/80 border border-quad-qmarks/20 rounded-lg px-3 py-2.5 text-text text-[13px] font-body transition-all duration-200 fpc-input"
              />
              <div className="text-[10px] text-text-secondary mt-2 leading-relaxed">
                Optional. Unlocks branded split tab.
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="animate-fade-up-5 flex items-center gap-3 mb-3">
            <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center font-heading text-[15px] text-accent shrink-0">
              2
            </div>
            <div className="font-heading text-[22px] tracking-wider">
              Load Your Search Term Report
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-accent/20 to-transparent" />
          </div>

          <div
            className={cn(
              "animate-fade-up-5 w-full border-[1.5px] border-dashed rounded-2xl px-7 py-8 text-center cursor-pointer backdrop-blur-lg transition-all duration-200 mb-2.5 drop-hover",
              dragging
                ? "border-accent bg-accent/[0.06]"
                : "border-accent/25 bg-surface/70"
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              loadFile(e.dataTransfer.files[0]);
            }}
            onClick={() => fileRef.current.click()}
          >
            <FileSpreadsheet className="w-9 h-9 mx-auto mb-3 text-accent/60" />
            <div className="font-heading text-[22px] tracking-wide mb-1.5">
              Drop your CSV or XLSX here
            </div>
            <div className="text-xs text-text-secondary mb-5 leading-relaxed">
              Seller Central {"\u2192"} Reports {"\u2192"} Advertising Reports
              <br />
              Campaign Type:{" "}
              <span className="text-text">Sponsored Products</span>{" "}
              {"\u2192"} Report Type:{" "}
              <span className="text-text">Search Term</span>
              <br />
              <span className="text-text-secondary text-[11px]">
                Accepts .csv and .xlsx formats
              </span>
            </div>
            <div className="inline-block px-9 py-3 bg-gradient-to-br from-accent to-accent-hover rounded-lg text-black font-extrabold text-[13px] tracking-wide shadow-[0_0_24px_rgba(245,158,11,0.3)] cta-hover">
              CHOOSE FILE
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                if (e.target.files[0]) loadFile(e.target.files[0]);
              }}
            />
          </div>
          <div className="animate-fade-up-5 text-[11px] text-text-dim text-center mb-[60px]">
            Your data never leaves this browser. Nothing is uploaded or stored.
          </div>
        </div>

        {/* What You Get */}
        <div className="relative z-10 border-t border-accent/[0.08] bg-surface/50 py-14 px-10">
          <div className="max-w-[960px] mx-auto">
            <div className="text-center mb-9">
              <div className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-accent mb-2.5">
                What you get
              </div>
              <div className="font-heading text-[38px] font-normal tracking-wide">
                Built by PPC strategists. Not generic SaaS.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3.5">
              {[
                {
                  title: "Prime Movers",
                  color: "#f59e0b",
                  border: "rgba(245,158,11,0.2)",
                  desc: "Your highest-converting, most efficient terms. The tool finds them instantly. Push bids and budget, no deliberation needed.",
                },
                {
                  title: "Hungry Giants",
                  color: "#a78bfa",
                  border: "rgba(167,139,250,0.2)",
                  desc: "Big spend, leaking margin. These terms convert but bleed above your target ACOS. You get the exact list and the bid move to make.",
                },
                {
                  title: "Dark Horses",
                  color: "#2dd4bf",
                  border: "rgba(45,212,191,0.2)",
                  desc: "Efficient but starved of budget. Most accounts have hidden wins here that never get attention. Raise bids and give them room.",
                },
                {
                  title: "Dead Weight",
                  color: "#f87171",
                  border: "rgba(248,113,113,0.2)",
                  desc: "Every dollar burned on zero-sale terms, surfaced and sorted by spend. Cut this budget today and redeploy it to what actually works.",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="flex gap-4 p-5 bg-bg-base/60 rounded-[14px] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/[0.04]"
                  style={{ border: `1px solid ${f.border}` }}
                >
                  <div
                    className="w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0"
                    style={{
                      background: `${f.color}10`,
                      border: `1px solid ${f.color}25`,
                    }}
                  >
                    <div
                      className="font-heading text-xl"
                      style={{ color: f.color }}
                    >
                      {f.title.split(" ")[0][0]}
                    </div>
                  </div>
                  <div>
                    <div
                      className="font-heading text-[22px] tracking-wide mb-1.5"
                      style={{ color: f.color }}
                    >
                      {f.title}
                    </div>
                    <div className="text-[13px] text-text-secondary leading-relaxed font-light">
                      {f.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* About */}
        <div className="relative z-10 max-w-[960px] mx-auto px-10 py-[60px]">
          <div className="grid grid-cols-[1.1fr_0.9fr] gap-12 items-center">
            <div>
              <div className="text-[10px] font-extrabold tracking-[0.2em] uppercase text-accent mb-3.5">
                About First Page Consultants
              </div>
              <div className="font-heading text-4xl leading-tight mb-5">
                We have been inside Amazon Ads since 2016. This is how we think.
              </div>
              <p className="text-sm text-text-secondary leading-relaxed mb-3.5 font-light">
                We built this tool because our team was losing too much time on
                manual search term analysis before every audit. We automated our
                own thinking and are sharing it free because better tools make
                better sellers.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed mb-7 font-light">
                We manage ad spend across the US, Canada, UK, Europe, and India
                for 30+ brands. If you want this level of thinking applied to
                your full account, the first audit is on us.
              </p>
              <a
                href="https://www.firstpageconsultants.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-8 py-3.5 bg-gradient-to-br from-accent to-accent-hover rounded-lg text-black font-extrabold text-[13px] no-underline tracking-wide shadow-[0_0_28px_rgba(245,158,11,0.28)] cta-hover"
              >
                BOOK A FREE AUDIT <ArrowLeft className="w-3.5 h-3.5 inline rotate-180" />
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["10+", "Years on Amazon", "#f59e0b"],
                ["5", "Global Marketplaces", "#2dd4bf"],
                ["30+", "Active Brands", "#a78bfa"],
                ["\u221E", "Terms Analyzed", "#f59e0b"],
              ].map(([num, label, color]) => (
                <div
                  key={label}
                  className="bg-surface/80 rounded-[14px] px-4 py-5 text-center"
                  style={{ border: `1px solid ${color}22` }}
                >
                  <div
                    className="font-heading text-[44px] leading-none mb-2"
                    style={{ color }}
                  >
                    {num}
                  </div>
                  <div className="text-[11px] text-text-secondary font-semibold tracking-wide">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Landing Footer */}
        <div className="relative z-10 border-t border-accent/[0.08] px-10 py-4 flex justify-between items-center flex-wrap gap-2.5 bg-bg-base/70">
          <div className="text-[11px] text-text-dim">
            {"\u00A9"} First Page Consultants · Amazon Advertising Specialists
          </div>
          <div className="text-[11px] text-text-dim">
            <a
              href="https://www.firstpageconsultants.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent no-underline font-semibold"
            >
              firstpageconsultants.com
            </a>{" "}
            · No data stored · No login required
          </div>
        </div>
      </div>
    );

  /* ─── DASHBOARD ──────────────────────────────────────────────────── */
  return (
    <div className="bg-bg min-h-screen font-body text-text">
      {modal && (
        <LeadModal
          leadName={leadName}
          setLeadName={setLeadName}
          leadEmail={leadEmail}
          setLeadEmail={setLeadEmail}
          onSubmit={handleModalSubmit}
          onClose={() => {
            setModal(false);
            setPendingDL(null);
          }}
        />
      )}

      {/* Header */}
      <div className="bg-surface border-b border-border px-5 py-2.5 flex items-center justify-between sticky top-0 z-20 gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[9px] font-extrabold tracking-[0.18em] text-accent uppercase">
              First Page Consultants
            </div>
            <div className="font-heading text-lg tracking-wide">
              Search Term Intelligence
            </div>
          </div>
          <div className="w-px h-7 bg-border" />
          <div className="flex gap-3 items-center flex-wrap">
            <label className="text-[11px] text-text-secondary flex items-center gap-1.5">
              <Target className="w-3 h-3 text-text-secondary" />
              Target ACOS
              <input
                type="number"
                value={target}
                min={1}
                max={200}
                onChange={(e) =>
                  setTarget(Math.max(1, Number(e.target.value) || 1))
                }
                className="w-[50px] bg-surface-card border border-border rounded-md px-1.5 py-1 text-accent text-[13px] font-mono text-center outline-none fpc-input"
              />
              <span className="text-text-secondary">%</span>
            </label>
            <label className="text-[11px] text-text-secondary flex items-center gap-1.5">
              Min Spend $
              <input
                type="number"
                value={minSpend}
                min={0}
                onChange={(e) =>
                  setMinSpend(Math.max(0, Number(e.target.value) || 0))
                }
                className="w-[50px] bg-surface-card border border-border rounded-md px-1.5 py-1 text-text text-[13px] font-mono text-center outline-none fpc-input"
              />
            </label>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={downloadTab}
            className="px-3.5 py-1.5 bg-accent/10 border border-accent/30 rounded-md text-accent cursor-pointer text-[11px] font-bold flex items-center gap-1.5 hover:bg-accent/20 transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
          >
            <Download className="w-3.5 h-3.5" /> Export Tab
          </button>
          <button
            onClick={downloadFull}
            className="px-3.5 py-1.5 bg-accent border-none rounded-md text-black cursor-pointer text-[11px] font-extrabold flex items-center gap-1.5 hover:bg-accent-hover transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
          >
            <Download className="w-3.5 h-3.5" /> Full Export
          </button>
          <button
            onClick={reset}
            className="px-3.5 py-1.5 bg-transparent border border-border rounded-md text-text-secondary cursor-pointer text-[11px] font-semibold flex items-center gap-1.5 hover:border-text-secondary/50 transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> New Report
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="flex gap-px bg-border border-b border-border">
        <Pill label="Terms" value={fmtK(totals.count)} color="#e2e8f0" />
        <Pill label="Total Spend" value={fmt$(totals.spend)} color="#e2e8f0" />
        <Pill label="Total Sales" value={fmt$(totals.sales)} color="#2dd4bf" />
        <Pill
          label="Overall ACOS"
          value={fmtP(totals.acos)}
          color={totals.acos <= target ? "#2dd4bf" : "#f87171"}
        />
        <Pill label="Orders" value={fmtK(totals.orders)} color="#e2e8f0" />
        <Pill
          label="Dead Weight"
          value={fmt$(totals.waste)}
          color="#f87171"
        />
      </div>

      {/* Tabs */}
      <div className="bg-surface border-b border-border px-5 flex">
        {[
          ["quadrant", "Quadrant Analysis", BarChart3],
          ["waste", "Wasted Spend", AlertTriangle],
          [
            "brand",
            brandName.trim()
              ? "Branded vs Non-Branded"
              : "Branded vs Non-Branded  (enter brand name in settings to unlock)",
            Tag,
          ],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "px-4 py-3 bg-transparent border-none border-b-2 cursor-pointer text-[11px] font-bold tracking-wide flex items-center gap-1.5 transition-colors",
              tab === id
                ? "border-b-accent text-accent"
                : id === "brand" && !brandName.trim()
                ? "border-b-transparent text-text-dim"
                : "border-b-transparent text-text-secondary hover:text-text"
            )}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {/* Quadrant Tab */}
        {tab === "quadrant" && (
          <div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {Object.entries(result.quads).map(([type, rows]) => (
                <QuadCard
                  key={type}
                  type={type}
                  rows={rows}
                  isActive={activeQ === type}
                  onClick={setActiveQ}
                />
              ))}
            </div>

            <div className="bg-surface-card rounded-xl border border-border p-5 pb-3 mb-4">
              <div className="font-heading text-base tracking-wide mb-0.5">
                Sales vs ACOS Map
              </div>
              <div className="text-[11px] text-text-secondary mb-3.5">
                Each dot is one search term. Dashed line = your target ACOS (
                {target}%). Right and below = better performance.
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart
                  margin={{ top: 8, right: 16, bottom: 26, left: 8 }}
                >
                  <CartesianGrid stroke="#1a2d47" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="x"
                    type="number"
                    name="Sales"
                    tickFormatter={(v) =>
                      v >= 1000
                        ? `$${(v / 1000).toFixed(0)}K`
                        : `$${v}`
                    }
                    tick={{ fill: "#607a99", fontSize: 10 }}
                    label={{
                      value: "Sales ($)",
                      position: "insideBottom",
                      offset: -14,
                      fill: "#607a99",
                      fontSize: 10,
                    }}
                  />
                  <YAxis
                    dataKey="y"
                    type="number"
                    name="ACOS"
                    domain={[0, Math.min(250, target * 5)]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: "#607a99", fontSize: 10 }}
                    label={{
                      value: "ACOS %",
                      angle: -90,
                      position: "insideLeft",
                      offset: 10,
                      fill: "#607a99",
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={target}
                    stroke="#f59e0b"
                    strokeDasharray="5 3"
                    label={{
                      value: `Target ${target}%`,
                      fill: "#f59e0b",
                      fontSize: 10,
                      position: "insideTopRight",
                    }}
                  />
                  <Tooltip content={<ScatterTip />} />
                  {Object.entries(result.quads).map(([type, rows]) => (
                    <Scatter
                      key={type}
                      data={rows
                        .filter((r) => r.acos < 300 && r.sales > 0)
                        .map((r) => ({
                          x: r.sales,
                          y: r.acos,
                          name: r.term,
                          type,
                          spend: r.spend,
                          orders: r.orders,
                        }))}
                      fill={QUAD[type].color}
                      opacity={0.75}
                      r={4}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="flex gap-3.5 justify-center mt-1">
                {Object.entries(QUAD).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-1.5 text-[10px] text-text-secondary"
                  >
                    <div
                      className="w-[7px] h-[7px] rounded-full"
                      style={{ background: v.color }}
                    />
                    {v.label}
                  </div>
                ))}
              </div>
            </div>

            <div
              className="bg-surface-card rounded-xl p-5"
              style={{
                border: `1px solid ${QUAD[activeQ].color}40`,
              }}
            >
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="font-heading text-lg tracking-wide"
                  style={{ color: QUAD[activeQ].color }}
                >
                  {QUAD[activeQ].label}
                </div>
                <div className="text-[11px] text-text-secondary">
                  {result.quads[activeQ].length} terms · click headers to sort
                </div>
              </div>
              <SortTable
                key={activeQ}
                rows={result.quads[activeQ]}
                color={QUAD[activeQ].color}
                targetAcos={target}
              />
            </div>
          </div>
        )}

        {/* Waste Tab */}
        {tab === "waste" && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                {
                  label: "Dead Weight Spend",
                  value: fmt$(result.totalWaste),
                  sub: `${result.zeroSales.length} terms burned budget with zero conversions`,
                  color: "#f87171",
                  bgCls: "bg-quad-dogs/[0.08]",
                  borderCls: "border-quad-dogs/25",
                },
                {
                  label: "Hungry Giant Bleed",
                  value: fmt$(Math.max(0, result.highAcosWaste)),
                  sub: `${result.highAcos.length} terms converting but leaking above target ACOS`,
                  color: "#f59e0b",
                  bgCls: "bg-quad-stars/[0.08]",
                  borderCls: "border-quad-stars/25",
                },
                {
                  label: "Total Recoverable",
                  value: fmt$(
                    result.totalWaste + Math.max(0, result.highAcosWaste)
                  ),
                  sub: "Shift this to Prime Movers and Dark Horses",
                  color: "#2dd4bf",
                  bgCls: "bg-quad-qmarks/[0.07]",
                  borderCls: "border-quad-qmarks/25",
                },
              ].map((card) => (
                <div
                  key={card.label}
                  className={cn(
                    "p-5 rounded-xl border",
                    card.bgCls,
                    card.borderCls
                  )}
                >
                  <div
                    className="text-[26px] font-black font-mono mb-1"
                    style={{ color: card.color }}
                  >
                    {card.value}
                  </div>
                  <div
                    className="text-[10px] font-extrabold uppercase tracking-[0.12em] mb-1.5"
                    style={{ color: card.color }}
                  >
                    {card.label}
                  </div>
                  <div className="text-[11px] text-text-secondary leading-relaxed">
                    {card.sub}
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-surface-card rounded-xl border border-quad-dogs/25 p-5 mb-3.5">
              <div className="font-heading text-base text-quad-dogs mb-1 tracking-wide">
                Dead Weight Terms
              </div>
              <div className="text-[11px] text-text-secondary mb-3">
                Spent budget, returned nothing. Negate in exact match across
                every campaign today.
              </div>
              <SortTable
                key="zero"
                rows={result.zeroSales}
                color="#f87171"
                targetAcos={target}
              />
            </div>
            <div className="bg-surface-card rounded-xl border border-quad-cows/25 p-5">
              <div className="font-heading text-base text-quad-cows mb-1 tracking-wide">
                Hungry Giants Bleeding Margin
              </div>
              <div className="text-[11px] text-text-secondary mb-3">
                Converting but above 1.5x your target ACOS. Reduce bids 15-25%
                and reassess in two weeks.
              </div>
              <SortTable
                key="high"
                rows={result.highAcos}
                color="#a78bfa"
                targetAcos={target}
              />
            </div>
          </div>
        )}

        {/* Brand Tab */}
        {tab === "brand" && (
          <div>
            {!brandName.trim() ? (
              <div className="text-center py-[60px] px-6">
                <div className="font-heading text-[22px] mb-2.5">
                  Brand Name Not Set
                </div>
                <div className="text-[13px] text-text-secondary leading-relaxed max-w-[340px] mx-auto">
                  Enter your brand name in the header settings above. Separate
                  multiple names with commas (e.g. duradry, dr g).
                </div>
              </div>
            ) : !brandSplit ? (
              <div className="text-center py-10 text-text-secondary">
                Loading brand data...
              </div>
            ) : (
              (() => {
                const { branded, nonBranded } = brandSplit;
                const ts = branded.spend + nonBranded.spend;
                const tsl = branded.sales + nonBranded.sales;
                const bSp =
                  ts > 0 ? Math.round((branded.spend / ts) * 100) : 0;
                const bSa =
                  tsl > 0 ? Math.round((branded.sales / tsl) * 100) : 0;
                return (
                  <div>
                    <div className="bg-surface-card border border-border rounded-xl p-4 mb-3.5">
                      <div className="font-heading text-base mb-3.5 tracking-wide">
                        Brand split for:{" "}
                        <span className="text-accent">{brandName}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2.5">
                        {[
                          ["Terms", branded.count, nonBranded.count, (v) => v],
                          ["Spend", branded.spend, nonBranded.spend, fmt$],
                          ["Sales", branded.sales, nonBranded.sales, fmt$],
                          ["ACOS", branded.acos, nonBranded.acos, fmtP],
                        ].map(([label, b, nb, fn]) => (
                          <div
                            key={label}
                            className="bg-bg-base/50 border border-border rounded-[10px] px-3.5 py-3 text-center"
                          >
                            <div className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-text-secondary mb-2">
                              {label}
                            </div>
                            <div className="flex justify-around items-center">
                              <div>
                                <div className="text-base font-black font-mono text-accent tabular-nums">
                                  {fn(b)}
                                </div>
                                <div className="text-[9px] text-text-secondary mt-0.5">
                                  Branded
                                </div>
                              </div>
                              <div className="w-px h-8 bg-border" />
                              <div>
                                <div className="text-base font-black font-mono text-quad-qmarks tabular-nums">
                                  {fn(nb)}
                                </div>
                                <div className="text-[9px] text-text-secondary mt-0.5">
                                  Non-Brand
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {[
                      [
                        "Spend Share",
                        bSp,
                        100 - bSp,
                        fmt$(branded.spend),
                        fmt$(nonBranded.spend),
                      ],
                      [
                        "Sales Share",
                        bSa,
                        100 - bSa,
                        fmt$(branded.sales),
                        fmt$(nonBranded.sales),
                      ],
                    ].map(([title, bp, nbp, bv, nbv]) => (
                      <div
                        key={title}
                        className="bg-surface-card border border-border rounded-xl p-4 mb-3"
                      >
                        <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-text-secondary mb-2.5">
                          {title}
                        </div>
                        <div className="flex rounded-md overflow-hidden h-[26px] mb-2">
                          <div
                            className="bg-accent flex items-center justify-center text-[11px] font-extrabold text-black"
                            style={{
                              width: `${bp}%`,
                              minWidth: bp > 8 ? 0 : "auto",
                            }}
                          >
                            {bp > 8 ? `${bp}%` : ""}
                          </div>
                          <div
                            className="bg-quad-qmarks flex items-center justify-center text-[11px] font-extrabold text-black"
                            style={{ width: `${nbp}%` }}
                          >
                            {nbp > 8 ? `${nbp}%` : ""}
                          </div>
                        </div>
                        <div className="flex gap-5 text-[11px]">
                          <div>
                            <span className="text-accent">
                              {"\u25A0"}
                            </span>{" "}
                            <span className="text-text-secondary">
                              Branded{" "}
                            </span>
                            <span className="font-mono text-text tabular-nums">
                              {bp}% · {bv}
                            </span>
                          </div>
                          <div>
                            <span className="text-quad-qmarks">
                              {"\u25A0"}
                            </span>{" "}
                            <span className="text-text-secondary">
                              Non-Branded{" "}
                            </span>
                            <span className="font-mono text-text tabular-nums">
                              {nbp}% · {nbv}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="flex flex-col gap-3.5">
                      <div className="bg-surface-card rounded-xl border border-accent/30 p-5">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="font-heading text-base text-accent tracking-wide">
                            Branded Terms
                          </div>
                          <div className="text-[11px] text-text-secondary">
                            · {branded.rows.length} terms
                          </div>
                        </div>
                        <div className="text-[11px] text-text-secondary mb-3">
                          Defense spend. Protect your name. Watch ACOS here —
                          branded terms inflate overall efficiency scores.
                        </div>
                        <SortTable
                          key="br"
                          rows={branded.rows}
                          color="#f59e0b"
                          targetAcos={target}
                        />
                      </div>
                      <div className="bg-surface-card rounded-xl border border-quad-qmarks/30 p-5">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="font-heading text-base text-quad-qmarks tracking-wide">
                            Non-Branded Terms
                          </div>
                          <div className="text-[11px] text-text-secondary">
                            · {nonBranded.rows.length} terms
                          </div>
                        </div>
                        <div className="text-[11px] text-text-secondary mb-3">
                          Your growth engine. These terms bring in new customers.
                          Higher ACOS here is expected and normal.
                        </div>
                        <SortTable
                          key="nb"
                          rows={nonBranded.rows}
                          color="#2dd4bf"
                          targetAcos={target}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* Dashboard Footer */}
      <div className="border-t border-border bg-surface px-5 py-3 flex justify-between items-center flex-wrap gap-2.5">
        <div className="text-[11px] text-text-secondary">
          <span className="text-accent font-bold">
            First Page Consultants
          </span>{" "}
          — Amazon advertising specialists since 2016.
        </div>
        <a
          href="https://www.firstpageconsultants.com"
          target="_blank"
          rel="noopener noreferrer"
          className="px-5 py-2 bg-accent rounded-md text-black font-extrabold text-[11px] no-underline tracking-wide hover:bg-accent-hover transition-colors"
        >
          Get a Free Account Audit <ArrowLeft className="w-3 h-3 inline rotate-180" />
        </a>
      </div>
    </div>
  );
}
