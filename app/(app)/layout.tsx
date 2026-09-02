import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  return <Shell profile={profile}>{children}</Shell>;
}
