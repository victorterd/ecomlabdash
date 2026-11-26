/** O sarcină din to-do-ul personal. */
export type PersonalTask = {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  done_at: string | null;
  created_at: string;
};

export const TODO_COLUMNS = "id, title, notes, due_date, due_time, done_at, created_at";
