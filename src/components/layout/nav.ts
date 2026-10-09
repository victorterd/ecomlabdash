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

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: UserRole[];
};

const ALL: UserRole[] = ["admin", "setter", "productie"];

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon, roles: ALL },
  { href: "/leaduri", label: "Lead-uri", icon: PhoneCallIcon, roles: ["admin", "setter"] },
  { href: "/proiecte", label: "Proiecte", icon: ClapperboardIcon, roles: ["admin", "productie"] },
  { href: "/calendar", label: "Calendar", icon: CalendarDaysIcon, roles: ["admin", "productie"] },
  { href: "/actori", label: "Actori", icon: UsersRoundIcon, roles: ["admin", "productie"] },
  { href: "/financiar", label: "Financiar", icon: WalletIcon, roles: ["admin"] },
  { href: "/setari", label: "Setări", icon: SettingsIcon, roles: ["admin"] },
];

export function navForRole(role: UserRole) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
