import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/** Redirect back with a toast message. Server actions call these after their work. */
export function done(path: string, msg: string): never {
  revalidatePath(path);
  redirect(`${path}${path.includes("?") ? "&" : "?"}ok=${encodeURIComponent(msg)}`);
}
export function fail(path: string, msg: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}err=${encodeURIComponent(msg)}`);
}
export const str = (fd: FormData, k: string) => (fd.get(k)?.toString() ?? "").trim();
export const numOrNull = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
export const bool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const list = (fd: FormData, k: string) => fd.getAll(k).map((v) => v.toString()).filter(Boolean);
