import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Flame, RotateCcw, Truck, Map, RadioTower, Landmark, LineChart, Grid3x3, FlaskConical, BookOpen, ShieldCheck, Play, Pause, StepForward, RefreshCw, Sparkles, Menu, X } from "lucide-react";
import { useSim, type Env } from "@/lib/sim/store";
import type { Scenario } from "@/lib/sim/model";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DemoDialog } from "./Demo";
import { toast } from "sonner";

export const NAV = [
  { to: "/", n: "01", label: "Command Overview", icon: LayoutDashboard },
  { to: "/heat", n: "02", label: "HEAT Operations", icon: Flame },
  { to: "/revive", n: "03", label: "REVIVE Recovery", icon: RotateCcw },
  { to: "/deliverright", n: "04", label: "DELIVERRIGHT", icon: Truck },
  { to: "/map", n: "05", label: "India Logistics Map", icon: Map },
  { to: "/control-tower", n: "06", label: "Pre-Mortem Control Tower", icon: RadioTower },
  { to: "/capital", n: "07", label: "Capital & Investment Gates", icon: Landmark },
  { to: "/finance", n: "08", label: "Financial Intelligence", icon: LineChart },
  { to: "/risk", n: "09", label: "Risk Heat Map", icon: Grid3x3 },
  { to: "/lab", n: "10", label: "Experimentation Lab", icon: FlaskConical },
  { to: "/evidence", n: "11", label: "Evidence & Model Settings", icon: BookOpen },
  { to: "/ledger", n: "12", label: "ChainTrust Ledger", icon: ShieldCheck },
] as const;

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid place-items-center size-9 rounded-lg bg-forest text-primary-foreground"><svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M12 6v12M7 12h10" strokeLinecap="round" /></svg></div>
      <div className="leading-tight"><div className="font-display font-bold tracking-wide text-[13px]">THREADLINE</div><div className="font-display text-[10px] tracking-[0.25em] text-primary font-semibold">COMMAND</div></div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const s = useSim();
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState(false);

  useEffect(() => { useSim.persist.rehydrate(); useSim.setState({ hydrated: true }); }, []);
  useEffect(() => { const h = () => setDemo(true); window.addEventListener("tl-demo", h); return () => window.removeEventListener("tl-demo", h); }, []);
  useEffect(() => {
    if (!s.playing) return;
    const t = setInterval(() => useSim.getState().runOrders(Math.max(10, Math.round(useSim.getState().volume / 10))), 1500);
    return () => clearInterval(t);
  }, [s.playing]);
  useEffect(() => setOpen(false), [path]);

  const current = NAV.find((n) => n.to === path) ?? NAV[0];

  return (
    <div className="min-h-screen flex w-full">
      <aside className={cn("fixed inset-y-0 left-0 z-40 w-64 bg-sidebar border-r flex flex-col transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
        <div className="h-16 px-5 flex items-center justify-between border-b"><Logo /><button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu"><X className="size-5" /></button></div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV.map((n) => {
            const active = n.to === path;
            return (
              <Link key={n.to} to={n.to} className={cn("flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-display font-medium transition-colors", active ? "bg-sage text-forest" : "text-foreground/80 hover:bg-muted")}>
                <span className={cn("text-[10px] w-4 tabular-nums", active ? "text-primary" : "text-muted-foreground")}>{n.n}</span>
                <n.icon className={cn("size-4", active ? "text-primary" : "")} />
                <span className="truncate">{n.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <Button className="w-full font-display" onClick={() => setDemo(true)}><Sparkles className="size-4" /> Run End-to-End Demo</Button>
          <p className="text-[10px] text-muted-foreground mt-2 text-center">Prevent Errors. Recover Value. Deliver Right.</p>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 lg:pl-64 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b">
          <div className="flex flex-wrap items-center gap-2 px-4 lg:px-6 py-2.5">
            <button className="lg:hidden mr-1" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="size-5" /></button>
            <div className="text-xs text-muted-foreground mr-auto"><span>Threadline Command</span> <span className="mx-1">/</span> <span className="text-foreground font-medium">{current.label}</span></div>
            <Sel label="Scenario" value={s.scenario} items={["Conservative", "Base", "Upside", "Custom"]} onChange={(v) => s.set({ scenario: v as Scenario })} />
            <Sel label="Environment" value={s.env} items={["Normal", "Peak Demand", "Warehouse Disruption", "Courier Disruption", "Return Surge"]} onChange={(v) => { s.set({ env: v as Env }); s.log({ type: `Environment → ${v}`, entity: "ENV", pillar: "CONTROL", actor: "Admin", rule: "—", loc: "—", sev: "Low" }); }} />
            <Sel label="Volume" value={String(s.volume)} items={["100", "500", "1000", "2500"]} onChange={(v) => s.set({ volume: Number(v) })} />
            <Sel label="Horizon" value={s.horizon} items={["Daily", "Weekly", "Monthly", "26-week programme", "24-month financial model"]} onChange={(v) => s.set({ horizon: v })} />
            <div className="flex items-center rounded-lg border">
              <Button size="icon" variant="ghost" className="size-8" aria-label={s.playing ? "Pause" : "Play"} onClick={() => s.set({ playing: !s.playing })}>{s.playing ? <Pause className="size-4" /> : <Play className="size-4" />}</Button>
              <Button size="icon" variant="ghost" className="size-8" aria-label="Step" onClick={() => s.runOrders(s.volume)}><StepForward className="size-4" /></Button>
              <Button size="icon" variant="ghost" className="size-8" aria-label="Reset" onClick={() => { s.reset(); toast.success("Reset to demonstration defaults"); }}><RefreshCw className="size-4" /></Button>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-sage px-3 py-1 text-[11px] font-display font-semibold text-forest">
              <span className={cn("size-2 rounded-full bg-primary", s.playing && "pulse-dot")} />{s.scenario} · {s.env}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6 max-w-[1800px] w-full mx-auto">{children}</main>
        <footer className="px-6 py-3 border-t text-[11px] text-muted-foreground flex flex-wrap gap-x-6 gap-y-1">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Digital twin connected</span>
          <span>{s.fin.orders.toLocaleString()} orders · {s.ledger.length} ledger blocks</span>
          <span>CU = model cost unit · * = model assumption or output</span>
        </footer>
      </div>
      <DemoDialog open={demo} onOpenChange={setDemo} />
    </div>
  );
}

function Sel({ label, value, items, onChange }: { label: string; value: string; items: string[]; onChange: (v: string) => void }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs w-auto gap-1.5 min-w-[110px]" aria-label={label}><span className="text-muted-foreground">{label}:</span><SelectValue /></SelectTrigger>
      <SelectContent>{items.map((i) => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}</SelectContent>
    </Select>
  );
}
