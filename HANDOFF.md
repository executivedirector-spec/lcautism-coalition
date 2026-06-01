# Handoff brief — paste this into Claude Code on Michelle's computer

Hi Claude. You're now running on **Michelle's** computer for the **Lewis County Autism Coalition (LCAC)**. Michelle is the Executive Director — **not a developer**. First, read `CLAUDE.md` in this folder for the rules you must follow. This brief catches you up on everything that's already been built so you can continue smoothly.

## Who you're helping
Michelle (the operator). Always plain English. Explain what you're about to do **before** you do it. Show changes in plain English. **Never push anything live without her explicit "yes."** Never delete files. (Full rules: `CLAUDE.md`.)

## What already exists
1. **The website** — plain HTML/CSS/JS, auto-deploys to Vercel. She edits it by talking to you.
2. **Preview → live flow:** `/preview` saves her change to a branch and gives a preview link (NOT live); `/push-live` confirms once more, then makes it live (~60s). Never edit `main` directly.
3. **Her shortcuts** (in `.claude/commands/`): `/morning-brief`, `/add-event`, `/swap-photo`, `/thank-donor`, `/find-grants`, `/draft-grant`, `/preview`, `/push-live`.
4. **A CRM** on a dedicated, locked-down Supabase project named **`lcac-crm`**. A login-gated admin dashboard lives in `crm-admin/` (she signs in with her Supabase user). Tables include: contacts, households, organizations, donations, events, event_rsvps, contact_form_submissions, volunteers, interactions, reminders, grants (pre-loaded with 16 researched leads), tags.
5. **Website forms feed the CRM** — `js/crm-capture.js` saves contact/volunteer/sponsor/scholarship/RSVP submissions into the CRM's two intake tables (in addition to the existing email).
6. **Planning docs** in `docs/ai-workflow-upgrade/`: package scope, backend security audit, CRM schema, grant leads, email co-pilot plan, office-day runbook, Windows setup.

## Key facts
- **CRM project:** `lcac-crm` (ref `byxuapnhhuxekamgnwaf`), URL `https://byxuapnhhuxekamgnwaf.supabase.co`. The **publishable (anon) key** is in `crm-capture.js` / `crm-admin/` and is safe (insert-only on the two intake tables; can't read anything). The **service-role key is never in the repo.**
- **Security rule:** anon can only INSERT into `event_rsvps` and `contact_form_submissions`. Everything else requires the staff login. **Never add a `TO public USING (true)` policy** — that was a real bug that leaked data on a different project; we don't repeat it.
- **Email co-pilot:** decided = **Option 1** (capped, always-on drafting in her voice, approve-before-send). Not built yet — see `docs/ai-workflow-upgrade/email-copilot-plan.md`.
- **Forms = escalation:** don't change form behavior, `js/main.js`, `css/`, or `vercel.json` without flagging Ben first (see `CLAUDE.md`).

## Current state & what's next
- Open items: confirm Michelle's Supabase login works; do a practice `/preview` → `/push-live`; build the email co-pilot (Option 1); possibly fold in an employee's incoming CRM project (wire it to **this** secure `lcac-crm` project and re-check security before real data goes in).
- Ben handles anything risky (DNS, money, new tools). When unsure, ask Michelle a simple question or tell her to text Ben.

## How to start with Michelle
Greet her by name. Ask what she'd like to work on today. Offer to run `/morning-brief` to show what needs attention. Keep everything calm and plain-English — the goal is for her to feel powerful, not lost.
