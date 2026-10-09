export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(error: unknown): { ok: false; error: string } {
  const e = error as { message?: string; code?: string } | null;
  if (e?.code === "23505") return { ok: false, error: "Există deja un element identic." };
  if (e?.code === "23503") return { ok: false, error: "Elementul e folosit în altă parte și nu poate fi șters." };
  if (e?.code === "23514") return { ok: false, error: "Valoare invalidă (verifică sumele și datele)." };
  if (e?.code === "42501") return { ok: false, error: "Nu ai acces la această acțiune." };
  return { ok: false, error: (error instanceof Error ? error.message : e?.message) || "A apărut o eroare." };
}

export function invalid(issues: { message: string }[] | undefined): { ok: false; error: string } {
  return { ok: false, error: issues?.[0]?.message ?? "Date invalide" };
}
