"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS } from "@/lib/labels";
import type { UserRole } from "@/lib/types";
import { saveProfileName, setUserRole } from "../actions";

export function ProfileNameForm({ defaultName }: { defaultName: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex max-w-md gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const name = String(new FormData(e.currentTarget).get("full_name") ?? "");
        startTransition(async () => {
          const result = await saveProfileName(name);
          if (result.ok) toast.success("Salvat");
          else toast.error(result.error);
        });
      }}
    >
      <Input name="full_name" defaultValue={defaultName} placeholder="Numele tău" aria-label="Nume" />
      <Button type="submit" variant="outline" disabled={pending}>
        Salvează
      </Button>
    </form>
  );
}

export function RoleSelect({ userId, role, disabled }: { userId: string; role: UserRole; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <Select
      value={role}
      disabled={disabled || pending}
      onValueChange={(value) =>
        startTransition(async () => {
          const result = await setUserRole(userId, value);
          if (result.ok) toast.success("Rol actualizat");
          else toast.error(result.error);
        })
      }
    >
      <SelectTrigger size="sm" className="w-36">
        <SelectValue>{ROLE_LABELS[role]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
