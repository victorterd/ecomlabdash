import { addDays, format, parseISO } from "date-fns";
import { MigrationNeeded } from "@/components/layout/migration-needed";
import { PageHeader } from "@/components/layout/page-header";
import { requireProfile } from "@/lib/auth";
import { isMissingRelation } from "@/lib/db-errors";
import { todayISO } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { TODO_COLUMNS, type PersonalTask } from "@/lib/todo/types";
import { TodoView } from "./todo-view";

export const metadata = { title: "To-do" };

export default async function TodoPage() {
  await requireProfile();
  const today = todayISO();
  const supabase = await createClient();
  // Tot ce e nefăcut + ce ai bifat în ultimele 30 de zile.
  const since = format(addDays(parseISO(today), -30), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("personal_tasks")
    .select(TODO_COLUMNS)
    .or(`done_at.is.null,done_at.gte.${since}`)
    .order("due_date", { nullsFirst: false })
    .order("due_time", { nullsFirst: true })
    .order("created_at")
    .returns<PersonalTask[]>();
  if (error && isMissingRelation(error)) return <MigrationNeeded title="To-do" file="20261031000010_personal_tasks.sql" />;

  return (
    <>
      <PageHeader
        title="To-do"
        description="Lucrurile tale: reclamele agenției, campanii, orice ai de programat. Ce nu bifezi trece pe ziua următoare."
      />
      <TodoView initialTasks={data ?? []} today={today} />
    </>
  );
}
