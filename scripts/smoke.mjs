/* Smoke test: signs in a test user by cookie, visits every page on mobile + desktop, fails on 5xx or app errors.
   Usage: SMOKE_EMAIL=... SMOKE_PASSWORD=... node scripts/smoke.mjs  (expects the app on http://localhost:3000) */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const BASE = process.env.SMOKE_BASE || "http://localhost:3000";
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OUT = process.env.SMOKE_OUT || "smoke-out";
fs.mkdirSync(OUT, { recursive: true });

const MOCK = process.env.SMOKE_MOCK === "1"; // server started with SMOKE_MOCK=1 serves fixture data, no sign-in needed
let cookieObjs = [];
let biz, route, stop, form, me;
if (MOCK) {
  biz = [{ id: "b1" }]; route = [{ id: "r1" }]; stop = [{ id: "s2", route_id: "r1" }]; form = [{ slug: "supermercado-la-bodega-b1" }]; me = { id: "00000000-0000-4000-8000-000000000001" };
} else {
  const sb = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: process.env.SMOKE_EMAIL, password: process.env.SMOKE_PASSWORD });
  if (error) { console.error("sign-in failed", error.message); process.exit(1); }
  const session = data.session;
  const ref = new URL(URL_).hostname.split(".")[0];
  const name = `sb-${ref}-auth-token`;
  const value = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const cookies = [];
  const CHUNK = 3180;
  if (value.length <= CHUNK) cookies.push({ name, value });
  else for (let i = 0; i * CHUNK < value.length; i++) cookies.push({ name: `${name}.${i}`, value: value.slice(i * CHUNK, (i + 1) * CHUNK) });
  cookieObjs = cookies.map((c) => ({ ...c, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }));
  ({ data: biz } = await sb.from("businesses").select("id").eq("status", "active").limit(1));
  ({ data: route } = await sb.from("routes").select("id").limit(1));
  ({ data: stop } = await sb.from("stops").select("id,route_id").limit(1));
  ({ data: form } = await sb.from("lead_forms").select("slug").limit(1));
  ({ data: me } = await sb.from("profiles").select("id").eq("email", process.env.SMOKE_EMAIL).single());
}

const pages = ["/dashboard", "/routes", "/routes?tab=history", "/routes/new", "/routes/templates", "/routes/templates/new", "/businesses", "/businesses?filter=all", "/businesses/new",
  biz?.[0] ? `/businesses/${biz[0].id}` : null, biz?.[0] ? `/businesses/${biz[0].id}?tab=leads` : null, biz?.[0] ? `/businesses/${biz[0].id}?tab=value` : null, biz?.[0] ? `/businesses/${biz[0].id}?tab=contracts` : null, biz?.[0] ? `/businesses/${biz[0].id}?tab=edit` : null,
  route?.[0] ? `/routes/${route[0].id}` : null, stop?.[0] ? `/routes/${stop[0].route_id}/stops/${stop[0].id}` : null,
  "/inventory", "/inventory?tab=request", "/inventory?tab=requests", "/inventory?tab=ledger", "/inventory?tab=kits", "/inventory?tab=materials",
  "/contracts", "/leads", "/territory", "/territory?tab=costs", "/territory?tab=rates", "/territory?tab=accounts", "/team", "/directory", me ? `/directory/${me.id}` : null,
  "/docs", "/docs/field-compliance-manual", "/admin", "/admin?tab=settings", "/admin?tab=territories", "/admin?tab=checklists", "/admin?tab=docs", "/admin?tab=rates", "/settings"].filter(Boolean);
const publicPages = ["/login", form?.[0] ? `/l/${form[0].slug}` : null].filter(Boolean);

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium" });
let failures = 0;
async function run(label, viewport, urls, withAuth, dark) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  if (withAuth) await ctx.addCookies(cookieObjs);
  if (dark) await ctx.addInitScript(() => localStorage.setItem("pr-theme", "dark"));
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const u of urls) {
    errors.length = 0;
    const res = await page.goto(BASE + u, { waitUntil: "networkidle", timeout: 60000 }).catch((e) => ({ status: () => 0, err: e }));
    const status = res?.status?.() ?? 0;
    const text = await page.evaluate(() => document.body.innerText).catch(() => "");
    const bad = status >= 500 || status === 0 || /Application error|Internal Server Error|This page could not be found/i.test(text || "");
    const shot = `${OUT}/${label}${u.replace(/[^a-z0-9]+/gi, "_")}.png`;
    await page.screenshot({ path: shot, fullPage: false }).catch(() => {});
    const realErrors = errors.filter((e) => !/favicon|leaflet|tile\.openstreetmap|hydrat|Download the React DevTools|net::ERR/i.test(e));
    if (bad || realErrors.length) { failures++; console.log(`FAIL ${label} ${u} status=${status} bad=${bad} ${JSON.stringify(realErrors.slice(0, 3))}`); }
    else console.log(`ok   ${label} ${u} ${status}`);
  }
  await ctx.close();
}
await run("public-mobile", { width: 390, height: 844 }, publicPages, false, false);
await run("mobile", { width: 390, height: 844 }, pages, true, false);
await run("desktop", { width: 1360, height: 900 }, pages, true, false);
await run("dark-mobile", { width: 390, height: 844 }, ["/dashboard", "/routes", route?.[0] ? `/routes/${route[0].id}` : "/routes"], true, true);
await browser.close();
console.log(failures ? `\n${failures} failures` : "\nAll pages rendered.");
process.exit(failures ? 1 : 0);
