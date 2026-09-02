# Promo Routes · Accident Professionals

Mobile-first field app for the promo placement team: routes, stops, photo reports, checklists, inventory, business sign-up with contract requests, per-store QR lead forms with webhooks, territory costs and a user directory. Built with Next.js 16 (App Router), Supabase (Postgres + Auth + Storage, row-level security) and Tailwind 4, styled to the AP brand book (Montserrat, `#ffbd15` on black/white).

## Run locally

```bash
cp .env.example .env.local   # fill in the values below
npm install
npm run dev                  # http://localhost:3000
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase publishable (anon) key |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Used only by `/api/leads` and the public `/l/[slug]` page, which have no user session. Supabase → Project Settings → API keys |
| `NEXT_PUBLIC_APP_URL` | public | Deployed URL, printed into QR codes and emails |
| `RESEND_API_KEY`, `EMAIL_FROM` | server | Outbound email (leads, contract requests, contract to the business). Without a key, emails are logged, not sent |
| `LEADS_INBOX_EMAIL`, `CONTRACTS_INBOX_EMAIL` | server | Fallback inboxes. The admin page can override the leads inbox |
| `LEAD_WEBHOOK_SECRET` | server | Optional HMAC key for the `X-Signature` header on lead webhooks |

## Supabase setup (one time)

1. **Custom SMTP.** Authentication → SMTP Settings: point Supabase at your email provider (Resend works). Without it, Supabase's built-in mailer allows only a couple of auth emails per hour, which is not enough for a team.
2. **Email one-time code.** Authentication → Email Templates → *Magic Link*: the body must contain `{{ .Token }}` so the 6-digit code is emailed (e.g. `Your Promo Routes code is {{ .Token }}`). Keep *Confirm email* on. Set the Site URL to the Vercel URL.
3. **Users.** Anyone who signs in gets a profile in the *pending* state with the rep role. A super admin activates them in **Directory → Pending activation** and sets role and territory.
4. **Migrations.** The schema lives in the Supabase project; the additions made for this app are in `supabase/migrations/` (already applied).
5. **Storage.** Bucket `stop-photos` (private) holds stop photos, receipts and avatars; the app serves them through signed URLs.

## Deploy on Vercel

Import the repo, framework preset *Next.js*, add the environment variables above, deploy. No other config is needed. Then set Supabase's Site URL / redirect URLs to the Vercel domain.

## How the pieces fit

- **Routes** (`/routes`): plan a day from assigned or due stops, or from a *routine route* template. Start records the odometer; pre/post checklists come from admin templates; each stop has arrive → checklist → report (outcome, materials left, photo, note, follow-up). End submits the route with mileage and expenses. Managers review.
- **Stops / businesses** (`/businesses`): every account with history, contacts, QR code, contract and value tabs. Sign-up creates the business (pending approval for reps), a contact, a QR lead form and an optional contract request inside the territory's rate band.
- **Inventory** (`/inventory`): stock levels maintained by a ledger. Completing a stop deducts what was left; the office adds restocks, counts and issues rep kits; reps request materials.
- **Leads** (`/l/[slug]` → `/api/leads`): one public form per store. Each submission is stored, tagged (`store:<slug>`, `territory:<code>`, custom tags), POSTed to the store's webhook (or the default one) with a ClickUp-ready payload, and emailed to the inbox. `/api/qr/[slug]` renders the QR (PNG or SVG).
- **Territory** (`/territory`): map, status mix, measured cost (mileage × rate, expenses, materials at unit cost, placement fees), manual cost entries and rate bands ($200–$1,000 by default) that bound what reps can pre-set.
- **Team** (`/team`): per-rep routes, stops, success and photo rates, miles, expenses, sign-ups, plus the audit trail.
- **Directory, Docs, Admin, Settings**: people, compliance manuals and training briefs (Markdown, versioned, with acknowledgements), company settings, territories, checklists, rate card, and personal profile with night mode.

## Scripts

- `npm run build` / `npm run lint`
- `node scripts/smoke.mjs` renders every page in mobile, desktop and dark mode against a running server (needs a test account: `SMOKE_EMAIL`, `SMOKE_PASSWORD`).

The earlier static prototype (`index.html` on `main`) was replaced by this app; it remains in git history.
