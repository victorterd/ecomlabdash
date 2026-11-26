import { MigrationNeeded } from "@/components/layout/migration-needed";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdmin } from "@/lib/auth";
import { ensureFinanceReady } from "@/lib/finance/queries";
import { FinanceNav } from "./finance-nav";

export default async function FinanceLayout({ children }: LayoutProps<"/financiar">) {
  await requireAdmin();
  // Generează și cheltuielile recurente planificate pentru următoarele 12 luni.
  if (!(await ensureFinanceReady())) return <MigrationNeeded title="Financiar" file="20261012000004_finance.sql" />;
  return (
    <>
      <PageHeader title="Financiar" />
      <FinanceNav />
      {children}
    </>
  );
}
