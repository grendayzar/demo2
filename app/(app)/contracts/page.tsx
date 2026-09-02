import Link from "next/link";
import { Suspense } from "react";
import { requireUser, isManager } from "@/lib/auth";
import { PageHead, Card, Pill, Empty, Tabs, statusTone } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { fdate, usd } from "@/lib/format";
import { sendContract, setContractStatus } from "./actions";

export const metadata = { title: "Contracts" };

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { supabase, role } = await requireUser();
  const { tab = "open" } = await searchParams;
  const manager = isManager(role);
  let q = supabase.from("contract_requests").select("*, business:businesses(id,name,city,business_type), rep:profiles!contract_requests_requested_by_fkey(full_name)").order("created_at", { ascending: false }).limit(200);
  q = tab === "open" ? q.in("status", ["requested", "sent"]) : q.in("status", ["signed", "declined", "cancelled"]);
  const { data: rows } = await q;
  const { data: settings } = manager ? await supabase.from("app_settings").select("value").eq("key", "company").maybeSingle() : { data: null };
  const contractUrl = (settings?.value as { contract_url?: string } | null)?.contract_url ?? "";

  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="Contract requests" sub={manager ? "Reps sign businesses up and set the agreed rate. Send the agreement by email, then mark it signed when it comes back." : "Your sign-ups and where each contract is."} />
      <Tabs items={[{ href: "/contracts", label: "Open" }, { href: "/contracts?tab=closed", label: "Closed" }]} active={tab === "open" ? "/contracts" : "/contracts?tab=closed"} />
      {!manager && <div className="callout mb-4 text-[13px]">Sign a new business up from <Link href="/businesses/new" className="font-bold underline">Stops → Sign up a business</Link>. Tick "request contract" and the office takes it from there.</div>}
      {manager && !contractUrl && <div className="callout mb-4 text-[13px]">Tip: add the agreement link (DocuSign, PandaDoc or a PDF) under <Link href="/admin?tab=settings" className="font-bold underline">Admin → Settings</Link> so the email carries a sign button.</div>}
      <Card pad={false}>
        {!rows || rows.length === 0 ? <div className="p-4"><Empty title={tab === "open" ? "No open contract requests" : "Nothing closed yet"} /></div> : rows.map((r) => (
          <div key={r.id} className="p-4 border-b border-line2 last:border-b-0">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap"><Link href={`/businesses/${r.business?.id}?tab=contracts`} className="font-extrabold text-[15px] hover:underline">{r.business?.name}</Link><Pill tone={statusTone(r.status)}>{r.status}</Pill></div>
                <div className="text-[12.5px] text-ts mt-0.5">{r.business?.business_type}{r.business?.city ? ` · ${r.business.city}` : ""} · requested by {r.rep?.full_name} on {fdate(r.created_at, "MMM d")}</div>
                <div className="text-[13px] mt-2"><b className="text-[16px] tabular">{usd(Number(r.agreed_monthly_fee))}</b><span className="text-tt">/month</span> · {r.term_months} months{r.start_date ? ` from ${r.start_date}` : ""}{(r.placement_types ?? []).length ? ` · ${r.placement_types.join(", ")}` : ""}</div>
                <div className="text-[12.5px] text-ts mt-1">Send to: {r.contact_name ? `${r.contact_name} · ` : ""}<a href={`mailto:${r.contact_email}`} className="font-semibold">{r.contact_email}</a>{r.contact_phone ? ` · ${r.contact_phone}` : ""}{r.sent_at ? ` · sent ${fdate(r.sent_at, "MMM d, h:mm a")} to ${r.sent_to}` : ""}</div>
                {r.notes && <p className="text-[12.5px] mt-2 border-l-2 border-brand pl-2">{r.notes}</p>}
              </div>
              <div className="flex flex-col gap-2 items-end">
                {manager && ["requested", "sent"].includes(r.status) && (
                  <form action={sendContract} className="flex gap-1 items-end">
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="contract_url" value={contractUrl} />
                    <input name="to" defaultValue={r.contact_email} className="input !py-1.5 !text-[12px] w-[200px]" />
                    <button className="btn btn-pri btn-sm">{r.status === "sent" ? "Resend" : "Send contract"}</button>
                  </form>
                )}
                <div className="flex gap-1">
                  {manager && r.status !== "signed" && <form action={setContractStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="signed" /><button className="btn btn-sm">Mark signed</button></form>}
                  {manager && ["requested", "sent"].includes(r.status) && <form action={setContractStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="declined" /><button className="btn btn-ghost btn-sm text-bad">Declined</button></form>}
                  {!manager && r.status === "requested" && <form action={setContractStatus}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="status" value="cancelled" /><button className="btn btn-ghost btn-sm">Cancel</button></form>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
