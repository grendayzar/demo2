import { toggleTask, addTask } from "@/app/(app)/routes/actions";
import type { RouteTask } from "@/lib/types";

export function Checklist({ tasks, phase, routeId, stopId, back, title, locked = false }: { tasks: RouteTask[]; phase: "pre" | "post"; routeId: string; stopId?: string | null; back: string; title: string; locked?: boolean }) {
  const list = tasks.filter((t) => t.phase === phase && (stopId ? t.stop_id === stopId : t.stop_id == null)).sort((a, b) => a.sort_order - b.sort_order);
  const doneN = list.filter((t) => t.done).length;
  return (
    <section className="card">
      <div className="card-head">
        <h3>{title}</h3>
        <span className="text-[11.5px] text-tt tabular">{doneN}/{list.length}</span>
      </div>
      <div>
        {list.length === 0 && <div className="px-4 py-3 text-[12.5px] text-tt">No items.</div>}
        {list.map((t) => (
          <form key={t.id} action={toggleTask} className="flex items-center gap-3 px-4 py-2.5 border-b border-line2 last:border-b-0">
            <input type="hidden" name="task_id" value={t.id} />
            <input type="hidden" name="back" value={back} />
            <input type="hidden" name="done" value={t.done ? "false" : "true"} />
            <button type="submit" disabled={locked} aria-label={t.done ? "Mark not done" : "Mark done"} className={`w-6 h-6 rounded-md border-2 grid place-items-center flex-none ${t.done ? "bg-ok border-ok text-white" : "border-line bg-card"}`}>
              {t.done && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12l5 5L20 7" /></svg>}
            </button>
            <span className={`flex-1 text-[13.5px] ${t.done ? "line-through text-tt" : ""}`}>{t.label}{t.required && !t.done && <span className="ml-2 pill pill-warn">required</span>}</span>
          </form>
        ))}
        {!locked && (
          <form action={addTask} className="flex gap-2 p-3 border-t border-line2">
            <input type="hidden" name="route_id" value={routeId} />
            <input type="hidden" name="stop_id" value={stopId ?? ""} />
            <input type="hidden" name="phase" value={phase} />
            <input type="hidden" name="back" value={back} />
            <input name="label" className="input !py-2 !text-[13px]" placeholder="Add a task…" />
            <button className="btn btn-sm">Add</button>
          </form>
        )}
      </div>
    </section>
  );
}
