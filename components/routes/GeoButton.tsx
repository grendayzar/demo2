"use client";
import { useState } from "react";

/** Captures the device position into hidden inputs before the form submits. */
export function GeoFields() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "err">("idle");
  function grab() {
    if (!navigator.geolocation) return;
    setState("busy");
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setState("idle"); },
      () => setState("err"),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }
  return (
    <div className="flex items-center gap-2 text-[12px] text-ts">
      <input type="hidden" name="lat" value={pos?.lat ?? ""} />
      <input type="hidden" name="lng" value={pos?.lng ?? ""} />
      <button type="button" className="btn btn-sm" onClick={grab}>{state === "busy" ? "Locating…" : pos ? "Location captured ✓" : "Capture my location"}</button>
      {state === "err" && <span className="text-bad">Location unavailable</span>}
    </div>
  );
}
