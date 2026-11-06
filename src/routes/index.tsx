import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Cell, Funnel, FunnelChart, LabelList, Line, LineChart, Pie, PieChart, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { Flame, RotateCcw, Truck, ArrowRight, Play, AlertTriangle, Recycle, GitCompare, RefreshCw, Sparkles, ShoppingCart, ScanLine, PackageCheck, CheckCircle2, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel, Kpi, Ev, Pill, LedgerMini, fmt, C, ChartBox } from "@/components/tl/ui";
import { useSim, health } from "@/lib/sim/store";
import { CU } from "@/lib/sim/model";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/")({
  head: () => meta("Command Overview", "Executive cockpit for Threadline's HEAT, REVIVE and DELIVERRIGHT supply-chain transformation."),
  component: Overview,
});

const STAGES = [
  { label: "Order placed", to: "/heat", icon: ShoppingCart },
  { label: "HEAT verification", to: "/heat", icon: ScanLine },
  { label: "Dispatch", to: "/heat", icon: PackageCheck },
  { label: "DELIVERRIGHT", to: "/deliverright", icon: Truck },
  { label: "Delivery outcome", to: "/map", icon: CheckCircle2 },
  { label: "REVIVE if returned", to: "/revive", icon: RotateCcw },
  { label: "Value recovery", to: "/revive", icon: Boxes },
] as const;

function Overview() {
  const s = useSim(); const nav = useNavigate(); const h = health(s);
  const [cmp, setCmp] = useState(false);
  const open = s.exceptions.filter((e) => e.status !== "Resolved");
  const delivered = s.orders.filter((o) => o.status === "Delivered").length;
  const funnel = [
    { name: "Orders", value: Math.max(1, s.fin.orders), fill: C.f },
    { name: "Delivered", value: Math.max(1, s.fin.orders - s.fin.rto), fill: C.g },
    { name: "Customer returns", value: Math.max(1, s.fin.returns + s.fin.shippedWrong), fill: C.s },
    { name: "RTO", value: Math.max(1, s.fin.rto), fill: C.a },
  ];
  const rootCause = [
    { name: "Wrong variant pick", v: s.fin.prevented + s.fin.shippedWrong }, { name: "Address / COD", v: s.fin.rto }, { name: "Size / fit", v: Math.round(s.fin.returns * s.assump.sizeFit) }, { name: "Other returns", v: Math.round(s.fin.returns * (1 - s.assump.sizeFit)) },
  ];
  const waterfall = (() => { const items = [["Pool", CU.avoidablePool], ["HEAT", -CU.heatPer100 * 500], ["DELIVERRIGHT", -CU.deliverPer100 * 500], ["Residual", 0]] as const; let run = 0; return items.map(([n, v], i) => { if (i === 0) { run = v; return { n, base: 0, v }; } if (n === "Residual") return { n, base: 0, v: run }; run += v; return { n, base: run, v: -v }; }); })();
  const recovery = ["Pending", "In progress", "Graded"].map((k) => ({ name: k, v: s.returns.filter((r) => r.inspect === k).length })).concat([{ name: "Disposed", v: s.returns.filter((r) => r.disposition).length }]);
  const avoided = s.fin.prevented * CU.wrongItemEvent + s.fin.rtoAvoided * CU.rtoEvent;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="01 · Command Overview" title="Threadline Supply Chain Command Centre" subtitle="One integrated operating system to prevent errors, recover inventory value and deliver reliably."
        actions={<Button onClick={() => window.dispatchEvent(new Event("tl-demo"))}><Sparkles className="size-4" /> Run Threadline Transformation Demo</Button>} />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <Kpi label="Order volume growth" value="+50%" ev="CASE" />
        <Kpi label="Returned-order count growth" value="+35%" ev="CASE" />
        <Kpi label="Implied return-rate index" value="0.90×" ev="DERIVED" hint="1.35 / 1.50 — only if periods comparable" />
        <Kpi label="Return-related cost / shipped order" value="CU 43.5*" ev="ASSUMPTION" />
        <Kpi label="Monthly avoidable cost pool" value="CU 507K*" ev="ASSUMPTION" />
      </div>

      <Panel title="Order-to-recovery journey" n="▶" sub="Click a stage to open its dashboard with current orders">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {STAGES.map((st, i) => (
            <div key={st.label} className="flex items-center gap-1 shrink-0">
              <button onClick={() => nav({ to: st.to })} className="group flex flex-col items-center gap-1.5 rounded-xl border bg-card px-4 py-3 w-[132px] hover:border-primary hover:bg-sage transition-colors">
                <st.icon className="size-5 text-forest group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-display font-semibold text-center leading-tight">{st.label}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{[s.fin.orders, s.fin.prevented, s.fin.orders - s.fin.prevented, s.shipments.length, delivered, s.returns.length, s.returns.filter((r) => r.disposition).length][i]}</span>
              </button>
              {i < STAGES.length - 1 && <svg width="28" height="10" className="shrink-0"><line x1="0" y1="5" x2="28" y2="5" stroke="var(--primary)" strokeWidth="2" className="flow-dash" /></svg>}
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { s.runOrders(100); toast.success("100 orders processed"); }}><Play className="size-4" /> Run 100 Orders</Button>
        <Button variant="outline" onClick={() => { const k = ["Picking error surge", "COD refusal spike", "Returned inventory accumulation"][s.activeFailures.length % 3]; s.injectFailure(k); toast.warning(`Failure injected: ${k}`); }}><AlertTriangle className="size-4" /> Introduce an Operational Failure</Button>
        <Button variant="outline" onClick={() => { s.runRecovery(); toast.success("Recovery workflow run on pending returns"); }}><Recycle className="size-4" /> Run Recovery Workflow</Button>
        <Button variant="outline" onClick={() => { if (!s.base) { s.snapshotBase(); toast("Baseline captured — change settings and run orders, then compare"); } setCmp(true); }}><GitCompare className="size-4" /> Compare Baseline vs Intervention</Button>
        <Button variant="ghost" onClick={() => { s.reset(); toast.success("Reset"); }}><RefreshCw className="size-4" /> Reset</Button>
      </div>

      {cmp && s.base && (
        <Panel title="Baseline vs intervention" sub="Snapshot captured earlier vs current twin state" right={<Button size="sm" variant="ghost" onClick={() => setCmp(false)}>Close</Button>}>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            {(["orders", "prevented", "shippedWrong", "rto", "recovery"] as const).map((k) => <div key={k} className="rounded-lg bg-muted p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="font-kpi">{fmt(s.base![k])} → {fmt(s.fin[k])}</div></div>)}
          </div>
        </Panel>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        <Pillar to="/heat" icon={Flame} name="HEAT — Prevent Errors" kpi="CU 499*" kpiLabel="avoidable per 100 orders" status={h.HEAT}
          rows={[["Wrong-item blocks", s.fin.prevented], ["Flagged SKUs (bins with exceptions)", s.bins.filter((b) => b.exc > 2).length], ["Unresolved packing exceptions", open.filter((e) => e.pillar === "HEAT").length]]} />
        <Pillar to="/revive" icon={RotateCcw} name="REVIVE — Recover Value" kpi="CU 218K*" kpiLabel="monthly inventory value at stake" status={h.REVIVE}
          rows={[["Returns in pipeline", s.returns.filter((r) => !r.disposition).length], [`Ageing > ${s.assump.ageingThreshold} days`, s.returns.filter((r) => r.age > s.assump.ageingThreshold).length], ["Recovered value (₹, sim)", fmt(s.fin.recovery)]]} />
        <Pillar to="/deliverright" icon={Truck} name="DELIVERRIGHT — Deliver Reliably" kpi="CU 500*" kpiLabel="avoidable per 100 orders" status={h.DELIVERRIGHT}
          rows={[["First-attempt success", s.fin.orders ? `${(100 - (s.fin.rto / s.fin.orders) * 100).toFixed(1)}%` : "—"], ["Open NDRs", s.shipments.filter((x) => x.ndr === "Raised").length], ["RTO exceptions", open.filter((e) => e.pillar === "DELIVERRIGHT").length]]} />
      </div>
      <p className="text-[11px] text-muted-foreground">Pillar KPIs are modelled operational indicators, not verified company actuals.</p>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Orders processed by week" right={<Ev s="MODELED" />}>
          <ChartBox>{s.weekly.length ? <LineChart data={s.weekly}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="w" tick={{ fontSize: 11, fill: C.text }} /><YAxis tick={{ fontSize: 11, fill: C.text }} /><Tooltip /><Line dataKey="orders" stroke={C.g} strokeWidth={2} dot={false} /></LineChart> : null}</ChartBox>
        </Panel>
        <Panel title="Customer return vs RTO funnel" right={<Ev s="MODELED" />}>
          <ChartBox>{s.fin.orders ? <FunnelChart><Tooltip /><Funnel dataKey="value" data={funnel} isAnimationActive><LabelList position="right" dataKey="name" fill="var(--foreground)" fontSize={11} stroke="none" /></Funnel></FunnelChart> : null}</ChartBox>
        </Panel>
        <Panel title="Defect contribution by root cause" right={<Ev s="MODELED" />}>
          <ChartBox>{s.fin.orders ? <PieChart><Pie data={rootCause} dataKey="v" nameKey="name" innerRadius={50} outerRadius={80}>{rootCause.map((_, i) => <Cell key={i} fill={[C.g, C.a, C.f, C.s][i]} />)}</Pie><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /></PieChart> : null}</ChartBox>
        </Panel>
        <Panel title="Warehouse exception volume" right={<Ev s="MODELED" />}>
          <ChartBox>{s.weekly.length ? <BarChart data={s.weekly}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="w" tick={{ fontSize: 11, fill: C.text }} /><YAxis tick={{ fontSize: 11, fill: C.text }} /><Tooltip /><Bar dataKey="prevented" name="Blocked" stackId="a" fill={C.g} /><Bar dataKey="exc" name="All exceptions" fill={C.a} radius={[3, 3, 0, 0]} /></BarChart> : null}</ChartBox>
        </Panel>
        <Panel title="Cost leakage waterfall" sub="Indicative, 50K orders/month model" right={<Ev s="ASSUMPTION" />}>
          <ChartBox><BarChart data={waterfall}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="n" tick={{ fontSize: 11, fill: C.text }} /><YAxis tick={{ fontSize: 11, fill: C.text }} tickFormatter={(v) => `${v / 1000}K`} /><Tooltip /><Bar dataKey="base" stackId="w" fill="transparent" /><Bar dataKey="v" stackId="w" radius={[3, 3, 0, 0]}>{waterfall.map((_, i) => <Cell key={i} fill={i === 0 ? C.r : i === 3 ? C.a : C.g} />)}</Bar></BarChart></ChartBox>
        </Panel>
        <Panel title="Inventory recovery pipeline" right={<Ev s="MODELED" />}>
          <ChartBox><BarChart data={recovery} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11, fill: C.text }} /><Tooltip /><Bar dataKey="v" fill={C.f} radius={[0, 4, 4, 0]} /></BarChart></ChartBox>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Top operational alerts" className="lg:col-span-2" right={<Link to="/control-tower" className="text-xs text-primary font-medium flex items-center gap-1">Control Tower <ArrowRight className="size-3" /></Link>}>
          {open.length === 0 ? <p className="text-sm text-muted-foreground">No open alerts. Introduce a failure or run orders to generate exceptions.</p> : (
            <ul className="divide-y">{open.slice(0, 5).map((e) => <li key={e.id} className="py-2 flex items-center justify-between gap-3 text-sm"><div><span className="font-mono text-xs text-muted-foreground mr-2">{e.id}</span>{e.title}</div><div className="flex gap-2"><Pill v={e.pillar} /><Pill v={e.sev} /></div></li>)}</ul>
          )}
          <div className="mt-3 text-xs text-muted-foreground">Modelled avoided cost so far: <b className="text-forest">CU {fmt(avoided)}*</b> · recovery value ₹{fmt(s.fin.recovery)} (tracked separately)</div>
        </Panel>
        <LedgerMini />
      </div>
    </div>
  );
}

function Pillar({ to, icon: I, name, kpi, kpiLabel, rows, status }: { to: "/heat" | "/revive" | "/deliverright"; icon: typeof Flame; name: string; kpi: string; kpiLabel: string; rows: [string, string | number][]; status: string }) {
  return (
    <Link to={to} className="panel p-5 block hover:border-primary transition-colors group">
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><I className="size-5 text-primary" /><h3 className="font-semibold">{name}</h3></div><Pill v={status} /></div>
      <div className="mt-3 flex items-baseline gap-2"><span className="font-kpi text-3xl text-forest">{kpi}</span><span className="text-xs text-muted-foreground">{kpiLabel}</span><Ev s="ASSUMPTION" /></div>
      <dl className="mt-4 space-y-1.5 text-sm">{rows.map(([k, v]) => <div key={k} className="flex justify-between border-t pt-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>)}</dl>
      <div className="mt-3 text-xs text-primary font-medium flex items-center gap-1 group-hover:gap-2 transition-all">Open dashboard <ArrowRight className="size-3" /></div>
    </Link>
  );
}
