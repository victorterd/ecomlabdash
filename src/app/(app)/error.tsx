"use client";

import { AlertTriangleIcon, RotateCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-destructive/30 bg-danger-soft p-5">
      <div className="flex items-center gap-2 font-semibold text-destructive">
        <AlertTriangleIcon className="size-5" />
        Pagina nu s-a putut încărca
      </div>
      <p className="text-sm">
        A apărut o eroare pe server. Dacă tocmai ai actualizat aplicația, verifică dacă ai rulat în Supabase toate migrațiile din{" "}
        <code className="rounded bg-card px-1.5 py-0.5 text-xs">supabase/migrations/</code>.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Cod eroare: {error.digest}</p> : null}
      <div>
        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCwIcon /> Încearcă din nou
        </Button>
      </div>
    </div>
  );
}
