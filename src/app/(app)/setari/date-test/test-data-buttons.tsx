"use client";

import { useTransition } from "react";
import { Loader2Icon, SparklesIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTestData, generateTestData } from "./actions";

export function TestDataButtons({ hasData }: { hasData: boolean }) {
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>) =>
    startTransition(async () => {
      const result = await action();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={pending} onClick={() => run(generateTestData)}>
        {pending ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
        Generează date de test
      </Button>
      <Button
        variant="outline"
        className="text-destructive hover:bg-destructive/10"
        disabled={pending || !hasData}
        onClick={() => confirm("Ștergi toate datele de test?") && run(deleteTestData)}
      >
        <Trash2Icon /> Șterge datele de test
      </Button>
    </div>
  );
}
