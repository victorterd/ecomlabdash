"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/date-field";
import type { ActionResult } from "./actions";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "number" | "time" | "date" | "email";
  defaultValue: string;
  suffix?: string;
  help?: string;
  inputMode?: "decimal" | "numeric" | "text" | "email";
};

/** Formular simplu de setări cu buton „Salvează”. */
export function SettingsForm({
  fields,
  action,
}: {
  fields: FormField[];
  action: (values: Record<string, string>) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [dirty, setDirty] = useState(false);

  return (
    <form
      className="grid gap-4 rounded-lg border p-4"
      onChange={() => setDirty(true)}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const values = Object.fromEntries(fields.map((f) => [f.name, String(data.get(f.name) ?? "")]));
        startTransition(async () => {
          const result = await action(values);
          if (result.ok) {
            toast.success("Salvat");
            setDirty(false);
          } else toast.error(result.error);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <div key={f.name} className="grid content-start gap-1.5">
            <Label htmlFor={f.name}>{f.label}</Label>
            <div className="flex items-center gap-2">
              {f.type === "date" ? (
                <SettingsDateField id={f.name} name={f.name} defaultValue={f.defaultValue} onChange={() => setDirty(true)} />
              ) : (
                <Input
                  id={f.name}
                  name={f.name}
                  type={f.type === "number" || f.type === "time" ? "text" : (f.type ?? "text")}
                  inputMode={f.inputMode ?? (f.type === "number" ? "decimal" : f.type === "time" ? "numeric" : undefined)}
                  placeholder={f.type === "time" ? "hh:mm" : undefined}
                  defaultValue={f.defaultValue}
                  required
                />
              )}
              {f.suffix ? <span className="shrink-0 text-sm text-muted-foreground">{f.suffix}</span> : null}
            </div>
            {f.help ? <p className="text-xs text-muted-foreground">{f.help}</p> : null}
          </div>
        ))}
      </div>
      <div>
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? <Loader2Icon className="animate-spin" /> : null}
          Salvează
        </Button>
      </div>
    </form>
  );
}

function SettingsDateField({ id, name, defaultValue, onChange }: { id: string; name: string; defaultValue: string; onChange: () => void }) {
  const [value, setValue] = useState<string | null>(defaultValue || null);
  return (
    <DateField
      id={id}
      name={name}
      value={value}
      clearable={false}
      className="w-full"
      onChange={(v) => {
        setValue(v);
        onChange();
      }}
    />
  );
}
