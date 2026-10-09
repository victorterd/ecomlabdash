/** Eroare Supabase/Postgres pentru o tabelă sau funcție care nu există (migrație nerulată). */
export function isMissingRelation(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return (
    error.code === "42P01" || // undefined_table (Postgres)
    error.code === "42883" || // undefined_function
    error.code === "PGRST205" || // tabela nu e în schema cache (PostgREST)
    error.code === "PGRST202" || // funcția nu e în schema cache
    /does not exist|could not find the (table|function)/i.test(error.message ?? "")
  );
}
