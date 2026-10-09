import { ComingSoon } from "@/components/layout/coming-soon";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Financiar" };

export default async function Page() {
  await requireAdmin();
  return (
    <ComingSoon title="Financiar" stage={4}>
      Cashflow, plăți de făcut, calcul taxe pe lună și forecast pe 12 luni.
    </ComingSoon>
  );
}
