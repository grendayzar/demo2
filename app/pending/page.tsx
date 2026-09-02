import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/brand/Logo";

export const metadata = { title: "Account pending" };

export default async function PendingPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.profile?.is_active) redirect("/dashboard");
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="card max-w-[420px] w-full p-8 text-center">
        <span className="inline-grid place-items-center w-14 h-14 rounded-2xl bg-brand text-black mb-4"><LogoMark className="w-8 h-8" /></span>
        <h1 className="text-[22px] font-extrabold">Almost there</h1>
        <p className="text-ts mt-2 text-[14px] leading-relaxed">
          You're signed in as <b className="text-tp">{s.user.email}</b>. Your account is waiting for a manager to activate it and assign a territory.
        </p>
        <p className="text-tt mt-4 text-[12px]">Ask your territory manager or the office to approve you in the User Directory.</p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="btn">Sign out</button>
        </form>
      </div>
    </main>
  );
}
