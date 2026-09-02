import { notFound } from "next/navigation";
import { Suspense } from "react";
import { marked } from "marked";
import { requireUser, isAdmin } from "@/lib/auth";
import { BackLink, Pill } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { fdate, titleCase } from "@/lib/format";
import { acknowledgeDoc } from "../actions";
import Link from "next/link";

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { supabase, user, role } = await requireUser();
  const { data: d } = await supabase.from("documents").select("*").eq("slug", slug).maybeSingle();
  if (!d) notFound();
  const { data: ack } = await supabase.from("document_acks").select("version,acked_at").eq("document_id", d.id).eq("profile_id", user.id).maybeSingle();
  const html = await marked.parse(d.body_md, { async: true });
  const acked = ack?.version === d.version;
  return (
    <div>
      <Suspense><Toast /></Suspense>
      <BackLink href="/docs" label="Manuals & training" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <article className="card p-6 sm:p-8">
          <div className="flex items-center gap-2 flex-wrap mb-4"><Pill tone="brand">{titleCase(d.category)}</Pill><span className="text-[12px] text-tt">Version {d.version} · updated {fdate(d.updated_at, "MMM d, yyyy")}</span>{!d.is_published && <Pill tone="warn">draft</Pill>}</div>
          <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
        <aside className="space-y-3 self-start lg:sticky lg:top-6">
          {d.requires_ack && (
            <div className="card p-4">
              <div className="font-extrabold text-[14px]">Acknowledgement</div>
              {acked ? <p className="text-[13px] text-ok font-semibold mt-1">You acknowledged v{d.version} on {fdate(ack!.acked_at, "MMM d, yyyy")}.</p> : (
                <form action={acknowledgeDoc} className="mt-2">
                  <input type="hidden" name="document_id" value={d.id} /><input type="hidden" name="version" value={d.version} /><input type="hidden" name="slug" value={d.slug} />
                  <p className="text-[12.5px] text-ts mb-3">By acknowledging you confirm you've read and will follow this document.</p>
                  <button className="btn btn-pri btn-block">I have read and understood</button>
                </form>
              )}
            </div>
          )}
          {d.summary && <div className="card p-4 text-[13px] text-ts">{d.summary}</div>}
          {isAdmin(role) && <Link href={`/admin?tab=docs&doc=${d.id}`} className="btn btn-block">Edit document</Link>}
        </aside>
      </div>
    </div>
  );
}
