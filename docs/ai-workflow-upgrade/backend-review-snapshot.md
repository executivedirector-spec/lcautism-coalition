# Backend Review — Snapshot (read-only)

**Date:** 2026-06-01
**Project:** Supabase `obemgxqczuifpndzutku` ("benfreemn-del's Project"), Postgres 17, us-east-2, ACTIVE_HEALTHY.
**Method:** Read-only inspection via Supabase MCP (`list_tables`, `list_edge_functions`, `get_advisors` security). **No changes made.**

> ⚠️ This is a snapshot, NOT a full audit. A real audit means reading each table's RLS policies, the edge function source, and the data-access path (anon key vs. service role). Flagged as a separate task.

---

## What this backend actually is

Not a small LCAC database — it's the **broader BlueJays agency platform**: 130+ tables in `public`. Examples: `agency_applications` (37 cols), `agency_customers`, dozens of `client_*` tables (leads, subscriptions, ad creatives, bookings, stripe connections, api keys), `prospects` (95 cols), `hormozi_kb_chunks`, `hyperloop_*` experiment tables, `outbox`, `delivery_attempts`.

**Implication:** LCAC's CRM should be either a **scoped schema/views** inside this, or a **separate clean project**. Don't point LCAC's public site at this shared platform without scoping. (Decision for Ben — noted in PACKAGE-SCOPE.md, Module B.)

## Email pipeline — already partially built ✅
- Edge functions: `inbound-email` (v23, active), `read-storage` (v3, active). Both have `verify_jwt: false`.
- Tables: `emails`, `queued_replies` (14 cols), `email_events`, `email_retry_queue`, `outbox`, `delivery_attempts`, `channel_health`.
- This is a real head start on the **Inbox Co-Pilot (Module C)**. Needs source review + voice profile + approval UI.

## Security advisories — 176 total (the "functions check")

| Level | Issue | Count | What it means |
|---|---|---|---|
| WARN | `rls_policy_always_true` | **20** | Policies that evaluate to TRUE for everyone. If reachable with the anon/public key, **anyone can read/write those tables.** Highest concern if any hold PII. |
| INFO | `rls_enabled_no_policy` | **112** | RLS on, but no policy = denies all by default. **Safe only if** access is exclusively via the service role (server-side). If any client uses the anon key against these, they're locked out. |
| WARN | `function_search_path_mutable` | 40 | Functions without a fixed `search_path` — a privilege-escalation hardening gap. Routine fix (`SET search_path = ...`). |
| WARN | `anon_security_definer_function_executable` | 2 | `SECURITY DEFINER` functions the anon role can call — review what they do. |
| WARN | `authenticated_security_definer_function_executable` | 2 | Same, for authenticated role. |

`verify_jwt: false` on both edge functions is fine **if** they do their own auth (e.g. a webhook signature / shared secret) — needs confirming in the source.

## Verdict for "is the backend functional / ready?"

- **Functional / healthy:** yes — project is up, schema is rich, email plumbing exists.
- **Safe to put real LCAC donor/family PII behind a public site:** **not yet.** The 20 `rls_policy_always_true` policies and the anon-vs-service-role access path must be verified first.

## Recommended next steps (separate task, in priority order)
1. Read the 20 `rls_policy_always_true` policies — identify which tables hold PII and whether the anon key can reach them. Tighten.
2. Confirm `inbound-email` / `read-storage` do their own auth (since `verify_jwt:false`).
3. Decide LCAC CRM = scoped views here, or a separate project.
4. Add `SET search_path` to the 40 flagged functions (low-risk hardening).
5. Re-run `get_advisors` (security + performance) after fixes.
6. Then — and only then — wire any LCAC-facing CRM/UI to it.
