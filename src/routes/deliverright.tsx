import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bar, BarChart, Tooltip, XAxis, YAxis } from "recharts";
import { MapPinCheck, MapPinX, BellRing, CalendarCheck, KeyRound, CalendarClock, Gauge, GitCompare, XCircle, FileWarning, RotateCw, CheckCircle2, Undo2, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Kpi, Ev, Pill, LedgerMini, fmt, C, ChartBox } from "@/components/tl/ui";
import { useSim, COURIERS, CITIES } from "@/lib/sim/store";
import { CU, rtoScore, RTO_WEIGHTS } from "@/lib/sim/model";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/deliverright")({
  head: () => meta("DELIVERRIGHT", "Last-mile delivery reliability, courier scorecards, RTO prediction and reverse pickup control."),
  component: Deliver,
});

const LABELS: Record<keyof typeof RTO_WEIGHTS, string> = { cod: "COD exposure", address: "Address quality risk", confirm: "No customer confirmation", courier: "Courier under-performance", attempt: "Attempt failure risk", region: "Regional risk", slot: "Delivery-slot uncertainty" };
const city = (id: string) => CITIES.find((c) => c.id === id)?.name ?? id;

function Deliver() {
  const s = useSim();
  const [sel, setSel] = useState(s.shipments[0]?.id);
  const sh = s.shipments.find((x) => x.id === sel) ?? s.shipments[0];
  const [f, setF] = useState({ cod: 0.6, address: 0.4, confirm: 0.5, courier: 0.3, attempt: 0.3, region: 0.4, slot: 0.3 });
  const [sort, setSort] = useState<"fa" | "rto" | "cost">("fa");
  const [payF, setPayF] = useState("All");
  const [pickupMissed, setPickupMissed] = useState(false);
  const shipF = useMemo(() => sh ? { ...f, cod: sh.pay === "COD" ? Math.max(f.cod, 0.6) : Math.min(f.cod, 0.2), address: sh.addr === "Valid" ? 0.05 : sh.addr === "Invalid" ? 1 : f.address, confirm: sh.otp || sh.confirmed ? 0.05 : f.confirm, courier: 1 - (COURIERS.find((c) => c.id === sh.courier)?.fa ?? 0.85) + 0.1 } : f, [f, sh]);
  const { score, parts } = rtoScore(shipF);
  const fx = s.env === "Courier Disruption" ? 1.8 : 1;
  const couriers = [...COURIERS].map((c) => ({ ...c, fa: c.fa / (fx > 1 ? 1.08 : 1), rto: c.rto * fx * (payF === "COD" ? 1.4 : payF === "Prepaid" ? 0.6 : 1) })).sort((a, b) => (sort === "cost" ? a.cost - b.cost : sort === "rto" ? a.rto - b.rto : b.fa - a.fa));
  const up = (p: Parameters<typeof s.updateShip>[1], ev: string) => sh && s.updateShip(sh.id, p, ev);
  const fa = s.fin.orders ? 100 - (s.fin.rto / s.fin.orders) * 100 : 0;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="04 · DELIVERRIGHT — Reliable Last-Mile Delivery" title="Improve first-attempt delivery, prevent avoidable RTO" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="First-attempt success" value={s.fin.orders ? `${fa.toFixed(1)}%` : "—"} ev="MODELED" />
        <Kpi label="RTO events" value={s.fin.rto} ev="MODELED" tone="warn" hint={`CU ${CU.rtoEvent}* per RTO event`} />
        <Kpi label="RTOs avoided via validation" value={s.fin.rtoAvoided} ev="MODELED" tone="good" />
        <Kpi label="Avoidable per 100 orders" value={`CU ${CU.deliverPer100}*`} ev="ASSUMPTION" />
      </div>

      <Panel n="A" title="Delivery operations monitor" sub="Shipment console — click a row to act on it">
        <div className="overflow-x-auto max-h-72"><table className="w-full text-xs">
          <thead className="text-left text-muted-foreground sticky top-0 bg-card"><tr>{["Shipment", "Origin", "Destination", "Courier", "Payment", "Address", "Attempts", "NDR", "Stage", "Outcome"].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
          <tbody>{s.shipments.slice(0, 40).map((x) => (
            <tr key={x.id} onClick={() => setSel(x.id)} className={cn("border-t cursor-pointer hover:bg-muted/60", x.id === sh?.id && "bg-sage/60")}>
              <td className="py-1.5 pr-3 font-mono">{x.id}</td><td className="pr-3">{city(x.origin)}</td><td className="pr-3">{city(x.dest)}</td><td className="pr-3">{x.courier}</td><td className="pr-3"><span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", x.pay === "COD" ? "bg-warning/20 text-warning-foreground" : "bg-sage text-forest")}>{x.pay}</span></td><td className="pr-3"><Pill v={x.addr} /></td><td className="pr-3 tabular-nums">{x.attempts}</td><td className="pr-3"><Pill v={x.ndr} /></td><td className="pr-3">{x.stage}</td><td><Pill v={x.outcome} /></td>
            </tr>))}</tbody>
        </table></div>
      </Panel>

      {sh && <div className="grid xl:grid-cols-2 gap-4">
        <Panel n="B" title="Address & delivery validation" sub={`${sh.id} · ${city(sh.origin)} → ${city(sh.dest)} · ${sh.pay}`}>
          <div className="flex gap-2 mb-3 flex-wrap"><Pill v={`Address ${sh.addr}`} /><Pill v={sh.confirmed ? "Confirmed" : "Unconfirmed"} /><Pill v={sh.otp ? "OTP Verified" : "OTP Pending"} /></div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <Button size="sm" onClick={() => up({ addr: "Valid" }, "Address validated")}><MapPinCheck className="size-3.5" />Validate Address</Button>
            <Button size="sm" variant="outline" onClick={() => up({ addr: "Invalid", stage: "On hold" }, "Address invalid")}><MapPinX className="size-3.5" />Trigger Invalid Address</Button>
            <Button size="sm" variant="outline" onClick={() => up({ stage: "Awaiting confirmation" }, "Delivery confirmation requested")}><BellRing className="size-3.5" />Request Delivery Confirmation</Button>
            <Button size="sm" variant="outline" onClick={() => up({ confirmed: true }, "Delivery preference confirmed")}><CalendarCheck className="size-3.5" />Confirm Delivery Preference</Button>
            <Button size="sm" variant="outline" onClick={() => up({ otp: true }, "OTP verified")}><KeyRound className="size-3.5" />Verify OTP</Button>
            <Button size="sm" variant="outline" onClick={() => up({ stage: "Rescheduled" }, "Delivery rescheduled")}><CalendarClock className="size-3.5" />Reschedule Delivery</Button>
          </div>
          <div className="mt-4 text-xs text-muted-foreground">Eligibility: {sh.addr === "Invalid" ? <b className="text-destructive">Not dispatchable — fix address</b> : sh.addr === "Valid" && (sh.pay === "Prepaid" || sh.otp) ? <b className="text-forest">Cleared for out-for-delivery</b> : <b className="text-warning-foreground">Needs validation{sh.pay === "COD" ? " + OTP for COD" : ""}</b>}</div>
          <div className="mt-4 border-t pt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <Button size="sm" variant="outline" onClick={() => up({ attempts: sh.attempts + 1, stage: "Attempt failed" }, "Failed attempt recorded")}><XCircle className="size-3.5" />Trigger Failed Attempt</Button>
            <Button size="sm" variant="outline" onClick={() => up({ ndr: "Raised" }, "NDR action taken")}><FileWarning className="size-3.5" />Generate NDR</Button>
            <Button size="sm" variant="outline" onClick={() => up({ attempts: sh.attempts + 1, stage: "Re-attempt", ndr: sh.ndr === "Raised" ? "Resolved" : sh.ndr }, "Re-delivery attempted")}><RotateCw className="size-3.5" />Attempt Re-delivery</Button>
            <Button size="sm" onClick={() => up({ outcome: "Delivered", stage: "Delivered", attempts: Math.max(1, sh.attempts) }, "Delivered successfully")}><CheckCircle2 className="size-3.5" />Mark Delivered</Button>
            <Button size="sm" variant="destructive" className="col-span-2 md:col-span-4" onClick={() => up({ outcome: "RTO", stage: "Returning to origin" }, "Return-to-origin triggered")}><Undo2 className="size-3.5" />Trigger Return-to-Origin</Button>
          </div>
        </Panel>

        <Panel n="D" title="RTO risk scorer" sub="Transparent weighted score — not a validated prediction model" right={<Ev s="MODELED" />}>
          <div className="flex items-center gap-5">
            <div className="relative size-28 shrink-0">
              <svg viewBox="0 0 36 36" className="size-full -rotate-90"><circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--muted)" strokeWidth="3" /><circle cx="18" cy="18" r="15.9" fill="none" stroke={score > 60 ? "var(--destructive)" : score > 35 ? "var(--warning)" : "var(--primary)"} strokeWidth="3" strokeDasharray={`${score} 100`} strokeLinecap="round" /></svg>
              <div className="absolute inset-0 grid place-items-center text-center"><div><div className="font-kpi text-2xl">{score}</div><div className="text-[10px] text-muted-foreground">risk / 100</div></div></div>
            </div>
            <div className="flex-1"><ChartBox h={130}><BarChart data={parts.map((p) => ({ n: LABELS[p.k], v: +p.v.toFixed(1) }))} layout="vertical"><XAxis type="number" hide /><YAxis type="category" dataKey="n" width={150} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="v" fill={C.a} radius={[0, 3, 3, 0]} /></BarChart></ChartBox></div>
          </div>
          <p className="text-xs mt-1"><b>Why flagged:</b> {parts.sort((a, b) => b.v - a.v).slice(0, 2).map((p) => LABELS[p.k]).join(" and ")} contribute most.</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3">
            {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => <label key={k} className="text-[11px]"><div className="flex justify-between"><span>{LABELS[k]}</span><span className="tabular-nums">{Math.round(f[k] * 100)}%</span></div><Slider value={[f[k] * 100]} max={100} step={5} onValueChange={([v]) => setF({ ...f, [k]: v / 100 })} /></label>)}
          </div>
          <div className="flex gap-2 mt-3"><Button size="sm" onClick={() => { s.log({ type: "RTO risk predicted", entity: sh.id, pillar: "DELIVERRIGHT", actor: "Risk engine", rule: `score ${score}`, loc: sh.dest, sev: score > 60 ? "High" : "Low" }); toast(`RTO risk score ${score}/100`); }}><Gauge className="size-3.5" />Predict RTO Risk</Button>
            <Button size="sm" variant="outline" onClick={() => { const best = couriers.sort((a, b) => a.rto - b.rto)[0]; up({ courier: best.id }, "Courier assigned"); toast(`Switched to ${best.id}`); }}><GitCompare className="size-3.5" />Compare Couriers & switch</Button></div>
        </Panel>
      </div>}

      <div className="grid xl:grid-cols-3 gap-4">
        <Panel n="C" title="Courier lane scorecards" sub="All carrier names and statistics are synthetic" className="xl:col-span-2"
          right={<div className="flex gap-2"><Select value={payF} onValueChange={setPayF}><SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger><SelectContent>{["All", "COD", "Prepaid"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent></Select>
            <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}><SelectTrigger className="h-7 text-xs w-36"><ArrowUpDown className="size-3" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fa">Reliability</SelectItem><SelectItem value="rto">RTO rate</SelectItem><SelectItem value="cost">Cost</SelectItem></SelectContent></Select></div>}>
          <table className="w-full text-xs"><thead className="text-left text-muted-foreground"><tr>{["Courier", "Lane", "First-attempt", "RTO rate", "Cost / shipment", "Delay risk", "Pickup reliability", "Recommendation"].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{couriers.map((c, i) => <tr key={c.id} className="border-t"><td className="py-2 pr-3 font-medium">{c.id}</td><td className="pr-3">{sh ? `${city(sh.origin)} → ${city(sh.dest)}` : "All"}</td><td className="pr-3 tabular-nums">{(c.fa * 100).toFixed(1)}%</td><td className="pr-3 tabular-nums">{(c.rto * 100).toFixed(1)}%</td><td className="pr-3 tabular-nums">CU {c.cost}*</td><td className="pr-3"><Pill v={c.delay * fx > 0.2 ? "High" : c.delay * fx > 0.14 ? "Medium" : "Low"} /></td><td className="pr-3 tabular-nums">{(c.pickup * 100).toFixed(0)}%</td><td>{i === 0 ? <Pill v="Preferred" /> : c.rto > 0.15 ? <Pill v="Restrict COD" /> : <Pill v="Standby" />}</td></tr>)}</tbody></table>
        </Panel>
        <Panel n="E" title="Reverse pickup control" sub="Pickup → receipt → QC → refund">
          {(() => {
            const steps = ["Pickup requested", "Scheduled", "Courier assigned", pickupMissed ? "Pickup FAILED" : "Picked up", "Warehouse receipt", "QC adjudication", "Refund reconciled"];
            const done = pickupMissed ? 3 : steps.length;
            return (<>
              <ol className="space-y-1.5 text-xs">{steps.map((st, i) => <li key={st} className="flex items-center gap-2"><span className={cn("size-2.5 rounded-full", i < done ? "bg-primary" : st.includes("FAILED") ? "bg-destructive" : "bg-muted-foreground/30")} /><span className={cn(st.includes("FAILED") && "text-destructive font-semibold")}>{st}</span></li>)}</ol>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => { setPickupMissed(true); s.addExc({ sev: "Medium", link: "RT-PICKUP", loc: "Pune", pillar: "REVIVE", next: "Reschedule pickup", title: "Missed reverse pickup" }); s.log({ type: "Pickup attempted — missed", entity: "RT-PICKUP", pillar: "DELIVERRIGHT", actor: "KaroExpress", rule: "Failed pickup alert", loc: "Pune", sev: "Medium" }); }}>Trigger Missed Pickup</Button>
                <Button size="sm" disabled={!pickupMissed} onClick={() => { setPickupMissed(false); s.log({ type: "Reverse pickup completed", entity: "RT-PICKUP", pillar: "DELIVERRIGHT", actor: "SwiftShip", rule: "Rescheduled & completed", loc: "Pune", sev: "Low" }); toast.success("Pickup rescheduled and completed"); }}>Resolve</Button>
              </div>
            </>);
          })()}
        </Panel>
      </div>
      <LedgerMini pillar="DELIVERRIGHT" />
      <p className="text-[11px] text-muted-foreground">Avoided RTO cost: CU {fmt(s.fin.rtoAvoided * CU.rtoEvent)}*</p>
    </div>
  );
}
