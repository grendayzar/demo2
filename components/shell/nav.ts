import type { UserRole } from "@/lib/types";

export interface NavItem { href: string; label: string; icon: string; group: string; roles?: UserRole[] }

export const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home", group: "Field" },
  { href: "/routes", label: "Routes", icon: "route", group: "Field" },
  { href: "/businesses", label: "Stops", icon: "store", group: "Field" },
  { href: "/inventory", label: "Inventory", icon: "boxes", group: "Field" },
  { href: "/contracts", label: "Contracts", icon: "file-signature", group: "Field" },
  { href: "/territory", label: "Territory", icon: "map", group: "Manage", roles: ["territory_manager", "admin", "super_admin"] },
  { href: "/team", label: "Team activity", icon: "users", group: "Manage", roles: ["territory_manager", "admin", "super_admin"] },
  { href: "/leads", label: "Leads", icon: "inbox", group: "Manage", roles: ["territory_manager", "admin", "super_admin"] },
  { href: "/directory", label: "Directory", icon: "contact", group: "Company" },
  { href: "/docs", label: "Manuals & training", icon: "book", group: "Company" },
  { href: "/admin", label: "Admin", icon: "settings", group: "Company", roles: ["admin", "super_admin"] },
  { href: "/settings", label: "My profile", icon: "user", group: "Company" },
];

export function navFor(role: UserRole) {
  return NAV.filter((n) => !n.roles || n.roles.includes(role));
}
