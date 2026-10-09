import { addDays, format, parseISO } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchAllLeads, fetchLeadLists } from "@/lib/leads/queries";
import { redirect } from "next/navigation";
import { LeadsView } from "./leads-view";

export const metadata = { title: "Lead-uri" };

export default async function LeadsPage() {
  const profile = await requireProfile();
  if (profile.role === "productie") redirect("/");

  const [leads, { statuses, sources }] = await Promise.all([fetchAllLeads(), fetchLeadLists()]);
  const today = todayISO();

  return (
    <>
      <PageHeader title="Lead-uri" />
      <LeadsView
        initialLeads={leads}
        statuses={statuses}
        sources={sources}
        today={today}
        weekEnd={format(addDays(parseISO(today), 7), "yyyy-MM-dd")}
      />
    </>
  );
}
