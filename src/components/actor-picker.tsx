"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { fold } from "@/lib/leads/normalize";
import type { Actor } from "@/lib/projects/types";

/** Listă de actori bifabili, cu căutare. */
export function ActorPicker({
  actors,
  value,
  onChange,
  highlight = [],
}: {
  actors: Actor[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Actori recomandați (ex. alocați proiectului) — apar primii. */
  highlight?: string[];
}) {
  const [search, setSearch] = useState("");
  const visible = actors
    .filter((a) => (a.active || value.includes(a.id)) && fold(a.name).includes(fold(search)))
    .sort((a, b) => Number(highlight.includes(b.id)) - Number(highlight.includes(a.id)) || a.name.localeCompare(b.name, "ro"));

  return (
    <div className="rounded-md border">
      {actors.length > 6 ? (
        <div className="border-b p-1.5">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută actor…" className="h-8" />
        </div>
      ) : null}
      <div className="max-h-44 overflow-y-auto p-1">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">Niciun actor. Adaugă-i din pagina Actori.</p>
        ) : null}
        {visible.map((a) => (
          <label key={a.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
            <Checkbox
              checked={value.includes(a.id)}
              onCheckedChange={(checked) => onChange(checked === true ? [...value, a.id] : value.filter((id) => id !== a.id))}
            />
            <span className="flex-1">{a.name}</span>
            {highlight.includes(a.id) ? <span className="text-[11px] text-muted-foreground">pe proiect</span> : null}
          </label>
        ))}
      </div>
    </div>
  );
}
