"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { NotificationPrefs } from "@/lib/types";
import { saveNotificationPrefs } from "../actions";

type BoolKey = Exclude<keyof NotificationPrefs, "user_id" | "email_to">;

const CHANNELS: { key: BoolKey; label: string; help: string }[] = [
  { key: "email_daily", label: "Email zilnic", help: "Un singur email dimineața cu tot ce ai de făcut." },
  { key: "push_enabled", label: "Notificări push pe telefon", help: "Activezi telefonul după instalarea aplicației (Etapa 5)." },
];

const EVENTS: { key: BoolKey; label: string }[] = [
  { key: "notify_followups", label: "Follow-up-uri de azi și restante" },
  { key: "notify_followup_at_time", label: "Push la ora follow-up-ului" },
  { key: "notify_installments", label: "Tranșe de încasat scadente" },
  { key: "notify_payments", label: "Plăți planificate" },
  { key: "notify_shoots", label: "Filmări azi și mâine" },
  { key: "notify_stage_deadlines", label: "Etape de proiect cu termen" },
];

const DEFAULTS: Omit<NotificationPrefs, "user_id"> = {
  email_daily: true,
  push_enabled: true,
  notify_followups: true,
  notify_followup_at_time: true,
  notify_installments: true,
  notify_payments: true,
  notify_shoots: true,
  notify_stage_deadlines: true,
  email_to: null,
};

export function NotificationToggles({ prefs, defaultEmail }: { prefs: NotificationPrefs | null; defaultEmail: string }) {
  const [, startTransition] = useTransition();
  const [state, setOptimistic] = useOptimistic({ ...DEFAULTS, ...prefs }, (current, patch: Partial<NotificationPrefs>) => ({
    ...current,
    ...patch,
  }));

  function save(patch: Partial<NotificationPrefs>) {
    startTransition(async () => {
      setOptimistic(patch);
      const result = await saveNotificationPrefs(patch);
      if (!result.ok) toast.error(result.error);
    });
  }

  const row = (key: BoolKey, label: string, help?: string) => (
    <div key={key} className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <Label htmlFor={key} className="font-normal">
          {label}
        </Label>
        {help ? <p className="mt-1 text-xs text-muted-foreground">{help}</p> : null}
      </div>
      <Switch id={key} checked={state[key]} onCheckedChange={(checked) => save({ [key]: checked })} />
    </div>
  );

  return (
    <div className="grid gap-4">
      <div className="divide-y rounded-lg border">{CHANNELS.map((c) => row(c.key, c.label, c.help))}</div>
      <div className="divide-y rounded-lg border">{EVENTS.map((e) => row(e.key, e.label))}</div>
      <div className="grid max-w-sm gap-1.5">
        <Label htmlFor="email_to">Trimite emailul la</Label>
        <Input
          id="email_to"
          type="email"
          defaultValue={state.email_to ?? ""}
          placeholder={defaultEmail}
          onBlur={(e) => {
            const value = e.target.value.trim();
            if (value !== (state.email_to ?? "")) save({ email_to: value || null });
          }}
        />
        <p className="text-xs text-muted-foreground">Gol = adresa contului ({defaultEmail}).</p>
      </div>
    </div>
  );
}
