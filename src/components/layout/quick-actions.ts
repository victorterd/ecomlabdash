import { CalendarPlusIcon, ClapperboardIcon, PhoneCallIcon, ReceiptIcon, type LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/types";

export type QuickAction = { label: string; href: string; icon: LucideIcon; roles: UserRole[]; hint?: string };

/** Acțiuni rapide („+” și ⌘K). Paginile țintă deschid formularul din parametrul `nou`. */
export const QUICK_ACTIONS: QuickAction[] = [
  { label: "Lead nou", href: "/leaduri?nou=1", icon: PhoneCallIcon, roles: ["admin", "setter"] },
  { label: "Proiect nou", href: "/proiecte/nou", icon: ClapperboardIcon, roles: ["admin", "productie"] },
  { label: "Cheltuială", href: "/financiar/tranzactii?nou=cheltuiala", icon: ReceiptIcon, roles: ["admin"] },
  { label: "Încasare", href: "/financiar/tranzactii?nou=incasare", icon: ReceiptIcon, roles: ["admin"] },
  { label: "Zi de filmare", href: "/calendar?nou=1", icon: CalendarPlusIcon, roles: ["admin", "productie"] },
];

export const quickActionsFor = (role: UserRole) => QUICK_ACTIONS.filter((a) => a.roles.includes(role));
