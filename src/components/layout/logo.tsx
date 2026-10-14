import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo complet; varianta cu text alb apare în dark mode sau pe fundal închis (`onDark`). */
export function Logo({ className, onDark }: { className?: string; onDark?: boolean }) {
  return (
    <span className={cn("relative inline-flex h-6 w-auto", className)}>
      {onDark ? (
        <Image src="/brand/logo-dark.png" alt="Ecomlab" width={649} height={96} priority className="h-full w-auto" />
      ) : (
        <>
          <Image src="/brand/logo-light.png" alt="Ecomlab" width={649} height={96} priority className="h-full w-auto dark:hidden" />
          <Image src="/brand/logo-dark.png" alt="Ecomlab" width={649} height={96} priority className="hidden h-full w-auto dark:block" />
        </>
      )}
    </span>
  );
}

/** Doar semnul (cele trei picături), pentru sidebar-ul pliat. */
export function LogoMark({ className }: { className?: string }) {
  return <Image src="/brand/mark.png" alt="Ecomlab" width={243} height={128} priority className={cn("h-4 w-auto", className)} />;
}
