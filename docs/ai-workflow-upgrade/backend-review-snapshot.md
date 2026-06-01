# Backend Review — Audit (read-only)

**Date:** 2026-06-01
**Project:** Supabase `obemgxqczuifpndzutku` ("benfreemn-del's Project"), Postgres 17, us-east-2.
**Method:** Read-only via Supabase MCP — `list_tables`, `list_edge_functions`, `get_advisors`, `get_edge_function` (read source), and direct `pg_policies` / `has_table_privilege` queries. **No changes made. No row data exfiltrated.**

---

## 🚩 Headline: this is NOT an LCAC backend

The edge-function source makes it clear what this database is — and it's three unrelated things sharing one project:

1. **A Washington State Patrol DUI report drafter** — `inbound-email` generates DUI Report-of-Investigation packets for **Trooper Benjamin Freeman, Badge #695, WSP**. Tables: `cases`, `case_attachments`, `report_library`, `processing_log`. **This holds real law-enforcement PII** (DUI suspect facts, blood/alcohol results).
2. **The BlueJays agency/marketing platform** — 100+ `client_*`, `agency_*`, `prospects`, `hormozi_*`, `hyperloop_*` tables.
3. **No LCAC tables at all.**

**Conclusion:** Nothing LCAC should ever point at this project. LCAC's CRM/email needs its **own dedicated Supabase project** (clean blast radius, separate keys, no law-enforcement data nearby). The "backend we already built" is real — but it's for the WSP + agency products, not the coalition.

---

## 🔴 Confirmed exposure: ~20 tables readable/writable with the public key

**Root cause:** 20 policies named *"Allow all for service role"* were created `TO public USING (true)` instead of `TO service_role`. The Postgres `public` role includes `anon`/`authenticated`, and those roles **do** hold table grants here (verified via `has_table_privilege`). A permissive `ALL USING(true)` policy `TO public` therefore lets **anyone with the project's publishable/anon key** read **and write** these tables over the REST API.

This is the classic Supabase footgun. The service role **bypasses RLS anyway**, so these policies were never needed for the edge functions — they only created the hole.

**Exposed tables (contain PII / business data):**
`emails`, `queued_replies`, `email_events`, `prospects`, `notes`, `referrals`, `proposals`, `sms_messages`, `voicemail_drops`, `calendar_bookings`, `change_requests`, `edit_requests`, `funnel_enrollments`, `generated_sites`, `onboarding`, `pipeline_batches`, `preview_visits`, `priority_call_list`, `system_costs`, `scheduled_tasks`.

Several hold contact PII (email bodies, phone/SMS, voicemails, prospect records) — readable by anyone with the key, and `ALL` means **writable/deletable** too.

## ✅ What's safe

The most sensitive tables are **locked correctly** — RLS on, **zero** permissive policies, so RLS denies the anon role despite the grant existing:
`cases`, `case_attachments`, `report_library`, `processing_log` (WSP law-enforcement data), and `client_credentials`, `client_api_keys`, `client_stripe_connections`, `bluejays_users`, `agency_applications`, `agency_customers`.
So the worst-case data (DUI cases, API keys, Stripe connections) is **not** exposed. Good.

## Edge functions — auth verified

Both run `verify_jwt: false` but **do their own auth**, so that's fine:
- `inbound-email` — `verifyAuth()` checks a Postmark Basic-auth user/pass or a Bearer `READ_STORAGE_TOKEN`; rejects otherwise. Also has an `ALLOWED_SENDERS` allowlist. Uses the **service role key** server-side.
- `read-storage` — `verifyBearer()` requires a Bearer `READ_STORAGE_TOKEN`; rejects if unset. (Note: it exposes a `write` action that upserts to storage — fine behind the token, but it's a powerful endpoint.)

## Other advisories (lower priority)
- `function_search_path_mutable` ×40 — add `SET search_path = ''` to those functions (hardening).
- 112 tables RLS-on/no-policy — safe **as long as** access stays service-role-only.

---

## Remediation plan (NOT yet applied — needs Ben's input first)

The fix differs per table, which is why I did **not** auto-apply anything:

- **Service-role-only tables** (no public frontend should touch them): **drop** the `TO public USING(true)` policy. They become deny-all to anon, like the safe tables. Nothing breaks because the edge functions use the service role.
  → Likely: `emails`, `queued_replies`, `email_events`, `prospects`, `sms_messages`, `voicemail_drops`, `proposals`, `pipeline_batches`, `priority_call_list`, `system_costs`, `scheduled_tasks`, `referrals`, `notes`.
- **Genuine public-intake tables** (if a funnel/landing page writes to them with the anon key): replace `ALL USING(true)` with a **scoped** policy — e.g. anon `INSERT` only, no `SELECT` — so the public can submit but can't read everyone's data.
  → Possibly: `preview_visits`, `cta_clicks`, `edit_requests`, `change_requests`, `onboarding`, `funnel_enrollments`, `calendar_bookings`, `generated_sites`.

**Open question for Ben:** which of the second group are written by a public frontend with the anon key? That determines drop-vs-scope per table. Once you tell me, I'll prepare a single migration and apply it only on your go.
