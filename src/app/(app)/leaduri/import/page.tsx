import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { fetchLeadLists } from "@/lib/leads/queries";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import lead-uri" };

export default async function ImportPage() {
  const profile = await requireProfile();
  if (profile.role === "productie") redirect("/");
  const { statuses, sources } = await fetchLeadLists();

  return (
    <>
      <Link href="/leaduri" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Lead-uri
      </Link>
      <PageHeader
        title="Import lead-uri"
        description="Din CSV sau Excel. Duplicatele (același website, email sau telefon) sunt detectate înainte de import."
      />
      <ImportWizard statuses={statuses} sources={sources} />
    </>
  );
}
