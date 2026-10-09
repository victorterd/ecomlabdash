import { notFound, redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { fetchAppSettings, fetchProjectDetail, fetchProjectOptions, fetchStages } from "@/lib/projects/queries";
import { ProjectDetail } from "./project-detail";

export async function generateMetadata({ params }: PageProps<"/proiecte/[id]">) {
  const { id } = await params;
  const data = await fetchProjectDetail(id, false).catch(() => null);
  return { title: data?.project.client_name ?? "Proiect" };
}

export default async function ProjectPage({ params }: PageProps<"/proiecte/[id]">) {
  const profile = await requireProfile();
  if (profile.role === "setter") redirect("/");
  const isAdmin = profile.role === "admin";
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [data, stages, settings, projectOptions] = await Promise.all([
    fetchProjectDetail(id, isAdmin),
    fetchStages(),
    fetchAppSettings(),
    fetchProjectOptions(),
  ]);
  if (!data) notFound();

  return (
    <ProjectDetail
      key={data.project.id}
      data={data}
      stages={stages}
      today={todayISO()}
      warningDays={settings.deadline_warning_days}
      isAdmin={isAdmin}
      projectOptions={projectOptions}
    />
  );
}
