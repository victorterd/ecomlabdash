import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { requireProfile } from "@/lib/auth";
import Link from "next/link";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  // Badge-urile de remindere (follow-up-uri restante etc.) se adaugă în Etapele 2 și 5.
  const badges: Record<string, number> = {};

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 lg:flex">
        <Link href="/" className="px-3 pt-2 pb-6">
          <Logo className="h-5" />
        </Link>
        <SidebarNav role={profile.role} badges={badges} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-5">
          <MobileNav role={profile.role} badges={badges} />
          <Link href="/" className="lg:hidden">
            <Logo className="h-4" />
          </Link>
          <div className="flex-1" />
          <ThemeToggle savedTheme={profile.theme} />
          <UserMenu profile={profile} />
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-5 sm:px-5 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}
