"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/** Shows ?ok=... or ?err=... from the URL, then clears the URL after a moment. Server actions redirect with these. */
export function Toast() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const ok = sp.get("ok");
  const err = sp.get("err");
  const text = ok || err;
  const [dismissed, setDismissed] = useState<string | null>(null);
  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      next.delete("ok"); next.delete("err");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 3500);
    return () => clearTimeout(t);
  }, [text, sp, router, pathname]);
  if (!text || dismissed === text) return null;
  return <button type="button" onClick={() => setDismissed(text)} className={`toast ${err ? "!bg-bad !text-white" : ""}`} role="status">{text}</button>;
}
