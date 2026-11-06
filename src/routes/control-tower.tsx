import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Zap, UserPlus, Search, ArrowUpCircle, CheckCircle2, RotateCcw, Download, Flame, RotateCcw as Rv, Truck, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Pill, LedgerMini, download, toCsv, fmt } from "@/components/tl/ui";
import { useSim, health, gateInputs, type Pillar } from "@/lib/sim/store";
import { gateChecks, CU } from "@/lib/sim/model";
import { meta } from "@/lib/meta";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/control-tower")({
  head: () => meta("Pre-Mortem Control Tower", "Predict failures before they become losses: system health, failure injection, exception queue and decision support."),
  component: Tower,
});

const FAILS: Record<string, { effect: string; down: string; exposure: number; pillars: Pillar[]; fix: string; gate: string }> = {
  "Picking error surge": { effect: "Wrong-variant picks rise ~2×", down: "More wrong-item returns and refund disputes", exposure: CU.wrongItemEvent * 40, pillars: ["HEAT", "REVIVE"], fix: "Enable two-stage scanning in affected zones", gate: "R1 escalated · scan trigger breached" },
  "Warehouse stock mismatch": { effect: "System vs physical stock diverges", down: "Oversell, cancellations, wrong substitutions", exposure: 6200, pillars: ["HEAT"], fix: "Run StockSync reconciliation", gate: "R2 escalated" },
  "Barcode scanning failure": { effect: "Scan 2 unavailable at pack stations", down: "Unverified dispatches", exposure: CU.wrongItemEvent * 25, pillars: ["HEAT", "DELIVERRIGHT"], fix: "Manual pack audit; hold high-risk SKUs", gate: "Package 2 evidence paused" },
  "Returned inventory accumulation": { effect: "Ungraded backlog ageing past policy", down: "Markdowns and write-off", exposure: CU.writeOffPerUnit * 300, pillars: ["REVIVE"], fix: "Prioritise A/B grading, restock first", gate: "R3 escalated" },
  "High-risk courier lane failure": { effect: "First-attempt success falls on lane", down: "NDR and RTO spike", exposure: CU.rtoEvent * 60, pillars: ["DELIVERRIGHT"], fix: "Re-route to alternate courier", gate: "R4 escalated" },
  "COD refusal spike": { effect: "COD doorstep refusals rise", down: "RTO and reverse logistics cost", exposure: CU.rtoEvent * 80, pillars: ["DELIVERRIGHT"], fix: "OTP confirmation for COD; prepaid nudges", gate: "R4 escalated" },
  "Failed return pickups": { effect: "Reverse pickups missed", down: "Refund delays, CX complaints", exposure: 3100, pillars: ["REVIVE", "DELIVERRIGHT"], fix: "Missed-pickup audit; reschedule", gate: "R5 escalated" },
  "Refund dispute escalation": { effect: "QC disputes climb", down: "Refund leakage", exposure: 4800, pillars: ["REVIVE"], fix: "Evidence-led QC with ledger proof", gate: "R5 escalated" },
  "Pilot cost overrun": { effect: "Run cost exceeds guardrail", down: "Negative net benefit", exposure: 33000, pillars: ["CONTROL"], fix: "Freeze Package 2 release", gate: "Week-13 gate G2/G6 at risk" },
  "Insufficient trial evidence": { effect: "Too few incidents observed", down: "Inconclusive DiD", exposure: 0, pillars: ["CONTROL"], fix: "Extend pilot window", gate: "G4 Insufficient Evidence" },
};

function Tower() {
  const s = useSim(); const h = health(s);
  const [sel, setSel] = useState<string>("Picking error surge");
  const [owner, setOwner] = useState("Warehouse Ops");
  const f = FAILS[sel];
  const checks = gateChecks(gateInputs(s));
  const decisions = [
    s.fin.orders && (s.fin.shippedWrong / Math.max(1, s.fin.orders * 4)) * 1000 > 0.67 && "Wrong-item rate above scan trigger — scan reliability below pilot threshold",
    s.risks.find((r) => r.id === "R4")!.L >= 4 && "Courier RTO risk increased (R4 likelihood ≥ Likely)",
    s.returns.some((r) => r.age > s.assump.ageingThreshold && !r.disposition) && `Returned stock ageing exceeded ${s.assump.ageingThreshold}-day policy threshold`,
    s.approved < 2 && checks.some((c) => c.status !== "Pass") && "Package 2 capital gate not satisfied",
    !s.auditDone && "Data audit incomplete — 200-unit baseline audit not run",
  ].filter(Boolean) as string[];
  const icon = { HEAT: Flame, REVIVE: Rv, DELIVERRIGHT: Truck, CONTROL: Shield };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="06 · Pre-Mortem & Control Tower" title="Predict failures before they become losses" subtitle="Every status, alert and decision below derives from the shared model state or editable assumptions." />
      <Panel n="A" title="System health">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.keys(h) as Pillar[]).map((p) => { const I = icon[p]; const v = h[p]; return (
            <div key={p} className={cn("rounded-xl border p-4", v === "Critical" ? "border-destructive bg-destructive/5" : v === "Watch" ? "border-warning bg-warning/5" : "bg-sage/40")}>
              <div className="flex justify-between items-center"><div className="flex items-center gap-2 font-display font-semibold text-sm"><I className="size-4 text-primary" />{p}</div><Pill v={v} /></div>
              <div className="text-xs text-muted-foreground mt-2">{s.exceptions.filter((e) => e.pillar === p && e.status !== "Resolved").length} open exceptions</div>
            </div>); })}
        </div>
      </Panel>

      <div className="grid xl:grid-cols-5 gap-4">
        <Panel n="B" title="Pre-mortem console" sub="Inject a failure and see its consequence chain" className="xl:col-span-2">
          <div className="grid grid-cols-2 gap-1.5">
            {Object.keys(FAILS).map((k) => <button key={k} onClick={() => setSel(k)} className={cn("text-left text-xs rounded-lg border px-2.5 py-2 hover:border-primary", sel === k && "bg-sage border-primary", s.activeFailures.includes(k) && "ring-1 ring-destructive")}>{k}{s.activeFailures.includes(k) && <span className="text-destructive"> ●</span>}</button>)}
          </div>
          <Button className="w-full mt-3" onClick={() => s.injectFailure(sel)}><Zap className="size-4" />Activate: {sel}</Button>
          <ol className="mt-4 space-y-2 text-xs">
            {[["Immediate effect", f.effect], ["Downstream consequence", f.down], ["Financial exposure", `CU ${fmt(f.exposure)}* (modelled)`], ["Affected pillars", f.pillars.join(", ")], ["Recommended intervention", f.fix], ["Gate / escalation", f.gate]].map(([k, v], i) => <li key={k} className="flex gap-2"><span className="grid place-items-center size-5 rounded-full bg-forest text-primary-foreground text-[10px] shrink-0">{i + 1}</span><div><div className="font-semibold">{k}</div><div className="text-muted-foreground">{v}</div></div></li>)}
          </ol>
        </Panel>

        <Panel n="C" title="Live exception queue" className="xl:col-span-3" right={<Button size="sm" variant="outline" onClick={() => download("threadline-incidents.csv", toCsv(s.exceptions as unknown as Record<string, unknown>[]))}><Download className="size-3.5" />Export Incident</Button>}>
          <div className="flex items-center gap-2 mb-2 text-xs"><span className="text-muted-foreground">Assign to</span><Select value={owner} onValueChange={setOwner}><SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger><SelectContent>{["Warehouse Ops", "Inventory Systems", "Returns Lead", "Logistics", "CX Lead", "PMO / Finance"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
          {s.exceptions.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">Queue empty. Inject a failure or run orders.</p> : (
            <div className="overflow-x-auto max-h-[420px]"><table className="w-full text-xs">
              <thead className="text-left text-muted-foreground sticky top-0 bg-card"><tr>{["ID", "Severity", "Issue / link", "Location", "Pillar", "Status", "Owner", "Next action", ""].map((x) => <th key={x} className="py-1.5 pr-2 font-medium">{x}</th>)}</tr></thead>
              <tbody>{s.exceptions.map((e) => (
                <tr key={e.id} className="border-t align-top"><td className="py-1.5 pr-2 font-mono">{e.id}</td><td className="pr-2"><Pill v={e.sev} /></td><td className="pr-2"><div>{e.title}</div><div className="text-muted-foreground font-mono text-[10px]">{e.link}</div></td><td className="pr-2">{e.loc}</td><td className="pr-2">{e.pillar}</td><td className="pr-2"><Pill v={e.status} /></td><td className="pr-2">{e.owner}</td><td className="pr-2">{e.next}</td>
                  <td className="whitespace-nowrap">
                    <IconBtn label="Assign Owner" onClick={() => s.updateExc(e.id, { owner })}><UserPlus /></IconBtn>
                    <IconBtn label="Investigate" onClick={() => s.updateExc(e.id, { status: "Investigating" })}><Search /></IconBtn>
                    <IconBtn label="Escalate" onClick={() => s.updateExc(e.id, { status: "Escalated" })}><ArrowUpCircle /></IconBtn>
                    {e.status === "Resolved" ? <IconBtn label="Reopen" onClick={() => s.updateExc(e.id, { status: "Open" })}><RotateCcw /></IconBtn> : <IconBtn label="Resolve" onClick={() => s.updateExc(e.id, { status: "Resolved" })}><CheckCircle2 /></IconBtn>}
                  </td></tr>))}</tbody>
            </table></div>)}
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel n="D" title="Decision support" sub="Next operational and investment decisions" className="lg:col-span-2">
          {decisions.length === 0 ? <p className="text-sm text-muted-foreground">No decisions pending — all rules within thresholds.</p> : <ul className="space-y-2">{decisions.map((d) => <li key={d} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"><span>{d}</span><Link to={d.includes("Package") || d.includes("audit") ? "/capital" : d.includes("Courier") ? "/deliverright" : d.includes("ageing") ? "/revive" : "/heat"} className="text-xs text-primary font-medium whitespace-nowrap">Act →</Link></li>)}</ul>}
          <div className="mt-4 text-xs text-muted-foreground">Investment gate: {checks.filter((c) => c.status === "Pass").length}/6 checks passing · Packages approved: {s.approved}</div>
        </Panel>
        <LedgerMini pillar="CONTROL" />
      </div>
    </div>
  );
}
function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactElement }) {
  return <button aria-label={label} title={label} onClick={onClick} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-forest [&>svg]:size-3.5">{children}</button>;
}
