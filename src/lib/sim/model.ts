// Pure model rules for Threadline Command. All values are model assumptions unless noted.
export type Scenario = "Conservative" | "Base" | "Upside" | "Custom";

export const SCENARIO_MULT: Record<Exclude<Scenario, "Custom">, { capture: number; run: number; event: number; volume: number; setup: number }> = {
  Conservative: { capture: 0.5, run: 1.3, event: 0.8, volume: 0.8, setup: 1.3 },
  Base: { capture: 1, run: 1, event: 1, volume: 1, setup: 1 },
  Upside: { capture: 1.25, run: 0.9, event: 1.2, volume: 1.1, setup: 0.9 },
};
export const multFor = (s: Scenario) => (s === "Custom" ? SCENARIO_MULT.Base : SCENARIO_MULT[s]);

// INR lakh, internal management estimates
export const PACKAGES = [
  { id: "P1", name: "Process + Shared Ledger", setup: 0.4, recurring: 0.68, ramp: 3, focus: "Inspection, audit, controlled pilot and error evidence (2.0 FTE baseline)" },
  { id: "P2", name: "Targeted Scanning", setup: 1.2, recurring: 0.08, ramp: 8, focus: "Targeted barcode scanning on validated high-risk SKUs" },
  { id: "P3", name: "Integrated Intelligence", setup: 2.3, recurring: 0.68, ramp: 20, focus: "Additional grading FTE and OMS/WMS integration" },
] as const;

export function cumulativeBudget(upTo: number) {
  const ps = PACKAGES.slice(0, upTo);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { setup: r(ps.reduce((a, p) => a + p.setup, 0)), recurring: r(ps.reduce((a, p) => a + p.recurring, 0)) };
}

export const CU = {
  returnCostPerOrder: 43.5, avoidablePool: 507_000, heatPer100: 499, wrongItemEvent: 264,
  reviveAtStake: 218_000, writeOffPerUnit: 41.6, deliverPer100: 500, rtoEvent: 164, productPromisePer100: 616,
};
export const SCAN_TRIGGER_PER_1000 = 0.67;

/** Difference-in-differences: (T_after − T_before) − (C_after − C_before). Negative = improvement for defect rates. */
export const did = (tb: number, ta: number, cb: number, ca: number) => (ta - tb) - (ca - cb);

export type GateStatus = "Pass" | "Fail" | "Insufficient Evidence" | "Not Evaluated";
export interface GateInputs {
  evaluated: boolean; didValue: number; breakEvenReduction: number; costDelta: number; repeatDelta: number;
  incidents: number; minIncidents: number; auditPassed: boolean; netBenefit: number;
}
export function gateChecks(g: GateInputs): { id: string; label: string; status: GateStatus; why: string }[] {
  const ne = !g.evaluated;
  const st = (ok: boolean): GateStatus => (ne ? "Not Evaluated" : g.incidents < g.minIncidents ? "Insufficient Evidence" : ok ? "Pass" : "Fail");
  return [
    { id: "G1", label: "Wrong-item rate improves vs control (DiD ≤ −break-even)", status: st(g.didValue <= -g.breakEvenReduction), why: `DiD ${g.didValue.toFixed(2)} vs required −${g.breakEvenReduction.toFixed(2)} per 1,000 lines` },
    { id: "G2", label: "Landed cost per order not worse than baseline", status: ne ? "Not Evaluated" : g.costDelta <= 0 ? "Pass" : "Fail", why: `Cost delta ${g.costDelta.toFixed(2)} CU/order` },
    { id: "G3", label: "Repeat purchase after resolution not below baseline", status: ne ? "Not Evaluated" : g.repeatDelta >= 0 ? "Pass" : "Fail", why: `Repeat delta ${(g.repeatDelta * 100).toFixed(1)} pp` },
    { id: "G4", label: "Sufficient incidents and sample size", status: ne ? "Not Evaluated" : g.incidents >= g.minIncidents ? "Pass" : "Insufficient Evidence", why: `${g.incidents} verified incidents (min ${g.minIncidents})` },
    { id: "G5", label: "Inspection and data-quality audits passed", status: g.auditPassed ? "Pass" : ne ? "Not Evaluated" : "Fail", why: g.auditPassed ? "200-unit baseline audit complete" : "Baseline audit not completed" },
    { id: "G6", label: "Positive expected incremental net benefit", status: ne ? "Not Evaluated" : g.netBenefit > 0 ? "Pass" : "Fail", why: `Expected net ${g.netBenefit.toFixed(0)} CU/month` },
  ];
}
export const canUnlockNext = (checks: { status: GateStatus }[]) => checks.every((c) => c.status === "Pass");

export const riskScore = (l: number, i: number) => l * i;
export const riskBand = (s: number) => (s >= 15 ? "Critical" : s >= 10 ? "High" : s >= 5 ? "Medium" : "Low");

/** Transparent RTO risk score (0-100) from weighted factors in 0..1 (1 = worse). */
export const RTO_WEIGHTS = { cod: 0.25, address: 0.2, confirm: 0.15, courier: 0.15, attempt: 0.1, region: 0.1, slot: 0.05 };
export function rtoScore(f: Record<keyof typeof RTO_WEIGHTS, number>) {
  const parts = (Object.keys(RTO_WEIGHTS) as (keyof typeof RTO_WEIGHTS)[]).map((k) => ({ k, v: f[k] * RTO_WEIGHTS[k] * 100 }));
  return { score: Math.round(parts.reduce((a, p) => a + p.v, 0)), parts };
}

// Grade × route recovery share of selling value (editable prototype defaults)
export const ROUTES = ["Restock", "Refurbish", "Repair", "Upcycle", "Recycle"] as const;
export type Route = (typeof ROUTES)[number];
export type Grade = "A" | "B" | "C" | "D" | "E";
export const RECOVERY: Record<Grade, Record<Route, number>> = {
  A: { Restock: 0.95, Refurbish: 0.9, Repair: 0.8, Upcycle: 0.3, Recycle: 0.05 },
  B: { Restock: 0, Refurbish: 0.8, Repair: 0.7, Upcycle: 0.3, Recycle: 0.05 },
  C: { Restock: 0, Refurbish: 0, Repair: 0.55, Upcycle: 0.3, Recycle: 0.05 },
  D: { Restock: 0, Refurbish: 0, Repair: 0, Upcycle: 0.25, Recycle: 0.05 },
  E: { Restock: 0, Refurbish: 0, Repair: 0, Upcycle: 0, Recycle: 0.04 },
};
export interface DispoAssump { inspection: number; refurb: number; repair: number; holdingPerDay: number; secondaryLogistics: number; days: Record<Route, number>; demandProb: number }
export const DEFAULT_DISPO: DispoAssump = { inspection: 8, refurb: 40, repair: 90, holdingPerDay: 1.2, secondaryLogistics: 25, days: { Restock: 2, Refurbish: 7, Repair: 14, Upcycle: 21, Recycle: 5 }, demandProb: 0.8 };
export function dispositions(value: number, grade: Grade, a: DispoAssump) {
  return ROUTES.map((r) => {
    const share = RECOVERY[grade][r];
    const allowed = share > 0;
    const cost = a.inspection + (r === "Refurbish" ? a.refurb : r === "Repair" ? a.repair : 0) + (r === "Upcycle" || r === "Recycle" ? a.secondaryLogistics : 0) + a.holdingPerDay * a.days[r];
    const prob = r === "Recycle" ? 1 : a.demandProb;
    const net = allowed ? value * share * prob - cost : -Infinity;
    return { route: r, allowed, cost: Math.round(cost), net: allowed ? Math.round(net) : null };
  });
}
export const bestDisposition = (value: number, grade: Grade, a: DispoAssump) =>
  dispositions(value, grade, a).filter((d) => d.allowed).sort((x, y) => (y.net ?? 0) - (x.net ?? 0))[0];

export const INR_CASH: Record<Exclude<Scenario, "Custom">, number[]> = {
  Conservative: [-18.4, -20.4, -37.3], Base: [-6.2, -2.1, 3.7], Upside: [2.2, 11.6, 35.2],
};
export const P3_PAYBACK: Record<Exclude<Scenario, "Custom">, string> = { Conservative: "> 24 months", Base: "14 months", Upside: "4 months" };
