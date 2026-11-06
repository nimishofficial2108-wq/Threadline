import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip as RTooltip } from "recharts";
import { ScanLine, XCircle, CheckCircle2, Ban, UserCog, Plus, RefreshCw, AlertTriangle, ArrowLeftRight, Eye, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, Panel, Kpi, Ev, Pill, LedgerMini, fmt, C, ChartBox } from "@/components/tl/ui";
import { useSim, SKUS } from "@/lib/sim/store";
import { CU, SCAN_TRIGGER_PER_1000, multFor } from "@/lib/sim/model";
import { meta } from "@/lib/meta";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/heat")({
  head: () => meta("HEAT Operations", "Warehouse demand heat map, two-stage PickRight verification and StockSync inventory reconciliation."),
  component: Heat,
});

function Heat() {
  const s = useSim();
  const [mode, setMode] = useState<"demand" | "exceptions">("demand");
  const [picker, setPicker] = useState("P-07");
  const [showExc, setShowExc] = useState(false);
  const order = s.orders.find((o) => o.id === s.selectedOrder) ?? s.orders.find((o) => o.status === "Created" || o.status === "Blocked" || o.status === "Picked");
  const sku = order && SKUS.find((x) => x.sku === order.sku);
  const pickedSku = order?.pick && SKUS.find((x) => x.sku === order.pick!.sku);
  const lines = Math.max(1, s.fin.orders * 4);
  const claims = (s.fin.shippedWrong / lines) * 1000;
  const m = multFor(s.scenario);
  const labour = s.fin.orders * 0.35 * s.assump.labour * m.run;
  const scanExp = s.fin.orders * 0.25 * s.assump.scanCost * m.run;
  const avoided = s.fin.prevented * CU.wrongItemEvent * m.event;
  const discrepancies = s.stock.filter((r) => r.system !== r.physical);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="02 · HEAT — High-demand Execution and Allocation Transformation" title="Prevent warehouse errors before dispatch" subtitle="Demand-aware slotting, two-stage scan verification and live inventory reconciliation." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Picking accuracy" value={s.fin.orders ? `${(100 - ((s.fin.prevented + s.fin.shippedWrong) / s.fin.orders) * 100).toFixed(2)}%` : "—"} ev="MODELED" />
        <Kpi label="Wrong-item claims / 1,000 lines" value={claims.toFixed(2)} ev="MODELED" tone={claims > SCAN_TRIGGER_PER_1000 ? "bad" : "good"} hint={`Scan trigger > ${SCAN_TRIGGER_PER_1000} (model-specific proposed threshold)`} />
        <Kpi label="Dispatches blocked" value={s.fin.prevented} ev="MODELED" />
        <Kpi label="Cost avoided" value={`CU ${fmt(avoided)}*`} ev="MODELED" tone="good" hint={`CU ${CU.wrongItemEvent}* per wrong-item event`} />
      </div>

      <div className="grid xl:grid-cols-5 gap-4">
        <Panel n="A" title="Warehouse demand heat map" sub="Hover a bin for SKU detail · demo floor plan" className="xl:col-span-3"
          right={<div className="flex rounded-lg border p-0.5 text-xs">{(["demand", "exceptions"] as const).map((k) => <button key={k} onClick={() => setMode(k)} className={cn("px-2.5 py-1 rounded-md capitalize", mode === k && "bg-sage text-forest font-medium")}>{k}</button>)}</div>}>
          <div className="relative rounded-xl bg-muted/60 p-4">
            <div className="grid grid-cols-4 gap-4">
              {["A", "B", "C", "D"].map((z) => (
                <div key={z}>
                  <div className="text-[10px] font-display font-semibold tracking-widest text-muted-foreground mb-1.5">ZONE {z}</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {s.bins.filter((b) => b.zone === z).map((b) => {
                      const risk = b.exc + b.wrong;
                      const bg = mode === "demand" ? `color-mix(in oklab, var(--forest) ${15 + b.demand * 0.8}%, var(--card))` : risk > 6 ? "var(--destructive)" : risk > 3 ? "var(--warning)" : `color-mix(in oklab, var(--primary) ${10 + risk * 12}%, var(--card))`;
                      return (
                        <Tooltip key={b.id}>
                          <TooltipTrigger asChild>
                            <button aria-label={`Bin ${b.id}`} className="aspect-square rounded-md border border-card/60 text-[9px] font-mono hover:ring-2 hover:ring-primary" style={{ background: bg, color: (mode === "demand" ? b.demand > 55 : risk > 3) ? "var(--primary-foreground)" : "var(--foreground)" }}>{b.id}</button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs space-y-0.5">
                            <div className="font-semibold">{b.sku} · {SKUS.find((x) => x.sku === b.sku)?.cat}</div>
                            <div>Variant {b.size} / {b.color}</div><div>Demand {b.demand} · Stock {b.stock}</div>
                            <div>Pick exceptions {b.exc} · Wrong-item history {b.wrong}</div>
                            <div>Risk: {risk > 6 ? "High" : risk > 3 ? "Medium" : "Low"}</div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                  <div className="h-2 mt-2 rounded bg-card/80 border-dashed border text-[8px] text-center text-muted-foreground leading-[6px]">aisle</div>
                </div>
              ))}
            </div>
            <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%"><path d="M 20 95% L 98% 95%" stroke="var(--primary)" strokeWidth="2" fill="none" className="flow-dash" /></svg>
          </div>
          <div className="flex justify-between mt-3 text-[11px] text-muted-foreground"><span>Darker green = higher demand · amber/red = exception concentration</span><span>Picker route shown dashed</span></div>
        </Panel>

        <Panel n="B" title="PickRight two-stage verification" className="xl:col-span-2"
          right={<Button size="sm" variant="outline" onClick={() => { s.newOrder(); toast("New order created"); }}><Plus className="size-3.5" /> New order</Button>}>
          {!order ? <p className="text-sm text-muted-foreground">Create a new order to begin picking.</p> : (
            <div className="space-y-3">
              <Select value={order.id} onValueChange={(v) => s.set({ selectedOrder: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{s.orders.filter((o) => ["Created", "Picked", "Blocked"].includes(o.status) || o.id === order.id).slice(0, 30).map((o) => <SelectItem key={o.id} value={o.id} className="text-xs">{o.id} · {o.sku} · {o.status}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-3 bg-sage/50"><div className="text-[10px] text-muted-foreground font-display font-semibold tracking-wider">EXPECTED</div><div className="font-semibold text-sm mt-1">{sku?.cat}</div><div className="font-mono text-xs">{order.sku}</div><div className="text-xs">Size {order.size} · {order.color}</div></div>
                <div className={cn("rounded-lg border p-3", order.pick && !order.pick.ok && "border-destructive bg-destructive/5")}><div className="text-[10px] text-muted-foreground font-display font-semibold tracking-wider">SCANNED</div>
                  {order.pick ? <><div className="font-semibold text-sm mt-1">{pickedSku?.cat}</div><div className={cn("font-mono text-xs", order.pick.sku !== order.sku && "text-destructive font-bold")}>{order.pick.sku}</div><div className="text-xs"><span className={cn(order.pick.size !== order.size && "text-destructive font-bold")}>Size {order.pick.size}</span> · <span className={cn(order.pick.color !== order.color && "text-destructive font-bold")}>{order.pick.color}</span></div></> : <div className="text-xs text-muted-foreground mt-1">Awaiting scan</div>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">{order.pick ? (order.pick.ok ? <CheckCircle2 className="size-4 text-primary" /> : <XCircle className="size-4 text-destructive" />) : <ScanLine className="size-4 text-muted-foreground" />}Scan 1 · picking</span>
                <span className="text-muted-foreground">→</span>
                <span className="flex items-center gap-1">{order.scan2 ? <CheckCircle2 className="size-4 text-primary" /> : <ScanLine className="size-4 text-muted-foreground" />}Scan 2 · packing</span>
                <span className="ml-auto"><Pill v={order.status} /></span>
              </div>
              {order.pick && !order.pick.ok && <div className="rounded-lg bg-destructive/10 text-destructive text-xs p-2.5 flex gap-2"><AlertTriangle className="size-4 shrink-0" />Mismatch — dispatch blocked. Incremental handling ≈ CU 12* re-pick vs CU {CU.wrongItemEvent}* if shipped.</div>}
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" onClick={() => s.pickScan(order.id, "ok")}><ScanLine className="size-3.5" />Scan Correct SKU</Button>
                <Button size="sm" variant="outline" onClick={() => s.pickScan(order.id, "sku")}>Trigger Wrong SKU</Button>
                <Button size="sm" variant="outline" onClick={() => s.pickScan(order.id, "size")}>Trigger Wrong Size</Button>
                <Button size="sm" variant="outline" onClick={() => s.pickScan(order.id, "color")}>Trigger Wrong Colour</Button>
                <Button size="sm" variant="secondary" onClick={() => { s.approvePack(order.id); toast[order.pick?.ok ? "success" : "error"](order.pick?.ok ? "Pack approved — shipment created" : "Cannot approve: scan 1 not matched"); }}><CheckCircle2 className="size-3.5" />Approve Pack</Button>
                <Button size="sm" variant="secondary" onClick={() => s.blockDispatch(order.id)}><Ban className="size-3.5" />Block Dispatch</Button>
              </div>
              <div className="flex gap-2 items-center">
                <Select value={picker} onValueChange={setPicker}><SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger><SelectContent>{["P-07", "P-12", "P-19", "P-23"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" variant="ghost" onClick={() => { s.log({ type: "Picker reassigned", entity: order.id, pillar: "HEAT", actor: "Supervisor", rule: `→ ${picker}`, loc: order.wh, sev: "Low" }); toast(`Reassigned to ${picker}`); }}><UserCog className="size-3.5" />Reassign Picker</Button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid xl:grid-cols-3 gap-4">
        <Panel n="C" title="StockSync inventory intelligence" sub="OMS/WMS ledger" className="xl:col-span-2"
          right={<Pill v={discrepancies.length ? `${discrepancies.length} out of sync` : "In sync"} />}>
          <div className="flex flex-wrap gap-2 mb-3">
            <Button size="sm" onClick={() => { s.set({ stock: s.stock.map((r) => ({ ...r, physical: r.system })) }); s.log({ type: "Inventory sync adjustment", entity: "STOCKSYNC", pillar: "HEAT", actor: "WMS", rule: `${discrepancies.length} rows reconciled`, loc: "All", sev: "Low" }); toast.success("Inventory reconciled"); }}><RefreshCw className="size-3.5" />Reconcile Inventory</Button>
            <Button size="sm" variant="outline" onClick={() => s.injectFailure("Warehouse stock mismatch")}><AlertTriangle className="size-3.5" />Trigger Inventory Mismatch</Button>
            <Button size="sm" variant="outline" onClick={() => { s.set({ stock: s.stock.map((r) => ({ ...r, system: r.physical })) }); s.log({ type: "Stock synced to OMS", entity: "STOCKSYNC", pillar: "HEAT", actor: "OMS", rule: "Physical → system", loc: "All", sev: "Low" }); }}><ArrowLeftRight className="size-3.5" />Sync Stock</Button>
            <Button size="sm" variant="outline" onClick={() => { const bins = [...s.bins]; const hot = bins.sort((a, b) => b.demand - a.demand)[0]; s.set({ bins: s.bins.map((b) => (b.id === hot.id ? { ...b, zone: b.zone, exc: Math.max(0, b.exc - 2) } : b)) }); s.log({ type: "High-demand SKU reallocated", entity: hot.sku, pillar: "HEAT", actor: "Slotting engine", rule: `${hot.id} → golden zone`, loc: "Zone A", sev: "Low" }); toast(`Reallocated ${hot.sku} to golden zone`); }}><Shuffle className="size-3.5" />Reallocate High-demand SKU</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowExc(!showExc)}><Eye className="size-3.5" />View Exceptions</Button>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-xs">
            <thead className="text-muted-foreground text-left"><tr>{["SKU", "Variant", "System", "Physical", "Reserved", "Available", "Discrepancy", "Action"].map((h) => <th key={h} className="py-1.5 pr-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>{s.stock.filter((r) => !showExc || r.system !== r.physical).map((r, i) => { const d = r.physical - r.system; return (
              <tr key={i} className="border-t"><td className="py-1.5 pr-3 font-mono">{r.sku}{r.tag && <span className="ml-1"><Pill v="High-return" /></span>}</td><td className="pr-3">{r.variant}</td><td className="pr-3 tabular-nums">{r.system}</td><td className="pr-3 tabular-nums">{r.physical}</td><td className="pr-3 tabular-nums">{r.reserved}</td><td className="pr-3 tabular-nums">{r.physical - r.reserved}</td><td className={cn("pr-3 tabular-nums", d && "text-destructive font-semibold")}>{d}</td>
                <td>{d ? <button className="text-primary font-medium" onClick={() => s.set({ stock: s.stock.map((x, j) => (j === i ? { ...x, physical: x.system } : x)) })}>Recount</button> : <span className="text-muted-foreground">—</span>}</td></tr>); })}</tbody>
          </table></div>
          <p className="text-[11px] text-muted-foreground mt-2">Slotting recommendation: separate similar variants ({s.bins.filter((b) => b.wrong > 2).map((b) => b.id).slice(0, 4).join(", ") || "none flagged"}) into non-adjacent bins.</p>
        </Panel>
        <div className="space-y-4">
          <Panel n="D" title="HEAT economics" right={<Ev s="MODELED" />}>
            <dl className="text-sm space-y-1.5">
              {[["Wrong-item event cost", `CU ${CU.wrongItemEvent}*`], ["Avoidable per 100 orders", `CU ${CU.heatPer100}*`], ["Scan trigger (proposed)", `> ${SCAN_TRIGGER_PER_1000} / 1,000 lines`], ["Packing verification adherence", s.fin.orders ? `${Math.min(100, 70 + (s.approved >= 2 ? 25 : 0) + (s.risks[0].active ? 5 : 0))}%` : "—"], ["Labour expense", `CU ${fmt(labour)}*`], ["Scanning expense", `CU ${fmt(scanExp)}*`], ["Cost avoided", `CU ${fmt(avoided)}*`]].map(([k, v]) => <div key={k} className="flex justify-between border-b pb-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>)}
              <div className="flex justify-between pt-1"><dt className="font-semibold">Incremental net contribution</dt><dd className={cn("font-kpi", avoided - labour - scanExp >= 0 ? "text-forest" : "text-destructive")}>CU {fmt(avoided - labour - scanExp)}*</dd></div>
            </dl>
            <ChartBox h={120}>{s.weekly.length ? <BarChart data={s.weekly.slice(-10)}><CartesianGrid stroke={C.grid} vertical={false} /><XAxis dataKey="w" tick={{ fontSize: 10 }} /><YAxis tick={{ fontSize: 10 }} /><RTooltip /><Bar dataKey="prevented" name="Blocked" fill={C.g} /></BarChart> : null}</ChartBox>
          </Panel>
          <LedgerMini pillar="HEAT" limit={4} />
        </div>
      </div>
    </div>
  );
}
