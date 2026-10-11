import { cookies } from "next/headers";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SIDEBAR_COOKIE } from "@/components/layout/nav";
import { CommandMenuProvider } from "@/components/layout/command-menu";
import { MobileTabBar, MobileTopBar } from "@/components/layout/mobile-bar";
import { ServiceWorkerRegister } from "@/components/layout/sw-register";
import { requireProfile } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { countDueFollowUps } from "@/lib/leads/queries";
import { countDue } from "@/lib/reminders/collect";
import { getMyReminders } from "@/lib/reminders/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();
  const [reminders, dueFollowUps, cookieStore] = await Promise.all([
    getMyReminders(),
    profile.role === "admin" || profile.role === "setter" ? countDueFollowUps(todayISO()) : 0,
    cookies(),
  ]);
  // Badge-uri: tot ce e restant sau de azi (Dashboard) și follow-up-urile (Lead-uri).
  const badges: Record<string, number> = { "/": countDue(reminders) };
  if (dueFollowUps) badges["/leaduri"] = dueFollowUps;

  return (
    <CommandMenuProvider role={profile.role}>
      <div className="flex min-h-dvh">
        <ServiceWorkerRegister />
        <AppSidebar profile={profile} badges={badges} defaultCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar profile={profile} />
          <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12">{children}</main>
        </div>
        <MobileTabBar profile={profile} badges={badges} />
      </div>
    </CommandMenuProvider>
  );
}
