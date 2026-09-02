import { weatherForPlace, wmo } from "@/lib/weather";
import { fdate } from "@/lib/format";

export async function WeatherCard({ place, lat, lng, compact = false }: { place: string | null | undefined; lat?: number | null; lng?: number | null; compact?: boolean }) {
  const w = await weatherForPlace(place, lat, lng);
  if (!w) {
    return <div className="card card-body text-[13px] text-ts">Weather unavailable right now.</div>;
  }
  const cur = wmo(w.current.code);
  const severeSoon = w.days.slice(0, 2).some((d) => wmo(d.code).severe || d.rain >= 70);
  return (
    <section className="card overflow-hidden">
      <div className="bg-black text-white p-4 flex items-center gap-4">
        <div className="text-[40px] leading-none">{cur.emoji}</div>
        <div className="min-w-0">
          <div className="text-[11px] font-bold tracking-widest uppercase text-brand truncate">{w.place}</div>
          <div className="text-[28px] font-extrabold leading-none mt-1">{w.current.temp}°<span className="text-[14px] font-semibold text-[#a3a29d] ml-2">feels {w.current.feels}°</span></div>
          <div className="text-[12.5px] text-[#a3a29d] mt-1">{cur.label} · wind {w.current.wind} mph</div>
        </div>
      </div>
      {severeSoon && (
        <div className="px-4 py-2 text-[12px] font-bold bg-warn-soft text-warn border-b border-line2">Heads up: rain or severe weather in the next two days. Plan indoor stops first.</div>
      )}
      {!compact && (
        <div className="grid grid-cols-6 divide-x divide-line2">
          {w.days.map((d, i) => {
            const m = wmo(d.code);
            return (
              <div key={d.date} className="p-2 text-center">
                <div className="text-[10px] font-bold uppercase text-tt">{i === 0 ? "Today" : fdate(d.date, "EEE")}</div>
                <div className="text-[20px] leading-tight my-1">{m.emoji}</div>
                <div className="text-[12px] font-bold tabular">{d.tmax}°<span className="text-tt font-medium"> {d.tmin}°</span></div>
                <div className={`text-[10.5px] tabular ${d.rain >= 50 ? "text-info font-bold" : "text-tt"}`}>{d.rain}%</div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
