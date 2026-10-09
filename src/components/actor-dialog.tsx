"use client";

import { useState, useTransition } from "react";
import { Loader2Icon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import { saveActor } from "@/app/(app)/actori/actions";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Actor } from "@/lib/projects/types";
import { cn } from "@/lib/utils";

const UNIT_LABEL = { clip: "per clip", zi: "per zi", proiect: "per proiect" } as const;

export function ActorDialog({
  open,
  onOpenChange,
  actor,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  actor: Actor | null;
  onSaved?: (actor: Actor) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{actor ? actor.name : "Actor nou"}</DialogTitle>
        </DialogHeader>
        {open ? (
          <ActorForm
            actor={actor}
            onSaved={(saved) => {
              onOpenChange(false);
              onSaved?.(saved);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ActorForm({ actor, onSaved }: { actor: Actor | null; onSaved: (actor: Actor) => void }) {
  const [pending, startTransition] = useTransition();
  const [rate, setRate] = useState<string | null>(actor?.rate ?? null);
  const [unit, setUnit] = useState<Actor["rate_unit"]>(actor?.rate_unit ?? "clip");
  const [rating, setRating] = useState<number | null>(actor?.rating ?? null);
  const [active, setActive] = useState(actor?.active ?? true);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const text = (name: string) => String(data.get(name) ?? "");
        const values = {
          name: text("name"),
          phone: text("phone"),
          email: text("email"),
          instagram: text("instagram"),
          rate,
          rate_unit: unit,
          rating,
          notes: text("notes"),
          active,
        };
        setError(null);
        startTransition(async () => {
          const result = await saveActor(actor?.id ?? null, values);
          if (result.ok) {
            toast.success(actor ? "Actor actualizat" : "Actor adăugat");
            onSaved(result.data);
          } else setError(result.error);
        });
      }}
    >
      <div className="grid gap-1.5">
        <Label htmlFor="actor-name">Nume *</Label>
        <Input id="actor-name" name="name" required defaultValue={actor?.name} autoFocus />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="actor-phone">Telefon</Label>
          <Input id="actor-phone" name="phone" defaultValue={actor?.phone ?? ""} inputMode="tel" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="actor-email">Email</Label>
          <Input id="actor-email" name="email" type="email" defaultValue={actor?.email ?? ""} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="actor-instagram">Instagram</Label>
          <Input id="actor-instagram" name="instagram" defaultValue={actor?.instagram ?? ""} placeholder="@cont" />
        </div>
        <div className="grid gap-1.5">
          <Label>Tarif</Label>
          <div className="flex gap-2">
            <MoneyInput value={rate} onCommit={setRate} allowEmpty className="flex-1" aria-label="Tarif" />
            <Select value={unit} onValueChange={(v) => setUnit(v as Actor["rate_unit"])}>
              <SelectTrigger className="w-28">
                <SelectValue>{UNIT_LABEL[unit]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(UNIT_LABEL) as Actor["rate_unit"][]).map((u) => (
                  <SelectItem key={u} value={u}>
                    {UNIT_LABEL[u]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Rating intern</Label>
        <RatingInput value={rating} onChange={setRating} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="actor-notes">Notițe</Label>
        <Textarea
          id="actor-notes"
          name="notes"
          rows={3}
          defaultValue={actor?.notes ?? ""}
          placeholder="Stil, nișe potrivite, disponibilitate…"
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} /> Activ (apare la alocare)
      </label>
      {error ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">{error}</p> : null}
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Salvează
        </Button>
      </DialogFooter>
    </form>
  );
}

export function RatingInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className="rounded p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`${n} stele`}
        >
          <StarIcon className={cn("size-5", value && n <= value ? "fill-warning text-warning" : "text-muted-foreground/40")} />
        </button>
      ))}
    </div>
  );
}

export function RatingStars({ value }: { value: number | null }) {
  if (!value) return <span className="text-muted-foreground/50">—</span>;
  return (
    <span className="inline-flex" aria-label={`${value} din 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} className={cn("size-3.5", n <= value ? "fill-warning text-warning" : "text-muted-foreground/30")} />
      ))}
    </span>
  );
}
