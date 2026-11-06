import { describe, it, expect } from "vitest";
import { cumulativeBudget, did, gateChecks, canUnlockNext, SCENARIO_MULT, bestDisposition, DEFAULT_DISPO, riskScore } from "./model";

describe("Threadline model rules", () => {
  it("cumulative budget through P3 is INR 3.90 lakh setup and 1.44 lakh/month", () => {
    expect(cumulativeBudget(3)).toEqual({ setup: 3.9, recurring: 1.44 });
  });
  it("conservative scenario multipliers", () => {
    expect(SCENARIO_MULT.Conservative).toEqual({ capture: 0.5, run: 1.3, event: 0.8, volume: 0.8, setup: 1.3 });
  });
  it("upside scenario multipliers", () => {
    expect(SCENARIO_MULT.Upside).toEqual({ capture: 1.25, run: 0.9, event: 1.2, volume: 1.1, setup: 0.9 });
  });
  it("difference-in-differences formula", () => {
    expect(did(5, 2, 5, 4.5)).toBeCloseTo(-2.5);
  });
  it("next package stays locked when evidence is insufficient", () => {
    const c = gateChecks({ evaluated: true, didValue: -3, breakEvenReduction: 1, costDelta: -1, repeatDelta: 0, incidents: 3, minIncidents: 30, auditPassed: true, netBenefit: 100 });
    expect(canUnlockNext(c)).toBe(false);
  });
  it("next package unlocks only when all checks pass", () => {
    const c = gateChecks({ evaluated: true, didValue: -3, breakEvenReduction: 1, costDelta: -1, repeatDelta: 0, incidents: 40, minIncidents: 30, auditPassed: true, netBenefit: 100 });
    expect(canUnlockNext(c)).toBe(true);
  });
  it("grade E items can only be recycled", () => {
    expect(bestDisposition(1000, "E", DEFAULT_DISPO).route).toBe("Recycle");
  });
  it("risk score is likelihood × impact", () => {
    expect(riskScore(4, 5)).toBe(20);
  });
});
