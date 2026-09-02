"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/shell/Icon";

export function PhotoUploader({ stopId, kind = "placement" }: { stopId: string; kind?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setBusy(true); setErr(null);
    const supabase = createClient();
    for (const file of files) {
      const blob = await shrink(file);
      const path = `${stopId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
      const { error } = await supabase.storage.from("stop-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) { setErr(error.message); break; }
      const { error: e2 } = await supabase.from("stop_photos").insert({ stop_id: stopId, storage_path: path, kind });
      if (e2) { setErr(e2.message); break; }
    }
    setBusy(false);
    e.target.value = "";
    router.refresh();
  }

  return (
    <div>
      <label className={`btn ${busy ? "opacity-60" : ""}`}>
        <Icon name="camera" size={16} /> {busy ? "Uploading…" : "Add photo"}
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onChange} disabled={busy} />
      </label>
      {err && <p className="text-bad text-[12px] mt-2 font-semibold">{err}</p>}
    </div>
  );
}

/** Downscale to max 1600px JPEG in the browser so uploads stay fast on mobile data. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const max = 1600;
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}
