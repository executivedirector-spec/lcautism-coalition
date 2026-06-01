# AI Workflow Upgrade — Package Scope & Playbook

**Status:** Living doc. Started 2026-06-01.
**Purpose:** (1) Capture the LCAC build so it's not lost. (2) Turn it into a repeatable, productized **$10k "AI Workflow Upgrade"** offering for non-technical operators (small nonprofits, local businesses, solo founders).

> First client / reference install: **Lewis County Autism Coalition (LCAC)** — operator is Michelle (Ben's mom), a non-developer.

---

## 1. The pitch (one line)

> "We replace the software you pay for and the busywork you hate with AI tools you control by *talking* — and we put hard guardrails on it so an amateur can't break anything or spend a dime by accident."

**Price:** $10,000 (one-time build + setup). Optional retainer for upkeep/usage costs (TBD).

---

## 2. Who it's for

- Non-technical operators who run a real organization day-to-day.
- Currently paying for tools they half-use (CRMs, site builders, email tools).
- Drowning in email, scheduling, grant/lead hunting, and content updates.
- Need to feel **powerful, not lost** — every tool explains itself in plain English and asks before doing anything risky.

---

## 3. Modules (mix & match per client)

### Module A — Talk-to-Edit Website (preview → "push" → live)
- Operator talks to Claude Code in plain English ("change the event date to June 25").
- Claude edits, shows a **plain-English diff + preview link**, operator says **"push"**, it goes live (~60s via Vercel).
- **LCAC status:** ✅ Built. Static site on Vercel, governed by `CLAUDE.md` rules + `MOM_CHEATSHEET.md`. Preview = Vercel preview deployment per branch.
- **To finish for LCAC:** auto-generate a preview URL on each edit and surface it in chat before the live push (currently pushes to `main`; should push to a branch → preview → confirm → merge).

### Module B — Contact / Donor CRM (replaces the ~$1,500/yr software)
- One searchable list of families, donors, partners. Donation tracking, follow-up reminders, auto thank-yous, tax receipts.
- **Backend status:** A Supabase project already exists (`obemgxqczuifpndzutku`) with 130+ tables — but it's the broader BlueJays agency platform, **not** a clean LCAC CRM. Needs either (a) a scoped LCAC schema/views, or (b) a separate lightweight project. **Decision needed (Ben).**
- See `backend-review-snapshot.md` for the security/QA findings before anything goes live with real PII.

### Module C — Inbox Co-Pilot (draft replies in her voice → approve → send)
- Reads incoming mail, drafts a reply in the operator's voice, queues it for one-click approval.
- **Backend status:** `inbound-email` edge function + `emails`, `queued_replies`, `email_events`, `outbox`, `delivery_attempts` tables already exist. Promising — needs review + a voice/style profile + an approval UI.
- ⚠️ **Cost tension — read Section 5.** Drafting in-voice requires an LLM API that bills per use. This conflicts with the "no paid-usage APIs" guardrail and must be resolved explicitly.

### Module D — Grant Finder + First-Draft Helper
- Running list of grants matched to the org, sorted by deadline, with reminders.
- One-click "start a draft" that produces a personalize-then-send first draft from the org's boilerplate + the grant's criteria.
- **Status:** Not built. High value for nonprofits (likely LCAC's #1 win). Needs a source strategy (grant feeds/APIs) + a knowledge base of the org's mission, programs, budget, past awards.

### Module E — Voice Input (WhisperFlow)
- System-wide push-to-talk voice-to-text. **Not an API we build** — it's a third-party app installed on her machine + a keyboard shortcut. Zero code; part of setup/training.
- **Status:** Install + configure during the in-person session.

### Module F — Skills & Routines
- A small set of saved Claude skills/slash-commands for her recurring jobs (e.g. `/add-event`, `/thank-donor`, `/find-grants`, `/draft-replies`).
- A daily/Monday-morning routine that assembles her "here's your day" brief.
- **Status:** Design from her interview answers (`mom-interview.md`).

---

## 4. The Guardrails Spec (the part that makes this safe to sell)

These are **hard, non-negotiable defaults** for any amateur-operator install. Encode them in `CLAUDE.md`, settings/permissions, and the backend.

1. **No paid-usage APIs without explicit setup + a spend cap.** Nothing that bills per call gets wired in silently. Any such service requires (a) Ben's setup, (b) a hard monthly cap, (c) the operator informed. (LCAC's current `CLAUDE.md` rule.)
2. **Human-approval gate on anything outward-facing.** No email sends, no social posts, no live website push without an explicit "yes/push" from the operator.
3. **No destructive operations.** Never `rm`/delete files; never `DROP`/`DELETE` rows; "remove" = archive/hide/placeholder. (LCAC `CLAUDE.md` rule 4.)
4. **Money actions always escalate.** Signing up for services, anything with a card → ask the operator, loop in the technical owner (Ben).
5. **One change per commit, plain-English messages, confirm before push.** (LCAC `CLAUDE.md` rules 2 & 3.)
6. **Protected files/areas off-limits without escalation** (`js/main.js`, `css/`, `vercel.json`, deploy config, form keys).
7. **PII stays protected.** Donor/family data is never exposed publicly. Backend RLS must actually deny anon access (see snapshot — this is currently NOT fully true).
8. **Everything reversible / observable.** Branch-based site edits (revertable), an activity log the technical owner can read.
9. **Ask, don't guess.** Ambiguous request → clarifying question, never a guess. (LCAC `CLAUDE.md` rule 7.)

---

## 5. ⚠️ Known design tension: "auto-reply in her voice" vs. "no paid-usage APIs"

The operator wants AI to draft emails in her voice. Generating text in a specific voice **requires an LLM API call**, which **bills per use** — that directly conflicts with the "no APIs that cost money per usage" guardrail.

**This is a decision Ben must make, not a thing to silently wire in.** Options:

- **Option 1 — Drafting only, hard monthly cap.** Allow exactly one paid LLM for drafting, with a low hard spend cap (e.g. $X/mo) and alerting. Nothing else paid. *(Recommended: highest value, controllable cost.)*
- **Option 2 — Approval inside Claude Code only.** No standalone always-on service; drafts are generated only when she's in a Claude session reviewing her inbox. Cost tracks her usage, no surprise background spend.
- **Option 3 — Templates, no LLM.** Pre-written templates she picks from and tweaks. Zero usage cost, but not truly "in her voice / context-aware."

**Resolve this before building Module C.** Whatever's chosen, add the per-use service + its cap to the guardrails record so it's an exception *on purpose*, not a hole.

---

## 6. Reusable onboarding flow (sell this as a process)

1. **Discovery interview** → `mom-interview.md` (click-through, multiple choice, plain English). Reusable per client.
2. **Backend/asset review** → `backend-review-snapshot.md` pattern (what exists, what's safe, what's missing).
3. **Module selection + guardrails config** (Section 3 + 4 above).
4. **Build + wire**, branch-based with preview links.
5. **In-person setup day**: install WhisperFlow, set keyboard shortcuts, walk through routines, hand over the cheat sheet.
6. **Cheat sheet + `CLAUDE.md`** tuned to the operator (see LCAC versions as the template).
7. **Handover + check-in cadence.**

---

## 7. Deliverables checklist (per install)

- [ ] Completed discovery interview
- [ ] Guardrails encoded in `CLAUDE.md` + permissions/settings
- [ ] Talk-to-edit site with preview→push
- [ ] CRM (scoped, RLS-verified, PII-safe)
- [ ] Inbox co-pilot (voice profile + approval gate) — *if cost tension resolved*
- [ ] Grant finder + draft helper — *nonprofit clients*
- [ ] WhisperFlow installed + shortcuts set
- [ ] Skills/routines for the operator's top recurring jobs
- [ ] Operator cheat sheet
- [ ] Backend security pass (RLS, function search_path, spend caps)
- [ ] In-person training session done

---

## 8. LCAC-specific open items (carried from TASKS.md)

- GA4 measurement ID still a placeholder.
- Backend RLS not safe for public PII yet (see snapshot).
- Module B/C/D not built; A built, needs preview-link polish.
- Resolve the Section 5 cost decision before any email automation.
