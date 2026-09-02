import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { PageHead, Card, KV } from "@/components/ui";
import { Toast } from "@/components/shell/Toast";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { AvatarUploader } from "@/components/settings/AvatarUploader";
import { ROLE_LABEL } from "@/lib/types";
import { fdate } from "@/lib/format";
import { updateMyProfile } from "./actions";

export const metadata = { title: "My profile" };

export default async function SettingsPage() {
  const { profile, user } = await requireUser();
  return (
    <div>
      <Suspense><Toast /></Suspense>
      <PageHead title="My profile" sub="What the directory shows about you, and how the app looks." />
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card title="Profile">
          <form action={updateMyProfile} className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><AvatarUploader userId={user.id} initial={profile.photo_url} /></div>
            <label className="field !mb-0"><span>Full name</span><input name="full_name" required defaultValue={profile.full_name} /></label>
            <label className="field !mb-0"><span>Job title</span><input name="job_title" defaultValue={profile.job_title ?? ""} placeholder="Field rep, Territory manager…" /></label>
            <label className="field !mb-0"><span>Phone</span><input name="phone" type="tel" defaultValue={profile.phone ?? ""} /></label>
            <label className="field !mb-0"><span>Language</span><select name="language" defaultValue={profile.language}><option value="en">English</option><option value="es">Spanish</option><option value="both">Both</option></select></label>
            <label className="field !mb-0"><span>Vehicle</span><input name="vehicle" defaultValue={profile.vehicle ?? ""} placeholder="2019 Toyota Corolla, silver" /></label>
            <label className="field !mb-0"><span>Emergency contact</span><input name="emergency_contact" defaultValue={profile.emergency_contact ?? ""} placeholder="Name · phone" /></label>
            <label className="field !mb-0 sm:col-span-2"><span>About</span><textarea name="bio" defaultValue={profile.bio ?? ""} className="!min-h-[60px]" placeholder="A line for the directory" /></label>
            <div className="sm:col-span-2 flex justify-end"><button className="btn btn-pri">Save</button></div>
          </form>
        </Card>
        <div className="space-y-4">
          <Card title="Account">
            <KV rows={[["Email", user.email], ["Role", ROLE_LABEL[profile.role]], ["Territory", profile.territory ? `${profile.territory.name} (${profile.territory.code})` : "—"], ["Started", profile.started_on ? fdate(profile.started_on, "MMM d, yyyy") : "—"], ["Member since", fdate(profile.created_at, "MMM d, yyyy")]]} />
            <p className="hint mt-3">Role and territory are set by an admin in the directory.</p>
          </Card>
          <Card title="Display"><div className="flex items-center justify-between"><span className="text-[13.5px]">Night mode follows your device unless you switch it here.</span><ThemeToggle /></div></Card>
          <Card title="Install on your phone"><p className="text-[13px] text-ts">Open this site in Safari or Chrome, tap Share, then <b>Add to Home Screen</b>. It runs full-screen with the AP icon.</p></Card>
          <form action="/auth/signout" method="post"><button className="btn btn-danger btn-block">Sign out</button></form>
        </div>
      </div>
    </div>
  );
}
