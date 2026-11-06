import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { sha256 } from "js-sha256";
import { CU, multFor, type Scenario, type Grade, type Route, DEFAULT_DISPO, type DispoAssump, bestDisposition, dispositions, did, gateChecks, canUnlockNext, PACKAGES } from "./model";

export type Pillar = "HEAT" | "REVIVE" | "DELIVERRIGHT" | "CONTROL";
export type Env = "Normal" | "Peak Demand" | "Warehouse Disruption" | "Courier Disruption" | "Return Surge";
export type Sev = "Low" | "Medium" | "High" | "Critical";

export const CITIES = [
  { id: "DEL", name: "Delhi NCR", lon: 77.1, lat: 28.6, wh: true, state: "Delhi" },
  { id: "BOM", name: "Mumbai", lon: 72.88, lat: 19.07, wh: true, state: "Maharashtra" },
  { id: "BLR", name: "Bengaluru", lon: 77.59, lat: 12.97, wh: true, state: "Karnataka" },
  { id: "HYD", name: "Hyderabad", lon: 78.48, lat: 17.38, wh: false, state: "Telangana" },
  { id: "CCU", name: "Kolkata", lon: 88.36, lat: 22.57, wh: true, state: "West Bengal" },
  { id: "MAA", name: "Chennai", lon: 80.27, lat: 13.08, wh: false, state: "Tamil Nadu" },
  { id: "PNQ", name: "Pune", lon: 73.86, lat: 18.52, wh: false, state: "Maharashtra" },
  { id: "JAI", name: "Jaipur", lon: 75.79, lat: 26.91, wh: false, state: "Rajasthan" },
  { id: "LKO", name: "Lucknow", lon: 80.95, lat: 26.85, wh: false, state: "Uttar Pradesh" },
] as const;
export const WAREHOUSES = CITIES.filter((c) => c.wh).map((c) => c.id);
export const COURIERS = [
  { id: "SwiftShip", fa: 0.91, rto: 0.07, cost: 62, delay: 0.12, pickup: 0.93 },
  { id: "BlueLane", fa: 0.86, rto: 0.1, cost: 54, delay: 0.18, pickup: 0.88 },
  { id: "KaroExpress", fa: 0.81, rto: 0.14, cost: 47, delay: 0.25, pickup: 0.82 },
  { id: "MetroDash", fa: 0.89, rto: 0.08, cost: 58, delay: 0.15, pickup: 0.9 },
];
export const SKUS = [
  { sku: "TL-KUR-014", cat: "Kurta", sizes: ["S", "M", "L"], colors: ["Indigo", "Navy"], price: 1299 },
  { sku: "TL-DEN-221", cat: "Denim", sizes: ["30", "32", "34"], colors: ["Blue", "Black"], price: 1899 },
  { sku: "TL-SNK-087", cat: "Sneakers", sizes: ["7", "8", "9"], colors: ["White", "Off-white"], price: 2499 },
  { sku: "TL-TEE-310", cat: "T-shirt", sizes: ["S", "M", "L"], colors: ["Olive", "Sage"], price: 599 },
  { sku: "TL-DRS-052", cat: "Dress", sizes: ["XS", "S", "M"], colors: ["Maroon", "Wine"], price: 2199 },
  { sku: "TL-BAG-118", cat: "Handbag", sizes: ["One"], colors: ["Tan", "Brown"], price: 1599 },
  { sku: "TL-SAR-009", cat: "Saree", sizes: ["Free"], colors: ["Emerald", "Teal"], price: 3299 },
  { sku: "TL-JKT-440", cat: "Jacket", sizes: ["M", "L", "XL"], colors: ["Khaki", "Beige"], price: 2799 },
];

export interface Order { id: string; sku: string; size: string; color: string; wh: string; dest: string; courier: string; pay: "COD" | "Prepaid"; status: "Created" | "Picked" | "Blocked" | "Dispatched" | "Delivered" | "RTO" | "Returned"; pick?: { sku: string; size: string; color: string; ok: boolean }; scan2?: boolean }
export interface Exc { id: string; sev: Sev; link: string; loc: string; pillar: Pillar; status: "Open" | "Investigating" | "Escalated" | "Resolved"; owner: string; next: string; title: string }
export interface Ret { id: string; orderId: string; sku: string; cat: string; reason: string; cond: string; pickup: "Scheduled" | "Missed" | "Picked" | "Received"; inspect: "Pending" | "In progress" | "Graded" | "Disputed"; age: number; grade?: Grade; disposition?: Route; value: number; recovered?: number }
export interface Ship { id: string; orderId: string; origin: string; dest: string; courier: string; pay: "COD" | "Prepaid"; addr: "Unchecked" | "Valid" | "Invalid"; otp: boolean; confirmed: boolean; attempts: number; ndr: "None" | "Raised" | "Resolved"; stage: string; outcome: "In transit" | "Delivered" | "RTO" | "Pending" }
export interface Block { block: number; ts: string; type: string; entity: string; pillar: Pillar; actor: string; prev: string; hash: string; verified: boolean; rule: string; qr: string; loc: string; sev: Sev; data?: string | undefined }
export interface Risk { id: string; name: string; pillar: Pillar; owner: string; L: number; I: number; mitigation: string; active: boolean; status: "Open" | "Mitigating" | "Escalated" | "Resolved"; cause: string; trigger: string; ewi: string; control: string }
export interface Bin { id: string; zone: string; sku: string; size: string; color: string; demand: number; stock: number; exc: number; wrong: number }
export interface StockRow { sku: string; variant: string; system: number; physical: number; reserved: number; tag?: string }
export interface Exp { type: string; status: "Idle" | "Baseline" | "Running" | "Evaluated"; n: number; tb: number; cb: number; ta: number; ca: number; incidents: number; compliance: number; costDelta: number; repeatDelta: number; injected: number; intervention: boolean; series: { w: number; t: number; c: number }[] }

export interface Fin { orders: number; prevented: number; shippedWrong: number; rto: number; rtoAvoided: number; recovery: number; handling: number; returns: number }
export interface Assump { volume: number; returnRate: number; rtoRate: number; wrongPer1000: number; codMix: number; capture: number; labour: number; scanCost: number; recoveryValue: number; courierCost: number; setupMult: number; delayWeeks: number; sizeFit: number; seed: number; ageingThreshold: number; minIncidents: number; breakEven: number }
export const DEFAULT_ASSUMP: Assump = { volume: 50000, returnRate: 0.2, rtoRate: 0.1, wrongPer1000: 5.3, codMix: 0.45, capture: 0.6, labour: 1, scanCost: 1, recoveryValue: 1, courierCost: 1, setupMult: 1, delayWeeks: 0, sizeFit: 0.35, seed: 42, ageingThreshold: 21, minIncidents: 30, breakEven: 1.2 };

function rng(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
const GENESIS = "0".repeat(64);
const isoAt = (n: number) => new Date(Date.UTC(2026, 10, 2, 8, 0, 0) + n * 47_000).toISOString();

const ENV_FX: Record<Env, { wrong: number; rto: number; ret: number; delay: number }> = {
  Normal: { wrong: 1, rto: 1, ret: 1, delay: 1 },
  "Peak Demand": { wrong: 1.6, rto: 1.2, ret: 1.1, delay: 1.4 },
  "Warehouse Disruption": { wrong: 2.4, rto: 1, ret: 1, delay: 1.2 },
  "Courier Disruption": { wrong: 1, rto: 2, ret: 1, delay: 2.2 },
  "Return Surge": { wrong: 1, rto: 1, ret: 2, delay: 1 },
};

const DEFAULT_RISKS: Risk[] = [
  { id: "R1", name: "Wrong-SKU Dispatch", pillar: "HEAT", owner: "Warehouse Operations", L: 4, I: 4, mitigation: "Bin segregation, pack audits, barcode verification and wrong-item monitoring", active: false, status: "Open", cause: "Similar variants co-located; no second scan at packing", trigger: "Wrong-item rate > 0.67 per 1,000 lines", ewi: "Pick mismatches per shift", control: "PickRight two-stage scan" },
  { id: "R2", name: "SKU/Variant Data Gaps", pillar: "HEAT", owner: "Inventory Systems", L: 3, I: 4, mitigation: "Targeted scanning, OMS/WMS reconciliation and mismatch exception alerts", active: false, status: "Open", cause: "System vs physical stock drift", trigger: "Discrepancy > 2% of SKUs", ewi: "Unreconciled bins", control: "StockSync reconciliation" },
  { id: "R3", name: "Returned Stock Recovery Delays", pillar: "REVIVE", owner: "Returns and Inventory Recovery", L: 4, I: 3, mitigation: "A–E grading, value-based recovery routing and return-to-stock monitoring", active: false, status: "Open", cause: "Ungraded backlog; no value-based routing", trigger: "Ageing > policy threshold", ewi: "Returns pending inspection", control: "A–E grading + disposition engine" },
  { id: "R4", name: "COD / Address-related RTO", pillar: "DELIVERRIGHT", owner: "Logistics", L: 4, I: 4, mitigation: "Address validation, OTP confirmation, courier routing and NDR intervention", active: false, status: "Open", cause: "Unvalidated addresses and COD refusals", trigger: "RTO rate > 10% on a lane", ewi: "Open NDRs", control: "Address & OTP validation" },
  { id: "R5", name: "Pickup & Refund Friction", pillar: "REVIVE", owner: "Customer Experience", L: 3, I: 3, mitigation: "Evidence-led return QC, missed-pickup audit and refund-resolution SLAs", active: false, status: "Open", cause: "Missed pickups; disputed QC", trigger: "Missed pickups > 5%", ewi: "Pickup failure alerts", control: "Reverse pickup control" },
  { id: "R6", name: "Premature Pilot Scaling", pillar: "CONTROL", owner: "Transformation PMO and Finance", L: 3, I: 5, mitigation: "Week-13 difference-in-differences decision gate, cost guardrails and investment freeze", active: false, status: "Open", cause: "Pressure to scale before evidence", trigger: "Package approved without gate pass", ewi: "Gate checks not evaluated", control: "Week-13 decision gate" },
];

function seedState(seed: number) {
  const r = rng(seed);
  const bins: Bin[] = [];
  const zones = ["A", "B", "C", "D"];
  zones.forEach((z) => { for (let i = 0; i < 12; i++) { const s = pick(r, SKUS); bins.push({ id: `${z}-${String(i + 1).padStart(2, "0")}`, zone: z, sku: s.sku, size: pick(r, s.sizes), color: pick(r, s.colors), demand: Math.round(r() * 100), stock: 20 + Math.round(r() * 180), exc: Math.round(r() * r() * 8), wrong: Math.round(r() * r() * 5) }); } });
  const stock: StockRow[] = SKUS.flatMap((s) => s.colors.map((c) => { const sys = 100 + Math.round(r() * 400); return { sku: s.sku, variant: `${s.sizes[0]} / ${c}`, system: sys, physical: sys - (r() < 0.3 ? Math.round(r() * 12) : 0), reserved: Math.round(r() * 40), tag: r() < 0.25 ? "High-return" : undefined }; }));
  const returns: Ret[] = Array.from({ length: 10 }, (_, i) => { const s = pick(r, SKUS); return { id: `RT-${5001 + i}`, orderId: `OR-${9000 + i}`, sku: s.sku, cat: s.cat, reason: pick(r, ["Size / fit", "Image mismatch", "Defective", "Wrong item received", "Changed mind", "Description misleading"]), cond: pick(r, ["Unused, tags on", "Worn once", "Minor stain", "Damaged"]), pickup: pick(r, ["Scheduled", "Picked", "Received"] as const), inspect: "Pending", age: Math.round(r() * 30), value: s.price }; });
  const shipments: Ship[] = Array.from({ length: 10 }, (_, i) => ({ id: `SH-${7001 + i}`, orderId: `OR-${9100 + i}`, origin: pick(r, WAREHOUSES), dest: pick(r, CITIES).id, courier: pick(r, COURIERS).id, pay: r() < 0.45 ? "COD" : "Prepaid", addr: "Unchecked", otp: false, confirmed: false, attempts: 0, ndr: "None", stage: "Manifested", outcome: "Pending" }));
  return { bins, stock, returns, shipments };
}

export interface SimState {
  hydrated: boolean;
  scenario: Scenario; env: Env; volume: number; horizon: string; playing: boolean; tick: number;
  orders: Order[]; exceptions: Exc[]; returns: Ret[]; shipments: Ship[]; ledger: Block[]; risks: Risk[]; bins: Bin[]; stock: StockRow[];
  fin: Fin; base: Fin | null; assump: Assump; dispo: DispoAssump; weekly: { w: number; orders: number; exc: number; prevented: number }[];
  exp: Exp; auditDone: boolean; approved: number; gateLog: string[]; release: { pilot: number; expansion: number }; tamper: boolean; savedScenarios: Record<string, Assump>;
  activeFailures: string[]; selectedOrder: string | null;
  set: (p: Partial<SimState>) => void;
  log: (b: Omit<Block, "block" | "ts" | "prev" | "hash" | "verified" | "qr"> & { verified?: boolean }) => void;
  addExc: (e: Omit<Exc, "id" | "status" | "owner"> & { owner?: string }) => void;
  runOrders: (n: number) => void;
  newOrder: () => string;
  pickScan: (id: string, kind: "ok" | "sku" | "size" | "color") => void;
  approvePack: (id: string) => void;
  blockDispatch: (id: string) => void;
  injectFailure: (k: string) => void;
  runRecovery: () => void;
  updateExc: (id: string, p: Partial<Exc>) => void;
  updateRet: (id: string, p: Partial<Ret>, event?: string) => void;
  gradeReturn: (id: string, g: Grade) => void;
  decideReturn: (id: string, r: Route) => void;
  updateShip: (id: string, p: Partial<Ship>, event: string) => void;
  updateRisk: (id: string, p: Partial<Risk>, event?: string) => void;
  expAction: (a: "baseline" | "start" | "inject" | "intervene" | "evaluate") => void;
  approveNext: () => { ok: boolean; reasons: string[] };
  snapshotBase: () => void;
  reset: () => void;
}

const emptyFin: Fin = { orders: 0, prevented: 0, shippedWrong: 0, rto: 0, rtoAvoided: 0, recovery: 0, handling: 0, returns: 0 };
const emptyExp: Exp = { type: "HEAT barcode scanning pilot", status: "Idle", n: 0, tb: 0, cb: 0, ta: 0, ca: 0, incidents: 0, compliance: 0, costDelta: 0, repeatDelta: 0, injected: 0, intervention: false, series: [] };

function initial() {
  const s = seedState(DEFAULT_ASSUMP.seed);
  return {
    hydrated: false, scenario: "Base" as Scenario, env: "Normal" as Env, volume: 100, horizon: "Weekly", playing: false, tick: 0,
    orders: [] as Order[], exceptions: [] as Exc[], returns: s.returns, shipments: s.shipments, ledger: [] as Block[], risks: DEFAULT_RISKS, bins: s.bins, stock: s.stock,
    fin: { ...emptyFin }, base: null, assump: { ...DEFAULT_ASSUMP }, dispo: DEFAULT_DISPO, weekly: [] as SimState["weekly"],
    exp: { ...emptyExp }, auditDone: false, approved: 1, gateLog: [] as string[], release: { pilot: 20, expansion: 0 }, tamper: false, savedScenarios: {} as Record<string, Assump>,
    activeFailures: [] as string[], selectedOrder: null,
  };
}

export const useSim = create<SimState>()(
  persist(
    (set, get) => ({
      ...initial(),
      set: (p) => set(p),
      log: (b) => set((s) => {
        const prev = s.ledger.length ? s.ledger[0].hash : GENESIS;
        const block = (s.ledger[0]?.block ?? 100000) + 1;
        const ts = isoAt(block - 100000 + s.tick);
        const data = JSON.stringify({ block, ts, type: b.type, entity: b.entity, actor: b.actor, rule: b.rule });
        const hash = sha256(prev + data);
        const qr = `QR-${hash.slice(0, 8).toUpperCase()}`;
        return { ledger: [{ ...b, block, ts, prev, hash, verified: b.verified ?? true, qr, data }, ...s.ledger].slice(0, 400) };
      }),
      addExc: (e) => set((s) => ({ exceptions: [{ ...e, id: `EX-${String(3000 + s.exceptions.length + 1)}`, status: "Open", owner: e.owner ?? "Unassigned" }, ...s.exceptions] })),

      newOrder: () => {
        const s = get(); const r = rng(s.assump.seed + s.orders.length * 7 + 1);
        const sk = pick(r, SKUS); const id = `OR-${10001 + s.orders.length}`;
        const o: Order = { id, sku: sk.sku, size: pick(r, sk.sizes), color: pick(r, sk.colors), wh: pick(r, WAREHOUSES), dest: pick(r, CITIES).id, courier: pick(r, COURIERS).id, pay: r() < s.assump.codMix ? "COD" : "Prepaid", status: "Created" };
        set({ orders: [o, ...s.orders].slice(0, 600), selectedOrder: id });
        get().log({ type: "Order created", entity: id, pillar: "HEAT", actor: "OMS", rule: "—", loc: o.wh, sev: "Low" });
        return id;
      },

      runOrders: (n) => {
        const s = get(); const m = multFor(s.scenario); const fx = ENV_FX[s.env];
        const r = rng(s.assump.seed * 31 + s.fin.orders + s.tick);
        const scanOn = s.risks.find((x) => x.id === "R1")!.active || s.approved >= 2;
        const addrOn = s.risks.find((x) => x.id === "R4")!.active;
        const wrongP = (s.assump.wrongPer1000 / 1000) * fx.wrong * 4; // per-order with ~4 lines/order equivalence for demo
        const capture = Math.min(0.98, s.assump.capture * m.capture * (scanOn ? 1.3 : 1));
        const rtoP = s.assump.rtoRate * fx.rto * (addrOn ? 0.7 : 1);
        let prevented = 0, shippedWrong = 0, rto = 0, rtoAvoided = 0, rets = 0;
        const newOrders: Order[] = []; const newShips: Ship[] = [];
        for (let i = 0; i < n; i++) {
          const sk = pick(r, SKUS); const id = `OR-${10001 + s.fin.orders + s.orders.length + i}`;
          const pay = r() < s.assump.codMix ? "COD" as const : "Prepaid" as const;
          let status: Order["status"] = "Delivered";
          if (r() < wrongP) { if (r() < capture) prevented++; else { shippedWrong++; status = "Returned"; } }
          const rr = rtoP * (pay === "COD" ? 1.4 : 0.6);
          if (r() < rr) { if (addrOn && r() < 0.3) rtoAvoided++; else { rto++; status = "RTO"; } }
          else if (status === "Delivered" && r() < s.assump.returnRate * fx.ret) { rets++; status = "Returned"; }
          if (i < 40) newOrders.push({ id, sku: sk.sku, size: sk.sizes[0], color: sk.colors[0], wh: pick(r, WAREHOUSES), dest: pick(r, CITIES).id, courier: pick(r, COURIERS).id, pay, status });
          if (i < 3) newShips.push({ id: `SH-${8001 + s.shipments.length + i}`, orderId: id, origin: pick(r, WAREHOUSES), dest: pick(r, CITIES).id, courier: pick(r, COURIERS).id, pay, addr: "Unchecked", otp: false, confirmed: false, attempts: 0, ndr: "None", stage: "Manifested", outcome: "Pending" });
        }
        const handling = prevented * 12 + shippedWrong * CU.wrongItemEvent * m.event + rto * CU.rtoEvent * m.event;
        const w = s.weekly.length + 1;
        set({
          orders: [...newOrders, ...s.orders].slice(0, 600), shipments: [...newShips, ...s.shipments].slice(0, 60), tick: s.tick + 1,
          fin: { ...s.fin, orders: s.fin.orders + n, prevented: s.fin.prevented + prevented, shippedWrong: s.fin.shippedWrong + shippedWrong, rto: s.fin.rto + rto, rtoAvoided: s.fin.rtoAvoided + rtoAvoided, handling: s.fin.handling + handling, returns: s.fin.returns + rets },
          weekly: [...s.weekly, { w, orders: n, exc: prevented + shippedWrong + rto, prevented }].slice(-26),
        });
        const L = get().log;
        L({ type: `Batch of ${n} orders processed`, entity: `BATCH-${w}`, pillar: "HEAT", actor: "Sim engine", rule: scanOn ? "Two-stage scan active" : "Single scan", loc: "Network", sev: "Low" });
        if (prevented) L({ type: "Mismatch blocked", entity: `BATCH-${w}`, pillar: "HEAT", actor: "PickRight", rule: `${prevented} dispatches blocked`, loc: "Network", sev: "Medium" });
        if (shippedWrong) { L({ type: "Wrong item shipped", entity: `BATCH-${w}`, pillar: "HEAT", actor: "Sim engine", rule: "Escaped verification", loc: "Network", sev: "High", verified: false }); get().addExc({ sev: shippedWrong > 3 ? "High" : "Medium", link: `BATCH-${w}`, loc: "Network", pillar: "HEAT", next: "Investigate escaped mismatches", title: `${shippedWrong} wrong-item deliveries escaped` }); }
        if (rto) L({ type: "Return-to-origin triggered", entity: `BATCH-${w}`, pillar: "DELIVERRIGHT", actor: "Courier feed", rule: `${rto} RTO events`, loc: "Network", sev: rto > n * 0.12 ? "High" : "Medium" });
        if (rto > n * 0.12) get().addExc({ sev: "High", link: `BATCH-${w}`, loc: "Network", pillar: "DELIVERRIGHT", next: "Review COD lanes & NDR", title: `RTO spike: ${rto} of ${n}` });
      },

      pickScan: (id, kind) => {
        const s = get(); const o = s.orders.find((x) => x.id === id); if (!o) return;
        const sk = SKUS.find((x) => x.sku === o.sku)!;
        const p = { sku: o.sku, size: o.size, color: o.color, ok: kind === "ok" };
        if (kind === "sku") p.sku = SKUS.find((x) => x.sku !== o.sku && x.cat !== sk.cat)!.sku;
        if (kind === "size") p.size = sk.sizes.find((z) => z !== o.size) ?? "XL";
        if (kind === "color") p.color = sk.colors.find((c) => c !== o.color) ?? "Grey";
        set({ orders: s.orders.map((x) => (x.id === id ? { ...x, pick: p, status: p.ok ? "Picked" : "Blocked" } : x)) });
        if (p.ok) get().log({ type: "SKU verified (scan 1)", entity: id, pillar: "HEAT", actor: "Picker P-07", rule: "Pick scan match", loc: o.wh, sev: "Low" });
        else {
          set((st) => ({ fin: { ...st.fin, prevented: st.fin.prevented + 1, handling: st.fin.handling + 12 }, bins: st.bins.map((b) => (b.sku === o.sku ? { ...b, exc: b.exc + 1 } : b)) }));
          get().log({ type: "Mismatch blocked", entity: id, pillar: "HEAT", actor: "PickRight", rule: `Wrong ${kind} — dispatch blocked`, loc: o.wh, sev: "High" });
          get().addExc({ sev: "High", link: id, loc: o.wh, pillar: "HEAT", next: "Re-pick correct variant", title: `Wrong ${kind} picked for ${o.sku}` });
        }
      },
      approvePack: (id) => {
        const o = get().orders.find((x) => x.id === id); if (!o) return;
        if (!o.pick?.ok) { get().log({ type: "Pack approval refused", entity: id, pillar: "HEAT", actor: "PickRight", rule: "Scan 1 not matched", loc: o.wh, sev: "Medium" }); return; }
        const sh: Ship = { id: `SH-${9001 + get().shipments.length}`, orderId: id, origin: o.wh, dest: o.dest, courier: o.courier, pay: o.pay, addr: "Unchecked", otp: false, confirmed: false, attempts: 0, ndr: "None", stage: "Manifested", outcome: "Pending" };
        set((s) => ({ orders: s.orders.map((x) => (x.id === id ? { ...x, scan2: true, status: "Dispatched" } : x)), shipments: [sh, ...s.shipments] }));
        get().log({ type: "Item packed (scan 2)", entity: id, pillar: "HEAT", actor: "Packer K-02", rule: "Pack scan match", loc: o.wh, sev: "Low" });
        get().log({ type: "Dispatch approved", entity: id, pillar: "HEAT", actor: "Supervisor", rule: "2/2 scans verified", loc: o.wh, sev: "Low" });
        get().log({ type: "Shipment created", entity: sh.id, pillar: "DELIVERRIGHT", actor: "TMS", rule: `Courier ${sh.courier}`, loc: sh.origin, sev: "Low" });
      },
      blockDispatch: (id) => { set((s) => ({ orders: s.orders.map((x) => (x.id === id ? { ...x, status: "Blocked" } : x)) })); get().log({ type: "Dispatch blocked", entity: id, pillar: "HEAT", actor: "Supervisor", rule: "Manual hold", loc: "—", sev: "Medium" }); },

      injectFailure: (k) => {
        const s = get();
        set({ activeFailures: s.activeFailures.includes(k) ? s.activeFailures : [...s.activeFailures, k] });
        const map: Record<string, [Pillar, Sev, string, string]> = {
          "Picking error surge": ["HEAT", "Critical", "Enable two-stage scan in Zone B", "R1"],
          "Warehouse stock mismatch": ["HEAT", "High", "Run StockSync reconciliation", "R2"],
          "Barcode scanning failure": ["HEAT", "Critical", "Switch to manual pack audit", "R1"],
          "Returned inventory accumulation": ["REVIVE", "High", "Prioritise A/B grading", "R3"],
          "High-risk courier lane failure": ["DELIVERRIGHT", "High", "Re-route to alternate courier", "R4"],
          "COD refusal spike": ["DELIVERRIGHT", "High", "Enforce OTP confirmation on COD", "R4"],
          "Failed return pickups": ["REVIVE", "Medium", "Reschedule & audit pickups", "R5"],
          "Refund dispute escalation": ["REVIVE", "High", "Evidence-led QC review", "R5"],
          "Pilot cost overrun": ["CONTROL", "High", "Freeze Package 2 release", "R6"],
          "Insufficient trial evidence": ["CONTROL", "Medium", "Extend pilot window", "R6"],
        };
        const [pillar, sev, next, rid] = map[k] ?? ["CONTROL", "Medium", "Investigate", "R6"];
        get().addExc({ sev, link: k, loc: "Network", pillar, next, title: k });
        set((st) => ({ risks: st.risks.map((r) => (r.id === rid ? { ...r, L: Math.min(5, r.L + 1), status: "Escalated" } : r)) }));
        if (k === "Warehouse stock mismatch") set((st) => ({ stock: st.stock.map((r, i) => (i % 3 === 0 ? { ...r, physical: r.physical - 9 } : r)) }));
        if (k === "Failed return pickups") set((st) => ({ returns: st.returns.map((r, i) => (i < 3 ? { ...r, pickup: "Missed" } : r)) }));
        if (k === "Returned inventory accumulation") set((st) => ({ returns: st.returns.map((r) => ({ ...r, age: r.age + 10 })) }));
        get().log({ type: "Anomaly detected", entity: k, pillar, actor: "Control Tower", rule: `Pre-mortem → ${rid}`, loc: "Network", sev });
      },
      runRecovery: () => {
        const s = get(); let rec = 0;
        const returns = s.returns.map((r) => {
          if (r.inspect === "Graded" && r.disposition) return r;
          const g: Grade = r.cond.startsWith("Unused") ? "A" : r.cond === "Worn once" ? "B" : r.cond === "Minor stain" ? "C" : "D";
          const best = bestDisposition(r.value * s.assump.recoveryValue, g, s.dispo); rec += Math.max(0, best.net ?? 0);
          return { ...r, grade: g, disposition: best.route, inspect: "Graded" as const, recovered: Math.max(0, best.net ?? 0) };
        });
        set({ returns, fin: { ...s.fin, recovery: s.fin.recovery + rec } });
        get().log({ type: "Recovery workflow batch", entity: "REVIVE", pillar: "REVIVE", actor: "Disposition engine", rule: `Net recovery ₹${rec.toLocaleString()}`, loc: "Returns hub", sev: "Low" });
      },
      updateExc: (id, p) => { set((s) => ({ exceptions: s.exceptions.map((e) => (e.id === id ? { ...e, ...p } : e)) })); if (p.status) get().log({ type: p.status === "Resolved" ? "Exception closed" : p.status === "Escalated" ? "Exception escalated" : `Exception ${p.status.toLowerCase()}`, entity: id, pillar: "CONTROL", actor: "Control Tower", rule: p.status, loc: "—", sev: "Low" }); },
      updateRet: (id, p, event) => { set((s) => ({ returns: s.returns.map((r) => (r.id === id ? { ...r, ...p } : r)) })); if (event) get().log({ type: event, entity: id, pillar: "REVIVE", actor: "Returns desk", rule: "—", loc: "Returns hub", sev: "Low" }); },
      gradeReturn: (id, g) => { get().updateRet(id, { grade: g, inspect: "Graded" }); get().log({ type: `Condition graded ${g}`, entity: id, pillar: "REVIVE", actor: "QC Inspector", rule: "A–E policy v1", loc: "Returns hub", sev: "Low" }); },
      decideReturn: (id, route) => {
        const s = get(); const r = s.returns.find((x) => x.id === id); if (!r?.grade) return;
        const chosen = dispositions(r.value * s.assump.recoveryValue, r.grade, s.dispo).find((x) => x.route === route)?.net ?? 0;
        set({ returns: s.returns.map((x) => (x.id === id ? { ...x, disposition: route, recovered: Math.max(0, chosen) } : x)), fin: { ...s.fin, recovery: s.fin.recovery + Math.max(0, chosen) } });
        if (route === "Restock") set((st) => ({ stock: st.stock.map((row) => (row.sku === r.sku ? { ...row, system: row.system + 1, physical: row.physical + 1 } : row)) }));
        get().log({ type: `${route} action approved`, entity: id, pillar: "REVIVE", actor: "Recovery lead", rule: `Net ₹${chosen}`, loc: "Returns hub", sev: "Low" });
      },
      updateShip: (id, p, event) => { set((s) => ({ shipments: s.shipments.map((x) => (x.id === id ? { ...x, ...p } : x)) })); const sh = get().shipments.find((x) => x.id === id); get().log({ type: event, entity: id, pillar: "DELIVERRIGHT", actor: sh?.courier ?? "TMS", rule: "—", loc: sh?.dest ?? "—", sev: event.includes("RTO") || event.includes("Failed") ? "Medium" : "Low" }); if (p.outcome === "RTO") set((s) => ({ fin: { ...s.fin, rto: s.fin.rto + 1, handling: s.fin.handling + CU.rtoEvent } })); },
      updateRisk: (id, p, event) => { set((s) => ({ risks: s.risks.map((r) => (r.id === id ? { ...r, ...p } : r)) })); if (event) get().log({ type: event, entity: id, pillar: get().risks.find((r) => r.id === id)!.pillar, actor: "Risk owner", rule: "—", loc: "—", sev: "Low" }); },

      expAction: (a) => {
        const s = get(); const r = rng(s.assump.seed + s.exp.series.length * 13 + s.exp.injected); const e = { ...s.exp };
        const base = s.assump.wrongPer1000;
        if (a === "baseline") { e.status = "Baseline"; e.tb = +(base * (0.95 + r() * 0.1)).toFixed(2); e.cb = +(base * (0.95 + r() * 0.1)).toFixed(2); e.series = Array.from({ length: 4 }, (_, i) => ({ w: i + 1, t: +(e.tb + (r() - 0.5)).toFixed(2), c: +(e.cb + (r() - 0.5)).toFixed(2) })); e.incidents = 0; e.n = 0; set({ auditDone: true }); get().log({ type: "Baseline audit completed", entity: "AUDIT-200", pillar: "CONTROL", actor: "PMO", rule: "200-unit inspection", loc: "Pilot zone", sev: "Low" }); }
        if (a === "start") { e.status = "Running"; get().log({ type: "Pilot started", entity: e.type, pillar: "CONTROL", actor: "PMO", rule: "Treatment vs control", loc: "Pilot zone", sev: "Low" }); }
        if (a === "intervene") { e.intervention = true; e.compliance = 0.88; }
        if (a === "inject") { e.injected += 1; }
        if (a === "start" || a === "intervene" || a === "inject") {
          const eff = e.intervention ? 0.55 * multFor(s.scenario).capture : 0;
          for (let k = 0; k < 3; k++) { const w = e.series.length + 1; const t = Math.max(0, e.tb * (1 - eff) + e.injected * 0.6 + (r() - 0.5) * 0.6); const c = Math.max(0, e.cb + (r() - 0.5) * 0.6); e.series = [...e.series, { w, t: +t.toFixed(2), c: +c.toFixed(2) }]; e.n += 4000; e.incidents += Math.round(((t + c) * 4000) / 1000); }
        }
        if (a === "evaluate") {
          const post = e.series.slice(4); if (!post.length) { set({ exp: e }); return; }
          e.ta = +(post.reduce((x, p) => x + p.t, 0) / post.length).toFixed(2); e.ca = +(post.reduce((x, p) => x + p.c, 0) / post.length).toFixed(2);
          e.costDelta = e.intervention ? +(-0.8 + e.injected * 0.6).toFixed(2) : 0.4; e.repeatDelta = e.intervention ? 0.004 - e.injected * 0.004 : -0.002; e.status = "Evaluated";
          get().log({ type: "Scale gate evaluated", entity: e.type, pillar: "CONTROL", actor: "Finance", rule: `DiD ${did(e.tb, e.ta, e.cb, e.ca).toFixed(2)}`, loc: "—", sev: "Low" });
        }
        set({ exp: e });
      },
      approveNext: () => {
        const s = get(); const checks = gateChecks(gateInputs(s)); const ok = canUnlockNext(checks) && s.approved < 3;
        const reasons = checks.filter((c) => c.status !== "Pass").map((c) => `${c.id} ${c.status}: ${c.why}`);
        if (s.approved >= 3) reasons.push("All packages already approved");
        if (ok) { set({ approved: s.approved + 1, gateLog: [`Approved ${PACKAGES[s.approved].id}`, ...s.gateLog] }); get().log({ type: "Package approved", entity: PACKAGES[s.approved].id, pillar: "CONTROL", actor: "Investment committee", rule: "All gate checks passed", loc: "—", sev: "Low" }); }
        else { set({ gateLog: [`Withheld ${PACKAGES[Math.min(2, s.approved)].id}`, ...s.gateLog] }); get().log({ type: "Package withheld", entity: PACKAGES[Math.min(2, s.approved)].id, pillar: "CONTROL", actor: "Smart rule", rule: reasons[0] ?? "—", loc: "—", sev: "Medium" }); }
        return { ok, reasons };
      },
      snapshotBase: () => set((s) => ({ base: { ...s.fin } })),
      reset: () => { const keep = get().savedScenarios; set({ ...initial(), hydrated: true, savedScenarios: keep }); get().log({ type: "Reset", entity: "GENESIS", pillar: "CONTROL", actor: "Admin", rule: "Demo defaults restored", loc: "—", sev: "Low" }); },
    }),
    { name: "threadline-command-v1", storage: createJSONStorage(() => localStorage), skipHydration: true, partialize: (s) => { const { hydrated, playing, ...rest } = s; void hydrated; void playing; return rest as unknown as SimState; } },
  ),
);


export function gateInputs(s: Pick<SimState, "exp" | "auditDone" | "assump" | "scenario">) {
  const e = s.exp; const d = did(e.tb, e.ta, e.cb, e.ca);
  const m = multFor(s.scenario);
  const lines = s.assump.volume * m.volume * 4;
  const net = (-d * lines / 1000) * CU.wrongItemEvent * m.event - 33_000 * m.run * s.assump.scanCost;
  return { evaluated: e.status === "Evaluated", didValue: d, breakEvenReduction: s.assump.breakEven, costDelta: e.costDelta, repeatDelta: e.repeatDelta, incidents: e.incidents, minIncidents: s.assump.minIncidents, auditPassed: s.auditDone, netBenefit: net };
}

export function verifyChain(ledger: Block[]) {
  const chron = [...ledger].reverse(); let breaks = 0;
  for (let i = 0; i < chron.length; i++) {
    const b = chron[i]; const expectPrev = i === 0 ? b.prev : chron[i - 1].hash;
    if (b.prev !== expectPrev || sha256(b.prev + b.data) !== b.hash) breaks++;
  }
  return breaks;
}

export const health = (s: SimState) => {
  const openBy = (p: Pillar) => s.exceptions.filter((e) => e.pillar === p && e.status !== "Resolved");
  const st = (p: Pillar) => { const o = openBy(p); if (o.some((e) => e.sev === "Critical") || o.length > 4) return "Critical"; if (o.length > 0) return "Watch"; return s.fin.orders === 0 && p !== "CONTROL" ? "Awaiting Validation" : "Normal"; };
  return { HEAT: st("HEAT"), REVIVE: st("REVIVE"), DELIVERRIGHT: st("DELIVERRIGHT"), CONTROL: st("CONTROL") };
};
