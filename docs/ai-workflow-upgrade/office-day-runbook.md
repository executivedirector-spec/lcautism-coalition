# Office Day Runbook — LCAC AI Workflow Setup

**For:** Ben, in-person at LCAC. **Date:** 2026-06-01.
**Goal:** everything below is either done or ready to finish on-site so your mom is set up.

---

## ✅ Done remotely (already committed/pushed to branch `claude/vibrant-cannon-pkJJr`, PR #1)

### Website self-service tooling
- **Preview→push flow:** `/preview` (commits to a branch, gives a Vercel preview link, not live) and `/push-live` (confirms, merges to `main`, goes live ~60s).
- **Guardrails** (`.claude/settings.json`): blocks destructive/paid/deploy-config commands; asks before push/merge and before editing `js/main.js`, `css/`, `vercel.json`.
- **Shortcuts for mom:** `/morning-brief`, `/add-event`, `/swap-photo`, `/thank-donor`, `/find-grants`, `/draft-grant`. Documented in `CLAUDE.md` + `MOM_CHEATSHEET.md`.

### Grants
- **16 researched grant leads** in `grant-leads.md`, sorted by deadline. **Urgent (June):** Anderson Foundation for Autism (June 1–30), USDA Rural Business Development (June 30). Best ongoing local fit: Community Foundation of South Puget Sound (serves Lewis County). Verify each before applying.

### Backend security (existing shared project `obemgxqczuifpndzutku`)
- **Closed a live data leak:** dropped 20 `TO public USING(true)` policies that exposed `emails`, `prospects`, `sms_messages`, etc. to anyone with the publishable key. Verified 0 remain.
- **Hardened 40 functions** (pinned `search_path`). Verified 0 still mutable.
- Confirmed the sensitive WSP/agency tables (DUI cases, API keys, Stripe) were already locked. Full writeup in `backend-review-snapshot.md`.

### New standalone LCAC database
- **Created a dedicated Supabase project `lcac-crm`** (id `byxuapnhhuxekamgnwaf`, region us-west-1, **$10/mo**) — separate from the WSP/agency data.
- **Clean CRM schema** (`lcac-crm-schema.md`): 15 tables (contacts spine, households, organizations, donations, events, RSVPs, volunteers, interactions, reminders, grants, tags). RLS locked down — only 2 anon INSERT-only intake tables, everything else service-role-only. Applied to the new project this session (see status below).

---

## 📋 On-site checklist (at the office)

1. **Install WhisperFlow** on your mom's machine + set the push-to-talk keyboard shortcut. (App install — not code.)
2. **Set up her Claude Code** locally: clone the repo, confirm `claude` launches, run `/morning-brief` once together so she sees it work.
3. **Dry-run the edit flow with her:** make one tiny real edit → `/preview` → open the link → `/push-live`. Builds her confidence.
4. **Hand her the cheat sheet** (`MOM_CHEATSHEET.md`) — print it.
5. **Decide the $1,500 CRM cutover:** confirm which features she actually uses (from the interview) before cancelling the paid tool. The new `lcac-crm` DB covers the core; it still needs a simple UI (next build).
6. **Have her fill the interview** (`mom-interview.md`) if not done — it drives the rest of the build.

---

## 🔑 New project — wiring notes (for when the CRM app gets built)
- **Project:** `lcac-crm` / `byxuapnhhuxekamgnwaf` / us-west-1 — **schema applied + verified locked down** (15 tables, anon read = denied everywhere, anon INSERT only on the 2 intake tables, 0 "allow everyone" policies).
- **API URL:** `https://byxuapnhhuxekamgnwaf.supabase.co`
- **Keys:** fetch when wiring with `get_publishable_keys` (publishable key → browser forms; service-role key from the dashboard → server-side only, NEVER in the browser). Not committed to the repo.
- Website RSVP + contact forms → INSERT with publishable key into `event_rsvps` / `contact_form_submissions`.
- CRM admin/reads → service-role key, server-side only.

---

## 🖥️ CRM status — standalone Supabase ✅, Vercel = decide on-site

- **Supabase: standalone & done.** Dedicated `lcac-crm` project, schema applied, verified locked down. **Whatever CRM front-end we end up using must point at THIS project** (not a new, unaudited one) so we keep the secure RLS model.
- **A working CRM admin app is built** at `crm-admin/` in this repo (login-gated, 6 tabs). Because it lives in the site repo it will deploy with the site at **`/crm-admin/`** (e.g. `lcautism.org/crm-admin/`) — safe, since it requires a Supabase Auth login and the publishable key can't read any PII. **First login user must be created in the Supabase dashboard** (Authentication → Users).
- **"Standalone in Vercel":** not strictly required — `/crm-admin/` works as-is. If you want it on its own project/subdomain (e.g. `crm.lcautism.org`), that's a Vercel dashboard step (point a new project at this folder or a split repo). **Hold on that until the employee's CRM lands** so we don't build something we throw away.

## 📥 Incoming: employee's CRM-lookalike project
- An employee already built a CRM-style project on Claude; Ben will **transfer it over to use as the starting point.**
- **Plan when it arrives:** compare it to `crm-admin/` + the `lcac-crm-schema.md`; adopt whichever UI is stronger; **wire the chosen one to the secure `lcac-crm` Supabase project**; re-run the security checks (anon can't read PII; intake INSERT-only) before any real data goes in. Treat `crm-admin/` as a reference/fallback.

## ⏭️ Open decisions / next builds (not blocking tomorrow)
- **Email co-pilot cost decision** (PACKAGE-SCOPE §5): pick Option 1/2/3 before building auto-draft replies. Needs a paid LLM API — conflicts with the "no paid-usage APIs" rule unless capped on purpose.
- **CRM UI:** the database is ready; a simple admin interface (and form wiring) is the next build for Module B.
- **Local repo move:** move the repo out of the Bluejay Business folder + give mom her own GitHub access (per TASKS.md).
- **Lower priority:** verify the locked funnel-intake tables on the old project didn't break a live page (see backend-review-snapshot watch-list).
