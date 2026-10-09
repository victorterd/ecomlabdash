import { redirect } from "next/navigation";
import { MigrationNeeded } from "@/components/layout/migration-needed";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchAppSettings, fetchProjectList, fetchStages } from "@/lib/projects/queries";
import { ProjectsView } from "./projects-view";

export const metadata = { title: "Proiecte" };

export default async function ProjectsPage() {
  const profile = await requireProfile();
  if (profile.role === "setter") redirect("/");
  const isAdmin = profile.role === "admin";

  const [data, stages, settings] = await Promise.all([fetchProjectList(isAdmin), fetchStages(), fetchAppSettings()]);
  if (!data) return <MigrationNeeded title="Proiecte" file="20261011000003_projects.sql" />;

  return (
    <>
      <PageHeader title="Proiecte" />
      <ProjectsView
        initialProjects={data.projects}
        deadlines={data.deadlines}
        finance={data.finance}
        transactions={data.transactions}
        actorCounts={data.actorCounts}
        stages={stages}
        today={todayISO()}
        warningDays={settings.deadline_warning_days}
        isAdmin={isAdmin}
      />
    </>
  );
}
