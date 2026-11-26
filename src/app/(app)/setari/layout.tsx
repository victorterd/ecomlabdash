import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: LayoutProps<"/setari">) {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Setări" />
      <SettingsNav />
      <div className="grid max-w-5xl gap-8">{children}</div>
    </>
  );
}
