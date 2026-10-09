import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo complet; varianta cu text alb apare automat în dark mode. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex h-6 w-auto", className)}>
      <Image src="/brand/logo-light.png" alt="Ecomlab" width={649} height={96} priority className="h-full w-auto dark:hidden" />
      <Image src="/brand/logo-dark.png" alt="Ecomlab" width={649} height={96} priority className="hidden h-full w-auto dark:block" />
    </span>
  );
}
