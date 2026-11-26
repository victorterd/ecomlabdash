import { ConstructionIcon } from "lucide-react";
import { PageHeader } from "./page-header";

export function ComingSoon({ title, stage, children }: { title: string; stage: number; children?: React.ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-16 text-center">
        <ConstructionIcon className="size-8 text-muted-foreground" />
        <p className="font-medium">Modulul vine în Etapa {stage}.</p>
        {children ? <div className="max-w-md text-sm text-muted-foreground">{children}</div> : null}
      </div>
    </>
  );
}
