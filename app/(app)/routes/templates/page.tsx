import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { PageHead, Card, Empty, BackLink, Pill } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { Icon } from "@/components/shell/Icon";
import { startFromTemplate } from "../actions";
import { todayISO } from "@/lib/format";

export const metadata = { title: "Routine routes" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function TemplatesPage() {
  const { supabase, user } = await requireUser();
  const { data: templates } = await supabase.from("route_templates").select("*, stops:route_template_stops(id), rep:profiles!route_templates_rep_id_fkey(full_name)").eq("is_active", true).order("weekday").order("name");
  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/routes" label="Routes" />
      <PageHead title="Routine routes" sub="Saved stop lists you run again and again. Start today's route from one in a tap." actions={<Link href="/routes/templates/new" className="btn btn-pri"><Icon name="plus" size={16} /> New routine route</Link>} />
      {!templates || templates.length === 0 ? (
        <Empty title="No routine routes yet" hint="Build one once with your regular stops in driving order." action={<Link href="/routes/templates/new" className="btn btn-pri">Create routine route</Link>} />
      ) : (
        <div className="grid-auto">
          {templates.map((t) => (
            <div key={t.id} className="card p-4 flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2"><Link href={`/routes/templates/${t.id}`} className="font-extrabold text-[15px] hover:underline">{t.name}</Link>{t.rep_id == null && <Pill tone="info">Shared</Pill>}</div>
                <div className="text-[12px] text-tt mt-0.5">{t.stops?.length ?? 0} stops · {t.weekday != null ? `${DAYS[t.weekday]}s` : "any day"} · {t.cadence}{t.rep && t.rep_id !== user.id ? ` · ${t.rep.full_name}` : ""}</div>
                {t.notes && <p className="text-[12.5px] text-ts mt-2">{t.notes}</p>}
              </div>
              <div className="flex gap-2 mt-auto">
                <form action={startFromTemplate}><input type="hidden" name="template_id" value={t.id} /><input type="hidden" name="route_date" value={todayISO()} /><button className="btn btn-pri btn-sm"><Icon name="flag" size={14} /> Start today</button></form>
                <Link href={`/routes/new?template=${t.id}`} className="btn btn-sm">Plan for a day</Link>
                <Link href={`/routes/templates/${t.id}`} className="btn btn-ghost btn-sm">Edit</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
