import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { formatDate, todayISO } from "@/lib/format";

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = profile.full_name.split(" ")[0] || "";

  return (
    <>
      <PageHeader title={`Salut${firstName ? `, ${firstName}` : ""}!`} description={`Azi e ${formatDate(todayISO())}.`} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["De făcut azi", "Follow-up-uri, încasări scadente, filmări, etape cu termen."],
          ["Remindere", "Tot ce e depășit sau vine în următoarele 3 zile."],
          ["Bani luna asta", "Încasat, cheltuit, profit, de încasat, sold curent."],
          ["Proiecte și termene", "Proiecte active pe stadii, întârzieri, deadline-uri."],
        ].map(([title, description]) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">Se completează în Etapa 5.</CardContent>
          </Card>
        ))}
      </div>
      {profile.role === "admin" ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Începe din{" "}
          <Link href="/setari" className="font-medium text-foreground underline underline-offset-4">
            Setări
          </Link>
          : sold de pornire, statusuri, procente.
        </p>
      ) : null}
    </>
  );
}
