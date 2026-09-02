import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/** Per-request Supabase client for server components, server actions and route handlers. RLS applies. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, "public", any>;

export async function createClient(): Promise<Db> {
  if (process.env.SMOKE_MOCK === "1") {
    const { mockClient } = await import("./mock");
    return mockClient() as unknown as Db;
  }
  const cookieStore = await cookies();
  const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a server component: proxy.ts refreshes the session instead.
        }
      },
    },
  });
  // Untyped schema: nested joins come back as plain objects, which is what every page expects.
  return client as unknown as Db;
}
