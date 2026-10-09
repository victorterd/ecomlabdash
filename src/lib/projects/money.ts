import Decimal from "decimal.js";
import { toDecimal } from "@/lib/format";
import type { Transaction } from "./types";

export type ProjectMoney = {
  contractValue: Decimal;
  installmentsTotal: Decimal;
  received: Decimal;
  toReceive: Decimal;
  costs: Decimal;
  costsPaid: Decimal;
  costsPlanned: Decimal;
  profit: Decimal;
  /** Procent; null dacă valoarea contractului e 0. */
  margin: Decimal | null;
};

export function projectMoney(contractValue: string | number | null | undefined, transactions: Transaction[]): ProjectMoney {
  const value = toDecimal(contractValue);
  let installmentsTotal = new Decimal(0);
  let received = new Decimal(0);
  let costs = new Decimal(0);
  let costsPaid = new Decimal(0);
  for (const t of transactions) {
    const amount = toDecimal(t.amount);
    if (t.type === "income") {
      installmentsTotal = installmentsTotal.plus(amount);
      if (t.status === "realized") received = received.plus(amount);
    } else {
      costs = costs.plus(amount);
      if (t.status === "realized") costsPaid = costsPaid.plus(amount);
    }
  }
  const profit = value.minus(costs);
  return {
    contractValue: value,
    installmentsTotal,
    received,
    toReceive: Decimal.max(value.minus(received), 0),
    costs,
    costsPaid,
    costsPlanned: costs.minus(costsPaid),
    profit,
    margin: value.isZero() ? null : profit.div(value).times(100),
  };
}
