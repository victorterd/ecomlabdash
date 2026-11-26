"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "@/lib/leads/types";
import type { LeadStatus } from "@/lib/types";
import { getLead } from "./actions";
import { FollowUpDialog, type FollowUpSettings } from "./follow-up-dialog";

/** Butonul „✓ am făcut follow-up” din agenda de pe Dashboard. */
export function FollowUpCheck({
  leadId,
  statuses,
  settings,
  today,
}: {
  leadId: string;
  statuses: LeadStatus[];
  settings: FollowUpSettings;
  today: string;
}) {
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await getLead(leadId);
            if (!result.ok) return void toast.error(result.error);
            setLead(result.data);
            setOpen(true);
          })
        }
        className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:border-brand hover:bg-brand-soft hover:text-brand-strong disabled:opacity-50"
        aria-label="Am făcut follow-up"
        title="Am făcut follow-up"
      >
        <CheckIcon className="size-4" />
      </button>
      <FollowUpDialog
        lead={lead}
        open={open}
        onOpenChange={setOpen}
        statuses={statuses}
        settings={settings}
        today={today}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
