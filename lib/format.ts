import { format, formatDistanceToNowStrict, parseISO, isToday, isTomorrow, isYesterday } from "date-fns";

export const usd = (n: number | null | undefined, digits = 0) =>
  n == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: digits }).format(Number(n));
export const num = (n: number | null | undefined) => (n == null ? "—" : new Intl.NumberFormat("en-US").format(Number(n)));

export function fdate(d: string | Date | null | undefined, fmt = "EEE, MMM d") {
  if (!d) return "—";
  const dt = typeof d === "string" ? parseISO(d) : d;
  return format(dt, fmt);
}
export function fday(d: string | null | undefined) {
  if (!d) return "—";
  const dt = parseISO(d);
  if (isToday(dt)) return "Today";
  if (isTomorrow(dt)) return "Tomorrow";
  if (isYesterday(dt)) return "Yesterday";
  return format(dt, "EEE, MMM d");
}
export function ftime(d: string | null | undefined) {
  return d ? format(parseISO(d), "h:mm a") : "—";
}
export function frel(d: string | null | undefined) {
  return d ? formatDistanceToNowStrict(parseISO(d), { addSuffix: true }) : "never";
}
export function initials(name: string | null | undefined) {
  return (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}
export function titleCase(s: string | null | undefined) {
  return (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

/** Supabase returns an object for many-to-one joins, but the untyped parser sometimes types it as an array. */
export function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}
