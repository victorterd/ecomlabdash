import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "Proiecte" };

export default function Page() {
  return (
    <ComingSoon title="Proiecte" stage={3}>
      Kanban pe stadii, termene pe etape, tranșe, costuri și comision.
    </ComingSoon>
  );
}
