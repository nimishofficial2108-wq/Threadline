import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { QrCode, Search, FileText, ShieldCheck, AlertOctagon, Sparkles, GitCompare, PackagePlus, Wrench, Hammer, Recycle, Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Kpi, Ev, Pill, LedgerMini, fmt, C, ChartBox } from "@/components/tl/ui";
import { useSim } from "@/lib/sim/store";
import { CU, dispositions, bestDisposition, type Grade, type Route as R } from "@/lib/sim/model";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revive")({
  head: () => meta("REVIVE Recovery", "Return intake, A–E grading and value-based disposition for Threadline's reverse logistics."),
  component: Revive,
});

const GRADES: { g: Grade; d: string }[] = [
  { g: "A", d: "Saleable as new" }, { g: "B", d: "Minor refurbishment / repack" }, { g: "C", d: "Repair or significant refurbishment" }, { g: "D", d: "Upcycle / component salvage" }, { g: "E", d: "Recycle / responsible disposal" },
];

function Revive() {
  const s = useSim();
  const [sel, setSel] = useState(s.returns[0]?.id);
  const [cmp, setCmp] = useState(false);
  const [rec, setRec] = useState<string | null>(null);
  const r = s.returns.find((x) => x.id === sel) ?? s.returns[0];
  const value = r ? r.value * s.assump.recoveryValue : 0;
  const opts = r?.grade ? dispositions(value, r.grade, s.dispo) : [];
  const best = r?.grade ? bestDisposition(value, r.grade, s.dispo) : null;
  const decide = (route: R) => { if (!r?.grade) return toast.error("Grade the item first"); const o = opts.find((x) => x.route === route); if (!o?.allowed) return toast.error(`${route} not permitted for grade ${r.grade}`); s.decideReturn(r.id, route); toast.success(`${route} approved · net ₹${o.net}`); };
  const gradeDist = GRADES.map(({ g }) => ({ name: g, v: s.returns.filter((x) => x.grade === g).length }));
  const ageing = [["0–7", 0, 7], ["8–14", 8, 14], ["15–21", 15, 21], ["22+", 22, 999]].map(([n, a, b]) => ({ name: n as string, v: s.returns.filter((x) => x.age >= (a as number) && x.age <= (b as number)).length }));
  const reasons = Object.entries(s.returns.reduce<Record<string, number>>((m, x) => ((m[x.reason] = (m[x.reason] ?? 0) + 1), m), {})).map(([name, v]) => ({ name, v }));
  const recoverable = s.returns.reduce((a, x) => a + (x.recovered ?? 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="03 · REVIVE — Return, Evaluation, Value Identification, Inventory Validation & Efficient Recovery" title="Recover maximum economic value from every legitimate return" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Inventory value at stake / month" value="CU 218K*" ev="ASSUMPTION" hint="Valuation — not cash savings" />
        <Kpi label="Write-off + carrying / returned unit" value={`CU ${CU.writeOffPerUnit}*`} ev="ASSUMPTION" />
        <Kpi label="Realised recovery" value={`₹${fmt(s.fin.recovery)}`} ev="MODELED" tone="good" hint="Expected net of recovery costs" />
        <Kpi label={`Ageing > ${s.assump.ageingThreshold} days`} value={s.returns.filter((x) => x.age > s.assump.ageingThreshold && !x.disposition).length} ev="MODELED" tone="warn" />
      </div>

      <Panel n="A" title="Return intake queue" sub="QR-based intake">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button size="sm" onClick={() => { const nx = s.returns.find((x) => x.pickup !== "Received"); if (!nx) return toast("All returns received"); s.updateRet(nx.id, { pickup: "Received" }, "Item received"); setSel(nx.id); toast.success(`QR scanned: ${nx.id}`); }}><QrCode className="size-3.5" />Scan Return</Button>
          <Button size="sm" variant="outline" disabled={!r} onClick={() => r && s.updateRet(r.id, { inspect: "In progress" }, "Inspection started")}><Search className="size-3.5" />Start Inspection</Button>
          <Button size="sm" variant="outline" disabled={!r} onClick={() => r && setRec(r.orderId)}><FileText className="size-3.5" />View Original Dispatch Record</Button>
          <Button size="sm" variant="outline" disabled={!r} onClick={() => r && s.updateRet(r.id, {}, "Return authenticated")}><ShieldCheck className="size-3.5" />Verify Received Product</Button>
          <Button size="sm" variant="outline" disabled={!r} onClick={() => { if (!r) return; s.updateRet(r.id, { inspect: "Disputed" }, "Wrong-item dispute escalated"); s.addExc({ sev: "High", link: r.id, loc: "Returns hub", pillar: "REVIVE", next: "Compare dispatch scan evidence", title: `Wrong-item dispute on ${r.id}` }); }}><AlertOctagon className="size-3.5" />Escalate Wrong-item Dispute</Button>
        </div>
        {rec && <div className="mb-3 rounded-lg bg-sage p-3 text-xs flex justify-between"><span>Dispatch record for <b>{rec}</b>: {s.ledger.filter((b) => b.entity === rec).length ? s.ledger.filter((b) => b.entity === rec).map((b) => b.type).join(" → ") : "Legacy order (pre-ledger) — 2/2 scans recorded in WMS, packed by K-02."}</span><button onClick={() => setRec(null)}>×</button></div>}
        <div className="overflow-x-auto"><table className="w-full text-xs">
          <thead className="text-left text-muted-foreground"><tr>{["Return", "Order", "SKU / category", "Reason", "Reported condition", "Pickup", "Inspection", "Age (d)", "Disposition"].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{s.returns.map((x) => (
            <tr key={x.id} onClick={() => setSel(x.id)} className={cn("border-t cursor-pointer hover:bg-muted/60", x.id === r?.id && "bg-sage/60")}>
              <td className="py-1.5 pr-3 font-mono">{x.id}</td><td className="pr-3 font-mono">{x.orderId}</td><td className="pr-3">{x.sku} · {x.cat}</td><td className="pr-3">{x.reason}</td><td className="pr-3">{x.cond}</td><td className="pr-3"><Pill v={x.pickup} /></td><td className="pr-3"><Pill v={x.inspect + (x.grade ? ` · ${x.grade}` : "")} /></td><td className={cn("pr-3 tabular-nums", x.age > s.assump.ageingThreshold && "text-destructive font-semibold")}>{x.age}</td><td>{x.disposition ?? "—"}</td>
            </tr>))}</tbody>
        </table></div>
      </Panel>

      {r && <div className="grid xl:grid-cols-5 gap-4">
        <Panel n="B" title="A–E grading console" sub={`${r.id} · ${r.cat}`} className="xl:col-span-2">
          <div className="flex gap-4">
            <div className="relative grid place-items-center size-32 rounded-xl border bg-muted shrink-0">
              <Shirt className="size-16" style={{ color: r.grade ? `color-mix(in oklab, var(--forest) ${100 - "ABCDE".indexOf(r.grade) * 20}%, var(--destructive))` : "var(--muted-foreground)" }} strokeWidth={1.25} />
              {r.grade && <span className="absolute top-2 right-2 grid place-items-center size-7 rounded-full bg-forest text-primary-foreground font-kpi text-sm">{r.grade}</span>}
              {r.grade && "CDE".includes(r.grade) && <span className="absolute bottom-3 left-5 size-3 rounded-full bg-warning/80" />}
              {r.grade && "DE".includes(r.grade) && <span className="absolute bottom-6 right-6 size-2 rounded-full bg-destructive/80" />}
            </div>
            <div className="space-y-1.5 flex-1">
              {GRADES.map(({ g, d }) => (
                <button key={g} onClick={() => { s.gradeReturn(r.id, g); }} className={cn("w-full text-left rounded-lg border px-3 py-1.5 text-xs flex gap-2 hover:border-primary", r.grade === g && "bg-sage border-primary")}>
                  <b className="font-display">Grade {g}</b><span className="text-muted-foreground">{d}</span>
                </button>
              ))}
              <p className="text-[10px] text-muted-foreground">Prototype grading definitions — editable in Evidence & Settings.</p>
            </div>
          </div>
        </Panel>

        <Panel n="C" title="Value-based disposition engine" sub={`Recoverable selling value ₹${fmt(value)} · demand probability ${(s.dispo.demandProb * 100).toFixed(0)}%`} className="xl:col-span-3" right={<Ev s="ASSUMPTION" />}>
          {!r.grade ? <p className="text-sm text-muted-foreground">Grade the item to compute expected net recovery per route.</p> : (<>
            <div className="flex flex-wrap gap-2 mb-3">
              <Button size="sm" onClick={() => toast.success(`Recommended: ${best?.route} (₹${best?.net})`)}><Sparkles className="size-3.5" />Recommend Recovery Route</Button>
              <Button size="sm" variant="outline" onClick={() => setCmp(!cmp)}><GitCompare className="size-3.5" />Compare All Dispositions</Button>
              <Button size="sm" variant="outline" onClick={() => decide("Restock")}><PackagePlus className="size-3.5" />Approve Restock</Button>
              <Button size="sm" variant="outline" onClick={() => decide("Refurbish")}><Wrench className="size-3.5" />Send for Refurbishment</Button>
              <Button size="sm" variant="outline" onClick={() => decide("Repair")}><Hammer className="size-3.5" />Assign Repair</Button>
              <Button size="sm" variant="outline" onClick={() => decide("Recycle")}><Recycle className="size-3.5" />Route to Recycling</Button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {opts.map((o) => (
                <button key={o.route} onClick={() => decide(o.route)} disabled={!o.allowed} className={cn("rounded-lg border p-2.5 text-left", !o.allowed && "opacity-40", o.route === best?.route && "border-primary bg-sage", r.disposition === o.route && "ring-2 ring-forest")}>
                  <div className="text-[11px] font-display font-semibold">{o.route}</div>
                  <div className={cn("font-kpi text-lg", (o.net ?? 0) < 0 && "text-destructive")}>{o.allowed ? `₹${fmt(o.net!)}` : "n/a"}</div>
                  {cmp && <div className="text-[10px] text-muted-foreground">cost ₹{o.cost} · {s.dispo.days[o.route]}d</div>}
                  {o.route === best?.route && <div className="text-[10px] text-forest font-semibold">Recommended</div>}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Expected net = value × grade recovery share × demand probability − (inspection + route cost + holding + secondary logistics). Routes not permitted by grade policy are excluded.</p>
          </>)}
        </Panel>
      </div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel n="D" title="Return grade distribution" right={<Ev s="MODELED" />}><ChartBox><BarChart data={gradeDist}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="v" radius={[4, 4, 0, 0]}>{gradeDist.map((_, i) => <Cell key={i} fill={[C.f, C.g, C.s, C.a, C.r][i]} />)}</Bar></BarChart></ChartBox></Panel>
        <Panel title="Inventory ageing (days)" right={<Ev s="MODELED" />}><ChartBox><BarChart data={ageing}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="name" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="v" fill={C.a} radius={[4, 4, 0, 0]} /></BarChart></ChartBox></Panel>
        <Panel title="Recoverable vs unrecoverable" right={<Ev s="MODELED" />}><ChartBox><PieChart><Pie data={[{ name: "Net recovered (₹)", v: recoverable }, { name: "Unrecovered value (₹)", v: Math.max(0, s.returns.filter((x) => x.disposition).reduce((a, x) => a + x.value, 0) - recoverable) || 1 }]} dataKey="v" nameKey="name" innerRadius={45} outerRadius={75}><Cell fill={C.g} /><Cell fill={C.grid} /></Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart></ChartBox>
          <p className="text-[11px] text-muted-foreground">Inventory valuation ≠ working-capital release ≠ realised cash. Only the green share is counted as recovery.</p></Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel n="E" title="Return prevention feedback" sub="Loop back to merchandising and catalogue quality" className="lg:col-span-2">
          <div className="grid md:grid-cols-2 gap-4">
            <ChartBox h={180}><BarChart data={reasons} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="v" fill={C.f} radius={[0, 4, 4, 0]} /></BarChart></ChartBox>
            <ul className="text-xs space-y-2">
              {reasons.filter((x) => x.name !== "Changed mind").map((x) => <li key={x.name} className="flex gap-2 items-start"><Pill v={x.v > 1 ? "Watch" : "Low"} /><span><b>{x.name}</b> — {x.name === "Size / fit" ? "add model measurements & fit guidance to listing" : x.name === "Image mismatch" ? "re-shoot product images under standard light" : x.name === "Defective" ? "raise supplier quality alert" : x.name === "Wrong item received" ? "cross-check HEAT pick evidence" : "correct product description"}</span></li>)}
              <li className="pt-2 border-t text-muted-foreground">Product-promise returns (CU 616* / 100 orders) are owned by Merchandising and sit outside the three quantified pillar pools.</li>
            </ul>
          </div>
          <Input placeholder="Add a listing correction note…" className="mt-3 h-8 text-xs" onKeyDown={(e) => { if (e.key === "Enter" && e.currentTarget.value) { s.log({ type: "Supplier defect flagged", entity: r?.sku ?? "SKU", pillar: "REVIVE", actor: "Merchandising", rule: e.currentTarget.value, loc: "Catalogue", sev: "Low" }); toast.success("Listing correction logged"); e.currentTarget.value = ""; } }} />
        </Panel>
        <LedgerMini pillar="REVIVE" />
      </div>
    </div>
  );
}
