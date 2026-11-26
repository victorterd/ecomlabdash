import { redirect } from "next/navigation";
import { MigrationNeeded } from "@/components/layout/migration-needed";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchAppSettings, fetchProjectList, fetchServices } from "@/lib/projects/queries";
import { ProjectsView } from "./projects-view";

export const metadata = { title: "Proiecte" };

export default async function ProjectsPage() {
  const profile = await requireProfile();
  if (profile.role === "setter") redirect("/");
  const isAdmin = profile.role === "admin";

  const [data, services, settings] = await Promise.all([fetchProjectList(isAdmin), fetchServices(), fetchAppSettings()]);
  if (!data) return <MigrationNeeded title="Proiecte" file="20261011000003_projects.sql" />;
  if (!services) return <MigrationNeeded title="Proiecte" file="20261014000006_services.sql" />;

  return (
    <>
      <PageHeader title="Proiecte" />
      <ProjectsView
        initialProjects={data.projects}
        tasks={data.tasks}
        projectServices={data.projectServices}
        finance={data.finance}
        transactions={data.transactions}
        actorCounts={data.actorCounts}
        services={services}
        today={todayISO()}
        warningDays={settings.deadline_warning_days}
        isAdmin={isAdmin}
      />
    </>
  );
}
