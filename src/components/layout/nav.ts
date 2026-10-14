import {
  CalendarDaysIcon,
  ClapperboardIcon,
  LayoutDashboardIcon,
  PhoneCallIcon,
  SettingsIcon,
  UsersRoundIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/types";

/** Cookie cu starea sidebar-ului (pliat / deschis), citit pe server ca să nu „sară” la încărcare. */
export const SIDEBAR_COOKIE = "sidebar";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
  /** Eticheta scurtă din bara de jos pe telefon. */
  short?: string;
};

export type NavGroup = { label: string | null; items: NavItem[] };

const ALL: UserRole[] = ["admin", "setter", "productie"];

export const NAV_GROUPS: NavGroup[] = [
  { label: null, items: [{ href: "/", label: "Dashboard", short: "Acasă", icon: LayoutDashboardIcon, roles: ALL }] },
  { label: "Vânzări", items: [{ href: "/leaduri", label: "Lead-uri", icon: PhoneCallIcon, roles: ["admin", "setter"] }] },
  {
    label: "Producție",
    items: [
      { href: "/proiecte", label: "Proiecte", icon: ClapperboardIcon, roles: ["admin", "productie"] },
      { href: "/calendar", label: "Calendar", icon: CalendarDaysIcon, roles: ["admin", "productie"] },
      { href: "/actori", label: "Actori", icon: UsersRoundIcon, roles: ["admin", "productie"] },
    ],
  },
  { label: "Bani", items: [{ href: "/financiar", label: "Financiar", icon: WalletIcon, roles: ["admin"] }] },
];

export const SETTINGS_ITEM: NavItem = { href: "/setari", label: "Setări", icon: SettingsIcon, roles: ["admin"] };

export const NAV_ITEMS: NavItem[] = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function navForRole(role: UserRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function groupsForRole(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter((g) => g.items.length);
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function initials(name: string) {
  return (
    name
      .split(/[\s@.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("") || "?"
  );
}
