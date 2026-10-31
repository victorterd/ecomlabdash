"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon } from "lucide-react";
import { toast } from "sonner";
import { updateTodo } from "./actions";

/** Bifează o sarcină din to-do direct din agenda de pe Dashboard. */
export function TodoCheck({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await updateTodo(id, { done: true });
          if (!result.ok) return void toast.error(result.error);
          toast.success(`Bifat: ${title}`);
          router.refresh();
        })
      }
      className="flex size-8 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:border-brand hover:bg-brand-soft hover:text-brand-strong disabled:opacity-50"
      aria-label={`Bifează ${title}`}
      title="Bifează"
    >
      <CheckIcon className="size-4" />
    </button>
  );
}
