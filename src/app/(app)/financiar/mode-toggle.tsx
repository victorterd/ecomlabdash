import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** An + mod (Realizat / Realizat + planificat), prin parametri în URL. */
export function YearModeBar({
  basePath,
  year,
  withPlanned,
  extra,
}: {
  basePath: string;
  year: number;
  withPlanned: boolean;
  extra?: React.ReactNode;
}) {
  const href = (y: number, planned: boolean) => `${basePath}?y=${y}${planned ? "" : "&mod=realizat"}`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={href(year - 1, withPlanned)} aria-label="Anul anterior">
            <ChevronLeftIcon />
          </Link>
        </Button>
        <span className="min-w-14 text-center text-lg font-semibold tabular-nums">{year}</span>
        <Button variant="outline" size="icon-sm" asChild>
          <Link href={href(year + 1, withPlanned)} aria-label="Anul următor">
            <ChevronRightIcon />
          </Link>
        </Button>
      </div>
      <div className="inline-flex rounded-lg bg-muted p-1 text-sm">
        <Link
          href={href(year, false)}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium text-muted-foreground",
            !withPlanned && "bg-card text-foreground shadow-sm",
          )}
        >
          Realizat
        </Link>
        <Link
          href={href(year, true)}
          className={cn(
            "rounded-md px-2.5 py-1 font-medium text-muted-foreground",
            withPlanned && "bg-card text-foreground shadow-sm",
          )}
        >
          Realizat + planificat
        </Link>
      </div>
      {extra}
    </div>
  );
}

export function parseYearMode(params: Record<string, string | string[] | undefined>, currentYear: number) {
  const y = Number(params.y);
  return { year: Number.isInteger(y) && y > 2000 && y < 2100 ? y : currentYear, withPlanned: params.mod !== "realizat" };
}
