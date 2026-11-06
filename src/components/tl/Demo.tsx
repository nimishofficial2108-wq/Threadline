import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSim, gateInputs } from "@/lib/sim/store";
import { gateChecks, canUnlockNext, CU, bestDisposition } from "@/lib/sim/model";
import { Pill, fmt } from "./ui";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

const SCENES = ["Rapid Growth", "Warehouse Error", "Customer Return", "Last-Mile Disruption", "Financial Consequences", "Pre-Mortem & Capital Gate", "Executive Summary"];

export function DemoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [i, setI] = useState(0);
  const ran = useRef<Set<number>>(new Set());
  const s = useSim();
  const [ctx, setCtx] = useState<{ order?: string; ret?: string; ship?: string; firstGate?: boolean; secondGate?: boolean }>({});

  useEffect(() => { if (!open) { ran.current = new Set(); setI(0); setCtx({}); } }, [open]);
  useEffect(() => {
    if (!open || ran.current.has(i)) return; ran.current.add(i);
    const st = useSim.getState();
    if (i === 0) st.runOrders(100);
    if (i === 1) { const id = st.newOrder(); st.pickScan(id, "color"); useSim.getState().pickScan(id, "ok"); useSim.getState().approvePack(id); setCtx((c) => ({ ...c, order: id })); }
    if (i === 2) { const r = st.returns.find((x) => x.inspect !== "Graded") ?? st.returns[0]; st.updateRet(r.id, { pickup: "Received", inspect: "In progress" }, "Item received"); st.gradeReturn(r.id, "B"); const b = bestDisposition(r.value, "B", st.dispo); useSim.getState().decideReturn(r.id, b.route); setCtx((c) => ({ ...c, ret: r.id })); }
    if (i === 3) { const sh = st.shipments.find((x) => x.outcome === "Pending") ?? st.shipments[0]; st.updateShip(sh.id, { attempts: sh.attempts + 1, ndr: "Raised", stage: "NDR" }, "Failed attempt recorded"); useSim.getState().updateShip(sh.id, { addr: "Valid", otp: true, ndr: "Resolved", attempts: sh.attempts + 2, outcome: "Delivered", stage: "Delivered" }, "Delivered successfully"); setCtx((c) => ({ ...c, ship: sh.id })); }
    if (i === 5) {
      st.expAction("baseline"); st.expAction("start"); useSim.getState().expAction("inject"); useSim.getState().expAction("inject"); useSim.getState().expAction("evaluate");
      const first = canUnlockNext(gateChecks(gateInputs(useSim.getState())));
      useSim.getState().approveNext();
      useSim.getState().set({ exp: { ...useSim.getState().exp, injected: 0, status: "Running", series: useSim.getState().exp.series.slice(0, 4) } });
      useSim.getState().expAction("intervene"); useSim.getState().expAction("intervene"); useSim.getState().expAction("intervene"); useSim.getState().expAction("evaluate");
      const second = canUnlockNext(gateChecks(gateInputs(useSim.getState())));
      if (second) useSim.getState().approveNext();
      setCtx((c) => ({ ...c, firstGate: first, secondGate: second }));
    }
  }, [i, open]);

  const order = s.orders.find((o) => o.id === ctx.order);
  const ret = s.returns.find((r) => r.id === ctx.ret);
  const ship = s.shipments.find((x) => x.id === ctx.ship);
  const avoided = s.fin.prevented * CU.wrongItemEvent + s.fin.rtoAvoided * CU.rtoEvent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="text-[11px] font-display font-semibold tracking-[0.18em] text-primary">RUN THREADLINE TRANSFORMATION DEMO · SCENE {i + 1} / 7</div>
          <DialogTitle className="text-xl">{SCENES[i]}</DialogTitle>
          <DialogDescription>Every number below is computed live by the shared digital twin.</DialogDescription>
        </DialogHeader>
        <Progress value={((i + 1) / 7) * 100} className="h-1.5" />
        <div className="min-h-[220px] text-sm space-y-3 py-2">
          {i === 0 && (<>
            <div className="grid grid-cols-3 gap-3">{[["+50%", "Order growth (case)"], ["+35%", "Returned-order count growth (case)"], ["0.90×", "Implied return-rate index (derived)"]].map(([v, l]) => <div key={l} className="panel p-3"><div className="font-kpi text-2xl text-forest">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}</div>
            <p>Returns grew slower than orders. <b>1.35 / 1.50 = 0.90×</b> implies a 10% relative decline in returns per order — <i>only if</i> periods, cohorts and denominators are comparable. The case does not let us claim the true return rate rose or fell.</p>
            <p className="text-muted-foreground">The twin just processed 100 orders: {s.fin.prevented} errors blocked, {s.fin.rto} RTOs.</p>
          </>)}
          {i === 1 && order && (<>
            <p>Picker scanned the <b>wrong colour</b> for {order.id} ({order.sku}, {order.size}/{order.color}). HEAT's scan 1 caught the mismatch, blocked dispatch and raised an exception. The correct variant was re-picked, scan 2 passed and dispatch was approved.</p>
            <div className="flex gap-2 flex-wrap"><Pill v="Mismatch blocked" /><Pill v="Re-picked" /><Pill v={order.status} /></div>
            <p className="text-muted-foreground">Avoided mis-shipment ≈ CU {CU.wrongItemEvent}* modelled event cost, at a CU 12* re-pick handling cost.</p>
          </>)}
          {i === 2 && ret && (<>
            <p>Return {ret.id} ({ret.cat}, reason “{ret.reason}”) was received, inspected and graded <b>{ret.grade}</b>. The disposition engine compared all routes and recommended <b>{ret.disposition}</b>.</p>
            <p>Expected net recovery: <b>₹{fmt(ret.recovered ?? 0)}</b> — counted as recovery value, not as avoided cost of the full order value.</p>
          </>)}
          {i === 3 && ship && (<>
            <p>Shipment {ship.id} ({ship.pay}, {ship.courier}) had a failed first attempt and an NDR was raised. DELIVERRIGHT validated the address and verified OTP, then re-attempted delivery.</p>
            <div className="flex gap-2"><Pill v={`Attempts ${ship.attempts}`} /><Pill v={ship.outcome} /></div>
            <p className="text-muted-foreground">An RTO would have cost ≈ CU {CU.rtoEvent}* modelled.</p>
          </>)}
          {i === 4 && (<div className="grid grid-cols-2 gap-3">
            {[["Wrong-item events blocked", s.fin.prevented], ["Escaped wrong-item deliveries", s.fin.shippedWrong], ["RTO events", s.fin.rto], ["RTOs avoided", s.fin.rtoAvoided]].map(([l, v]) => <div key={l as string} className="panel p-3"><div className="font-kpi text-xl">{v}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}
            <div className="panel p-3"><div className="font-kpi text-xl text-forest">CU {fmt(avoided)}*</div><div className="text-xs text-muted-foreground">Modelled avoided operational cost (each event counted once)</div></div>
            <div className="panel p-3"><div className="font-kpi text-xl text-forest">₹{fmt(s.fin.recovery)}</div><div className="text-xs text-muted-foreground">Inventory recovery value — kept separate from avoided cost</div></div>
          </div>)}
          {i === 5 && (<>
            <p><b>Attempt 1:</b> pilot ran with injected errors and no intervention → gate {ctx.firstGate ? "passed" : "failed"}; Package 2 {ctx.firstGate ? "released" : "stayed locked"}.</p>
            <p><b>Attempt 2:</b> intervention applied with 88% compliance across a longer observation window → gate {ctx.secondGate ? "passed — Package 2 unlocked" : "still not passed (see Capital page for reasons)"}.</p>
            <p className="text-muted-foreground">Approved packages now: P1{s.approved >= 2 ? " + P2" : ""}{s.approved >= 3 ? " + P3" : ""}.</p>
          </>)}
          {i === 6 && (<>
            <ul className="space-y-1.5 list-disc pl-5">
              <li><b>HEAT</b> blocked {s.fin.prevented} wrong-item dispatches.</li>
              <li><b>REVIVE</b> realised ₹{fmt(s.fin.recovery)} recovery from graded returns.</li>
              <li><b>DELIVERRIGHT</b> recorded {s.fin.rto} RTOs and avoided {s.fin.rtoAvoided}.</li>
              <li><b>Governance</b>: {s.ledger.length} immutable audit blocks; packages approved: {s.approved}.</li>
            </ul>
            <p className="font-medium">Next management decision: {s.approved >= 3 ? "monitor integrated rollout against cost guardrails." : `evaluate evidence for Package ${s.approved + 1} at the next gate review.`}</p>
          </>)}
        </div>
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft className="size-4" /> Back</Button>
          <Button variant="ghost" size="sm" onClick={() => { ran.current = new Set(); setCtx({}); setI(0); useSim.getState().reset(); }}><RotateCcw className="size-4" /> Replay</Button>
          {i < 6 ? <Button size="sm" onClick={() => setI(i + 1)}>Next <ChevronRight className="size-4" /></Button> : <Button size="sm" onClick={() => onOpenChange(false)}>Finish</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
