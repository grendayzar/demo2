import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isAdmin } from "@/lib/auth";
import { PageHead, Card, Pill, Empty } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { Icon } from "@/components/shell/Icon";
import { fdate, titleCase } from "@/lib/format";

export const metadata = { title: "Manuals & training" };
const CATS = ["compliance", "training", "policy", "brand", "faq"];

export default async function DocsPage() {
  const { supabase, user, role } = await requireUser();
  const [{ data: docs }, { data: acks }] = await Promise.all([
    supabase.from("documents").select("id,slug,title,category,summary,version,is_published,requires_ack,updated_at").order("category").order("title"),
    supabase.from("document_acks").select("document_id,version").eq("profile_id", user.id),
  ]);
  const needAck = (docs ?? []).filter((d) => d.is_published && d.requires_ack && !(acks ?? []).some((a) => a.document_id === d.id && a.version === d.version));
  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="Manuals & training" sub="Compliance manuals, training briefs and policies. Read them here; some need your acknowledgement." actions={isAdmin(role) ? <Link href="/admin?tab=docs" className="btn"><Icon name="plus" size={16} /> Manage documents</Link> : undefined} />
      {needAck.length > 0 && <div className="callout mb-4"><b>{needAck.length} document{needAck.length > 1 ? "s" : ""} need your acknowledgement:</b> {needAck.map((d) => <Link key={d.id} href={`/docs/${d.slug}`} className="underline font-bold ml-1">{d.title}</Link>)}</div>}
      {(docs ?? []).length === 0 ? <Empty title="No documents yet" /> : CATS.map((c) => {
        const rows = (docs ?? []).filter((d) => d.category === c);
        if (rows.length === 0) return null;
        return (
          <div key={c} className="mb-5">
            <div className="seclabel">{titleCase(c)}</div>
            <Card pad={false}>{rows.map((d) => { const acked = (acks ?? []).some((a) => a.document_id === d.id && a.version === d.version); return (
              <Link key={d.id} href={`/docs/${d.slug}`} className="lrow"><Icon name="book" size={18} className="text-tt" /><div className="flex-1 min-w-0"><div className="font-bold text-[13.5px]">{d.title} <span className="text-tt font-medium text-[11px]">v{d.version}</span>{!d.is_published && <span className="ml-2 pill pill-warn">draft</span>}</div><div className="text-[12px] text-ts truncate">{d.summary ?? ""} · updated {fdate(d.updated_at, "MMM d, yyyy")}</div></div>{d.requires_ack && <Pill tone={acked ? "ok" : "bad"}>{acked ? "acknowledged" : "acknowledge"}</Pill>}<Icon name="chevron" size={16} className="text-tt" /></Link>); })}</Card>
          </div>
        );
      })}
    </div>
  );
}
