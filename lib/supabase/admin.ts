import { createClient } from "@supabase/supabase-js";

/** Service-role client. Server only. Used for the public lead endpoint, which has no user session. */
export function createAdminClient() {
  if (process.env.SMOKE_MOCK === "1") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./mock").mockClient() as ReturnType<typeof createClient>;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
