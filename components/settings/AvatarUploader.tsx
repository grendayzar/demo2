"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function AvatarUploader({ userId, initial }: { userId: string; initial: string | null }) {
  const [url, setUrl] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    const path = `avatars/${userId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("stop-photos").upload(path, f, { contentType: f.type || "image/jpeg" });
    if (error) { setErr(error.message); setBusy(false); return; }
    const { data } = await supabase.storage.from("stop-photos").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
    setUrl(data?.signedUrl ?? "");
    setBusy(false);
  }
  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name="photo_url" value={url} />
      <span className="avatar avatar-brand" style={{ width: 56, height: 56, fontSize: 18 }}>{url ? <img src={url} alt="" className="w-full h-full object-cover" /> : "📷"}</span>
      <label className="btn btn-sm">{busy ? "Uploading…" : "Change photo"}<input type="file" accept="image/*" className="hidden" onChange={onChange} disabled={busy} /></label>
      {err && <span className="text-bad text-[12px]">{err}</span>}
    </div>
  );
}
