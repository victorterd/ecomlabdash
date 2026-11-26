import { z } from "zod";
import { parseMoneyInput, parseTimeInput } from "./format";

/** Sumă de bani introdusă de utilizator → string zecimal cu 2 zecimale. */
export const moneyInput = z.union([z.string(), z.number()]).transform((v, ctx) => {
  const parsed = parseMoneyInput(String(v));
  if (parsed === null) {
    ctx.addIssue({ code: "custom", message: "Sumă invalidă (ex. 12.500,00)" });
    return z.NEVER;
  }
  return parsed;
});

/** Procent introdus cu virgulă sau punct („15”, „15,5”). */
export const percentInput = z.preprocess(
  (v) => (typeof v === "string" ? v.trim().replace("%", "").replace(",", ".") : v),
  z.coerce.number({ message: "Procent invalid" }).min(0, "Minim 0%").max(100, "Maxim 100%"),
);

/** Oră în format 24h; acceptă „9”, „930”, „9:30”, „09.30”. */
export const timeInput = z.preprocess(
  (v) => (typeof v === "string" ? (parseTimeInput(v) ?? v) : v),
  z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Oră invalidă (ex. 09:30)"),
);
