import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize, Play, Zap, Repeat, Route as RouteIcon, Flame, Undo2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Kpi, Pill, fmt } from "@/components/tl/ui";
import { useSim, CITIES, COURIERS, WAREHOUSES } from "@/lib/sim/store";
import { INDIA_STATES, INDIA_VIEW } from "@/lib/sim/india-paths";
import { CU } from "@/lib/sim/model";
import { meta } from "@/lib/meta";
import { toast } from "sonner";

export const Route = createFileRoute("/map")({
  head: () => meta("India Logistics Map", "Interactive India map of Threadline's warehouses, demand, routes, RTO hotspots and reverse pickups."),
  component: MapPage,
});

const proj = (lon: number, lat: number) => ({ x: ((lon - INDIA_VIEW.lon0) / (INDIA_VIEW.lon1 - INDIA_VIEW.lon0)) * INDIA_VIEW.w, y: ((INDIA_VIEW.lat1 - lat) / (INDIA_VIEW.lat1 - INDIA_VIEW.lat0)) * INDIA_VIEW.h });
const P = Object.fromEntries(CITIES.map((c) => [c.id, proj(c.lon, c.lat)]));
const HUBS: Record<string, string> = { DEL: "JAI", BOM: "PNQ", BLR: "HYD", CCU: "LKO" };
const LAYERS = ["Warehouse Network", "Order Demand Heat Map", "Forward Delivery Routes", "COD / RTO Risk", "Return Pickup Network", "Courier Performance", "Inventory Recovery Transfers"] as const;
type L = (typeof LAYERS)[number];
const DEMAND: Record<string, number> = { DEL: 1, BOM: 0.95, BLR: 0.85, HYD: 0.6, CCU: 0.55, MAA: 0.6, PNQ: 0.5, JAI: 0.35, LKO: 0.4 };
const RTO: Record<string, number> = { DEL: 0.08, BOM: 0.07, BLR: 0.06, HYD: 0.09, CCU: 0.12, MAA: 0.07, PNQ: 0.06, JAI: 0.14, LKO: 0.16 };

function curve(a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.18) { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; const dx = b.x - a.x, dy = b.y - a.y; return { c: { x: mx - dy * bend, y: my + dx * bend }, d: `M${a.x},${a.y} Q${mx - dy * bend},${my + dx * bend} ${b.x},${b.y}` }; }
const qpt = (a: { x: number; y: number }, c: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: (1 - t) ** 2 * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) ** 2 * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });

function MapPage() {
  const s = useSim();
  const [layers, setLayers] = useState<Set<L>>(new Set(["Warehouse Network", "Forward Delivery Routes", "Order Demand Heat Map"]));
  const [vb, setVb] = useState({ x: 0, y: 0, w: INDIA_VIEW.w, h: INDIA_VIEW.h });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [form, setForm] = useState({ o: "DEL", d: "BLR", courier: "SwiftShip", pay: "Prepaid" });
  const [rerouted, setRerouted] = useState(false);
  const [disrupted, setDisrupted] = useState<string | null>(null);
  const [anim, setAnim] = useState<{ t: number; reverse: boolean; running: boolean } | null>(null);
  const [delays, setDelays] = useState<string[]>([]);
  const [kpi, setKpi] = useState({ runs: 0, delivered: 0, rto: 0, cost: 0 });

  const hub = rerouted ? (form.o === "DEL" ? "LKO" : "HYD") : HUBS[form.o] ?? "HYD";
  const way = [form.o, hub === form.d ? null : hub, form.d].filter(Boolean) as string[];
  const segs = way.slice(1).map((id, i) => ({ a: P[way[i]], b: P[id], ...curve(P[way[i]], P[id]) }));
  const cr = COURIERS.find((c) => c.id === form.courier)!;
  const risk = Math.min(99, Math.round((RTO[form.d] * (form.pay === "COD" ? 1.6 : 0.6) + cr.rto + (disrupted === form.courier ? 0.15 : 0)) * 220));
  const dist = Math.hypot(P[form.o].x - P[form.d].x, P[form.o].y - P[form.d].y);
  const cost = Math.round(cr.cost * (1 + dist / 600) * (rerouted ? 1.08 : 1));

  useEffect(() => {
    if (!anim?.running) return;
    const id = requestAnimationFrame(() => setAnim((a) => { if (!a) return a; const t = a.t + 0.008; if (t >= 1) { const fail = risk > 55; setKpi((k) => ({ runs: k.runs + 1, delivered: k.delivered + (fail ? 0 : 1), rto: k.rto + (fail ? 1 : 0), cost: k.cost + cost + (fail ? CU.rtoEvent : 0) })); s.log({ type: a.reverse ? "Reverse pickup completed" : fail ? "Return-to-origin triggered" : "Delivered successfully", entity: `MAP-${form.o}-${form.d}`, pillar: "DELIVERRIGHT", actor: form.courier, rule: `risk ${risk}`, loc: form.d, sev: fail ? "Medium" : "Low" }); if (fail && !a.reverse) s.set({ fin: { ...s.fin, rto: s.fin.rto + 1, handling: s.fin.handling + CU.rtoEvent } }); return { ...a, t: 1, running: false }; } if (disrupted === form.courier && t > 0.45 && t < 0.46) setDelays((d) => [...d, `Delay at ${CITIES.find((c) => c.id === hub)?.name}`]); return { ...a, t }; }));
    return () => cancelAnimationFrame(id);
  });

  const pos = (() => { if (!anim) return null; const t = anim.reverse ? 1 - anim.t : anim.t; const n = segs.length; const i = Math.min(n - 1, Math.floor(t * n)); const lt = t * n - i; const sg = segs[i]; return qpt(sg.a, sg.c, sg.b, lt); })();
  const tog = (l: L) => setLayers((p) => { const n = new Set(p); n.has(l) ? n.delete(l) : n.add(l); return n; });
  const zoom = (f: number) => setVb((v) => { const w = Math.min(INDIA_VIEW.w, Math.max(120, v.w * f)); const h = w * (INDIA_VIEW.h / INDIA_VIEW.w); return { x: v.x + (v.w - w) / 2, y: v.y + (v.h - h) / 2, w, h }; });
  const has = (l: L) => layers.has(l);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="05 · Geospatial Logistics Intelligence" title="Interactive India logistics map" subtitle="State boundaries from a real India dataset. Nodes, shipments and connections are demo data; intercity lines are illustrative, not road routes." />
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Route runs" value={kpi.runs} ev="MODELED" />
        <Kpi label="Delivered" value={kpi.delivered} ev="MODELED" tone="good" />
        <Kpi label="RTO" value={kpi.rto} ev="MODELED" tone="warn" />
        <Kpi label="Route cost" value={`CU ${fmt(kpi.cost)}*`} ev="MODELED" />
        <Kpi label="Network orders (twin)" value={fmt(s.fin.orders)} ev="MODELED" />
      </div>
      <div className="grid xl:grid-cols-4 gap-4">
        <Panel title="India network" sub="Scroll to zoom · drag to pan" className="xl:col-span-3"
          right={<div className="flex gap-1"><Button size="icon" variant="outline" className="size-7" aria-label="Zoom in" onClick={() => zoom(0.75)}><ZoomIn className="size-3.5" /></Button><Button size="icon" variant="outline" className="size-7" aria-label="Zoom out" onClick={() => zoom(1.33)}><ZoomOut className="size-3.5" /></Button><Button size="icon" variant="outline" className="size-7" aria-label="Fit" onClick={() => setVb({ x: 0, y: 0, w: INDIA_VIEW.w, h: INDIA_VIEW.h })}><Maximize className="size-3.5" /></Button></div>}>
          <div className="rounded-xl bg-sage/40 border overflow-hidden">
            <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="w-full h-[640px] cursor-grab active:cursor-grabbing select-none"
              onWheel={(e) => zoom(e.deltaY > 0 ? 1.1 : 0.9)}
              onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; }} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}
              onPointerMove={(e) => { if (!drag.current) return; const k = vb.w / e.currentTarget.clientWidth; const dx = (e.clientX - drag.current.x) * k, dy = (e.clientY - drag.current.y) * k; drag.current = { x: e.clientX, y: e.clientY }; setVb((v) => ({ ...v, x: v.x - dx, y: v.y - dy })); }}>
              <g>{INDIA_STATES.map((st) => <path key={st.n} d={st.d} fill="var(--card)" stroke="var(--border)" strokeWidth={0.8}><title>{st.n}</title></path>)}</g>
              {has("Order Demand Heat Map") && CITIES.map((c) => <circle key={c.id} cx={P[c.id].x} cy={P[c.id].y} r={14 + DEMAND[c.id] * 30} fill="var(--primary)" opacity={0.12 + DEMAND[c.id] * 0.18} />)}
              {has("COD / RTO Risk") && CITIES.map((c) => <circle key={c.id} cx={P[c.id].x} cy={P[c.id].y} r={8 + RTO[c.id] * 160} fill={RTO[c.id] > 0.11 ? "var(--destructive)" : "var(--warning)"} opacity={0.22} />)}
              {has("Forward Delivery Routes") && WAREHOUSES.flatMap((w) => CITIES.filter((c) => !c.wh).slice(0, 3).map((c) => <path key={w + c.id} d={curve(P[w], P[c.id], 0.12).d} fill="none" stroke="var(--forest)" strokeOpacity={0.25} strokeWidth={1} />))}
              {has("Return Pickup Network") && CITIES.filter((c) => !c.wh).map((c) => { const w = WAREHOUSES.reduce((b, x) => (Math.hypot(P[x].x - P[c.id].x, P[x].y - P[c.id].y) < Math.hypot(P[b].x - P[c.id].x, P[b].y - P[c.id].y) ? x : b), WAREHOUSES[0]); return <path key={c.id} d={curve(P[c.id], P[w], -0.2).d} fill="none" stroke="var(--warning)" strokeWidth={1.4} className="flow-dash" />; })}
              {has("Inventory Recovery Transfers") && [["CCU", "DEL"], ["BOM", "BLR"], ["DEL", "BOM"]].map(([a, b]) => <path key={a + b} d={curve(P[a], P[b], 0.25).d} fill="none" stroke="var(--chart-5)" strokeWidth={2} strokeDasharray="2 4" />)}
              {has("Courier Performance") && CITIES.map((c, i) => { const cc = COURIERS[i % 4]; return <g key={c.id}><rect x={P[c.id].x + 8} y={P[c.id].y + 6} width={46} height={12} rx={3} fill="var(--card)" stroke="var(--border)" /><text x={P[c.id].x + 11} y={P[c.id].y + 15} fontSize={7} fill={cc.fa > 0.88 ? "var(--forest)" : "var(--destructive)"}>{cc.id.slice(0, 5)} {(cc.fa * 100).toFixed(0)}%</text></g>; })}
              {segs.map((sg, i) => <path key={i} d={sg.d} fill="none" stroke={disrupted === form.courier ? "var(--destructive)" : "var(--primary)"} strokeWidth={3} strokeLinecap="round" className="flow-dash" />)}
              {CITIES.map((c) => (
                <g key={c.id}>
                  {c.wh && has("Warehouse Network") ? <rect x={P[c.id].x - 6} y={P[c.id].y - 6} width={12} height={12} rx={2} fill="var(--forest)" stroke="var(--card)" strokeWidth={2} /> : <circle cx={P[c.id].x} cy={P[c.id].y} r={4.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={1.5} />}
                  <text x={P[c.id].x + 9} y={P[c.id].y - 6} fontSize={10} fontFamily="Montserrat" fontWeight={600} fill="var(--foreground)">{c.name}</text>
                </g>
              ))}
              {pos && <g><circle cx={pos.x} cy={pos.y} r={9} fill={anim?.reverse ? "var(--warning)" : "var(--forest)"} opacity={0.25} /><circle cx={pos.x} cy={pos.y} r={5} fill={anim?.reverse ? "var(--warning)" : "var(--forest)"} stroke="var(--card)" strokeWidth={2} /></g>}
              <text x={10} y={INDIA_VIEW.h - 10} fontSize={9} fill="var(--muted-foreground)">DEMO DATA · illustrative intercity connections</text>
            </svg>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button size="sm" onClick={() => { s.runOrders(500); toast.success("500 deliveries run across the network"); }}><Play className="size-3.5" />Run 500 Deliveries</Button>
            <Button size="sm" variant="outline" onClick={() => { setDisrupted(form.courier); s.set({ env: "Courier Disruption" }); s.injectFailure("High-risk courier lane failure"); toast.warning(`${form.courier} disrupted`); }}><Zap className="size-3.5" />Introduce Courier Disruption</Button>
            <Button size="sm" variant="outline" onClick={() => { const nx = COURIERS.filter((c) => c.id !== form.courier && c.id !== disrupted).sort((a, b) => a.rto - b.rto)[0]; setForm({ ...form, courier: nx.id }); s.log({ type: "Courier assigned", entity: `MAP-${form.o}-${form.d}`, pillar: "DELIVERRIGHT", actor: "Router", rule: `switch → ${nx.id}`, loc: form.o, sev: "Low" }); }}><Repeat className="size-3.5" />Switch Courier Partner</Button>
            <Button size="sm" variant="outline" onClick={() => setRerouted(!rerouted)}><RouteIcon className="size-3.5" />Re-route Shipment</Button>
            <Button size="sm" variant="outline" onClick={() => setLayers((p) => new Set([...p, "COD / RTO Risk"]))}><Flame className="size-3.5" />Show RTO Hotspots</Button>
            <Button size="sm" variant="outline" onClick={() => { setLayers((p) => new Set([...p, "Return Pickup Network"])); setAnim({ t: 0, reverse: true, running: true }); }}><Undo2 className="size-3.5" />Start Reverse Pickup</Button>
            <Button size="sm" variant="ghost" onClick={() => { setAnim(null); setDisrupted(null); setRerouted(false); setDelays([]); setKpi({ runs: 0, delivered: 0, rto: 0, cost: 0 }); setVb({ x: 0, y: 0, w: INDIA_VIEW.w, h: INDIA_VIEW.h }); s.set({ env: "Normal" }); }}><RefreshCw className="size-3.5" />Reset Map</Button>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="Layers">
            <div className="space-y-2">{LAYERS.map((l) => <label key={l} className="flex items-center justify-between text-xs gap-2"><span>{l}</span><Switch checked={has(l)} onCheckedChange={() => tog(l)} /></label>)}</div>
          </Panel>
          <Panel title="Routing engine" sub="Origin → Destination → Courier → Payment">
            <div className="grid grid-cols-2 gap-2">
              {([["o", WAREHOUSES.map((w) => [w, CITIES.find((c) => c.id === w)!.name])], ["d", CITIES.map((c) => [c.id, c.name])], ["courier", COURIERS.map((c) => [c.id, c.id])], ["pay", [["Prepaid", "Prepaid"], ["COD", "COD"]]]] as const).map(([k, opts]) => (
                <Select key={k} value={form[k]} onValueChange={(v) => { setForm({ ...form, [k]: v }); setAnim(null); }}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent>{opts.map(([v, n]) => <SelectItem key={v} value={v} className="text-xs">{n}</SelectItem>)}</SelectContent></Select>
              ))}
            </div>
            <Button className="w-full mt-3" size="sm" disabled={form.o === form.d} onClick={() => { setDelays([]); setAnim({ t: 0, reverse: false, running: true }); s.log({ type: "Shipment created", entity: `MAP-${form.o}-${form.d}`, pillar: "DELIVERRIGHT", actor: "TMS", rule: `${form.courier} · ${form.pay}`, loc: form.o, sev: "Low" }); }}><Play className="size-3.5" />Run shipment</Button>
            <dl className="text-xs mt-3 space-y-1.5">
              <Row k="Status" v={<Pill v={!anim ? "Pending" : anim.running ? "In transit" : risk > 55 ? "RTO" : "Delivered"} />} />
              <Row k="Waypoints" v={way.map((w) => CITIES.find((c) => c.id === w)?.name).join(" → ")} />
              <Row k="Delivery risk" v={<span className={risk > 55 ? "text-destructive font-semibold" : ""}>{risk}/100</span>} />
              <Row k="Cost" v={`CU ${cost}*`} />
              <Row k="Delay events" v={delays.length ? delays.join(", ") : "None"} />
              <Row k="Recommended action" v={risk > 55 ? (form.pay === "COD" ? "OTP-confirm COD or switch to prepaid incentive" : "Switch courier / validate address") : disrupted === form.courier ? "Switch courier partner" : "Proceed"} />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) { return <div className="flex justify-between gap-3 border-b pb-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>; }
