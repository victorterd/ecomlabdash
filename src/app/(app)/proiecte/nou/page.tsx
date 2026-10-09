import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchStages } from "@/lib/projects/queries";
import { createClient } from "@/lib/supabase/server";
import type { FinanceSettings } from "@/lib/types";
import { ProjectForm, type ProjectPrefill } from "./project-form";

export const metadata = { title: "Proiect nou" };

export default async function NewProjectPage({ searchParams }: PageProps<"/proiecte/nou">) {
  const profile = await requireProfile();
  if (profile.role === "setter") redirect("/");
  const isAdmin = profile.role === "admin";
  const { lead: leadId } = await searchParams;

  const supabase = await createClient();
  const [stages, financeSettings, lead] = await Promise.all([
    fetchStages(),
    isAdmin
      ? supabase.from("finance_settings").select("setter_commission_pct").single<Pick<FinanceSettings, "setter_commission_pct">>()
      : null,
    typeof leadId === "string"
      ? supabase
          .from("leads")
          .select("id, company_name, owner_name, email, phone1, website, called_by, notes")
          .eq("id", leadId)
          .maybeSingle<{
            id: string;
            company_name: string;
            owner_name: string | null;
            email: string | null;
            phone1: string | null;
            website: string | null;
            called_by: string | null;
            notes: string | null;
          }>()
      : null,
  ]);

  const prefill: ProjectPrefill = lead?.data
    ? {
        lead_id: lead.data.id,
        client_name: lead.data.company_name,
        contact_name: lead.data.owner_name,
        contact_email: lead.data.email,
        contact_phone: lead.data.phone1,
        website: lead.data.website,
        setter_name: lead.data.called_by,
        notes: lead.data.notes,
      }
    : {};

  return (
    <>
      <Link href="/proiecte" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Proiecte
      </Link>
      <PageHeader title="Proiect nou" description={lead?.data ? `Precompletat din lead-ul ${lead.data.company_name}.` : undefined} />
      <ProjectForm
        stages={stages}
        isAdmin={isAdmin}
        today={todayISO()}
        defaultCommissionPct={financeSettings?.data?.setter_commission_pct ?? "15"}
        prefill={prefill}
      />
    </>
  );
}
