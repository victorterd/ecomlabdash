import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" className={cn("animate-pulse rounded-lg bg-muted", className)} {...props} />;
}

/** Schelet generic de pagină: titlu, rând de carduri, tabel. */
function PageSkeleton({ withHeader = true, tiles = 4 }: { withHeader?: boolean; tiles?: number }) {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Se încarcă">
      {withHeader ? (
        <div className="grid gap-2">
          <Skeleton className="h-3.5 w-40" />
          <Skeleton className="h-8 w-64" />
        </div>
      ) : null}
      {tiles ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: tiles }, (_, i) => (
            <div key={i} className="surface grid gap-3 p-5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-20" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="surface grid gap-3 p-5">
        <Skeleton className="h-5 w-48" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3.5" style={{ width: `${60 - i * 4}%` }} />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export { Skeleton, PageSkeleton };
