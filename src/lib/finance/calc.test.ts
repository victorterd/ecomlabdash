import assert from "node:assert/strict";
import { test } from "node:test";
import { computePnL, monthlyTotals, monthRange, balanceAt } from "./calc";
import Decimal from "decimal.js";
const D = (v: number) => new Decimal(v);

test("calcul lunar: impozite, sold, planificat", () => {
  const r = { profitTaxPct: 16, dividendTaxPct: 16 };
  let p = computePnL(D(10000), D(3000), D(1000), r);
  assert.equal(p.profitGeneral.toString(), "7000");
  assert.equal(p.profitAccounting.toString(), "6000");
  assert.equal(p.profitTax.toString(), "960");
  assert.equal(p.profitAfterTax.toString(), "5040");
  assert.equal(p.dividendTax.toString(), "806.4");
  assert.equal(p.net.toString(), "4233.6");
  p = computePnL(D(1000), D(3000), D(0), r);
  assert.equal(p.profitTax.toString(), "0");
  assert.equal(p.dividendTax.toString(), "0");
  assert.equal(p.net.toString(), "-2000");
  assert.deepEqual(monthRange("2026-11", 3), ["2026-11", "2026-12", "2027-01"]);
  const tx = [
    { type: "income", amount: "5000.10", status: "realized", scope: "business", effective_date: "2026-10-05" },
    { type: "expense", amount: "1000", status: "realized", scope: "business", effective_date: "2026-10-06" },
    { type: "expense", amount: "200", status: "realized", scope: "personal", effective_date: "2026-10-07" },
    { type: "income", amount: "3000", status: "planned", scope: "business", effective_date: "2026-11-15" },
    { type: "income", amount: "999", status: "realized", scope: "business", effective_date: "2026-09-30" },
  ] as const;
  const open = { balance: "1000", date: "2026-10-01" };
  const real = monthlyTotals(tx as never, monthRange("2026-09", 3), false, r, open);
  assert.equal(real.months[0]!.revenue.toString(), "999");
  assert.ok(real.months[0]!.endBalance.isNaN());
  assert.equal(real.months[1]!.endBalance.toString(), "4800.1");
  assert.equal(real.months[2]!.revenue.toString(), "0");
  assert.equal(real.months[2]!.endBalance.toString(), "4800.1");
  const plan = monthlyTotals(tx as never, monthRange("2026-09", 3), true, r, open);
  assert.equal(plan.months[2]!.endBalance.toString(), "7800.1");
  assert.equal(plan.year.revenue.toString(), "8999.1");
  assert.equal(balanceAt(tx as never, "2026-10-31", false, open).toString(), "4800.1");
});
