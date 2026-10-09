import { DatabaseIcon } from "lucide-react";
import { PageHeader } from "./page-header";

/** Afișat când pagina are nevoie de o migrație SQL care nu a fost rulată încă în Supabase. */
export function MigrationNeeded({ title, file }: { title: string; file: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="flex max-w-2xl flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft p-5">
        <div className="flex items-center gap-2 font-semibold">
          <DatabaseIcon className="size-5 text-warning" />
          Baza de date trebuie actualizată
        </div>
        <p className="text-sm">
          Pagina asta folosește tabele noi care nu există încă în Supabase. Rulează o singură dată fișierul de mai jos și reîncarcă pagina:
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>
            Deschide pe GitHub fișierul <code className="rounded bg-background px-1.5 py-0.5 text-xs">supabase/migrations/{file}</code> și
            copiază tot conținutul.
          </li>
          <li>
            În Supabase: <b>SQL Editor → New query</b>, lipește și apasă <b>Run</b>.
          </li>
          <li>Reîncarcă pagina.</li>
        </ol>
      </div>
    </>
  );
}
