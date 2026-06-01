# LCAC CRM — Database Schema (Design Document)

**Status:** ✅ **APPLIED 2026-06-01** to Supabase project `lcac-crm` (`byxuapnhhuxekamgnwaf`, us-west-1) via migration `lcac_crm_initial_schema`. Verified locked down: anon cannot read any PII table; anon INSERT works only on `event_rsvps` + `contact_form_submissions`; 0 "allow everyone" readable policies.
**Date:** 2026-06-01
**Target:** A **new, dedicated, standalone Supabase project** for the Lewis County Autism Coalition CRM — clean blast radius, its own keys, no law-enforcement or agency data anywhere near it (see `backend-review-snapshot.md` for why we are NOT reusing project `obemgxqczuifpndzutku`).

This replaces **Module B — Contact / Donor CRM** from `PACKAGE-SCOPE.md` (the ~$1,500/yr donor CRM): one searchable contact list, donation tracking, event sign-ups, follow-up reminders, donor thank-yous, and basic reporting.

---

## 1. Rationale + entity-relationship overview

### The security posture (the whole point)

The prior backend leaked ~20 PII tables because policies were written `TO public USING (true)`. The Postgres `public` role includes `anon` and `authenticated`, so "allow all for service role" actually meant "allow anyone with the publishable key to read AND write." We do not repeat that. The rules baked into every table below:

1. **RLS is ON for every table.** No exceptions.
2. **Default posture is service-role-only.** The app server / Supabase edge functions talk to the database with the **service-role key**, which **bypasses RLS by design**. So most tables need **no policy at all** — RLS-on + no-policy = deny-all to the anon key. That is the correct, safe default and matches the "✅ What's safe" tables in the audit.
3. **The only anon access is scoped, INSERT-only, on the two public web-form intake tables** (`event_rsvps`, `contact_form_submissions`). Anon can `INSERT` a row from a public form but **cannot `SELECT`, `UPDATE`, or `DELETE`** — they can submit, they can never read anyone's data. **Never `USING (true)` for an anon read.**
4. Every policy carries a comment saying who it is for.

Because the service role bypasses RLS, we deliberately keep most tables policy-free rather than writing permissive policies — writing a permissive policy is exactly how the last project got burned.

### Entities & relationships (prose)

- **contacts** is the spine — every person LCAC knows: families, donors, partners' staff, volunteers, board members. One searchable list. A contact may belong to a **household** (a family unit) and may be linked to an **organization** (a partner/sponsor/funder).
- **households** group related people (a family). A contact's `household_id` is optional.
- **organizations** are partner orgs, sponsors, grant funders, businesses. Contacts link to an org via `organization_id` (their employer/affiliation).
- **donations** are gifts. Each gift links to the **contact** who gave it and optionally the **organization** (corporate gift) and the **event/campaign** it came in through. Drives donation tracking, tax receipts, and reporting.
- **events** are LCAC events (Car & BMX Show, Coalition Meetings, Summer Sensory Camp, SWWA Conference). **event_rsvps** is the **public intake** table — the website RSVP form writes here with the anon key (INSERT only). Staff later reconcile an RSVP to a real `contact`.
- **volunteers** extends a contact with volunteer-specific status; **volunteer_interests** is a child list of the areas a volunteer wants to help with (camp, events, court support, etc.).
- **interactions** are logged touchpoints/notes — calls, emails, meetings, a thank-you sent — each tied to a contact (and optionally an org/donation/event). This is the activity history a paid CRM gives you.
- **reminders** are follow-up tasks ("call the Smith family back," "send tax receipt") with a due date and done flag — replaces the CRM's follow-up reminders.
- **grants** is the grant pipeline (funder, amount, stage, deadlines, status) feeding Module D. **grant_tasks** are the to-dos/deadlines under a grant.
- **tags** + **contact_tags** are a flexible labeling system (e.g. "major donor," "Spanish-speaking," "board," "lapsed").
- **contact_form_submissions** is the second **public intake** table — the website contact form writes here with the anon key (INSERT only).

```
households 1───* contacts *───1 organizations
                   │  │  │
        donations *┘  │  └* volunteers 1───* volunteer_interests
        interactions *┘
        reminders    *┘
        contact_tags *┘──* tags

organizations 1───* grants 1───* grant_tasks
events 1───* event_rsvps          (event_rsvps = PUBLIC INTAKE, anon INSERT-only)
events 1───* donations
contact_form_submissions          (PUBLIC INTAKE, anon INSERT-only)
```

**Table count: 16.** Public anon-INSERT intake tables: **`event_rsvps`** and **`contact_form_submissions`** (2). Everything else is service-role-only.

---

## 2. Schema — `CREATE TABLE` SQL

```sql
-- ============================================================================
-- LCAC CRM schema — DESIGN ONLY. Review before applying as a migration.
-- All tables live in the `public` schema (Supabase default for the REST API),
-- but access is locked down by RLS below — being in `public` does NOT mean
-- publicly readable.
-- ============================================================================

-- Useful enum-like CHECK domains are kept as TEXT + CHECK for easy editing.

-- ---------------------------------------------------------------------------
-- households (family units)
-- ---------------------------------------------------------------------------
CREATE TABLE households (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,                       -- e.g. "The Whitlow Family"
    address_line1   text,
    address_line2   text,
    city            text,
    state           text DEFAULT 'WA',
    postal_code     text,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- organizations (partners, sponsors, grant funders, businesses)
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    org_type        text NOT NULL DEFAULT 'partner'
                    CHECK (org_type IN ('partner','sponsor','funder','business','government','other')),
    website         text,
    phone           text,
    email           text,
    address_line1   text,
    city            text,
    state           text DEFAULT 'WA',
    postal_code     text,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_organizations_name ON organizations (lower(name));
CREATE INDEX idx_organizations_type ON organizations (org_type);

-- ---------------------------------------------------------------------------
-- contacts (the spine: families, donors, partner staff, volunteers, board)
-- ---------------------------------------------------------------------------
CREATE TABLE contacts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    uuid REFERENCES households (id) ON DELETE SET NULL,
    organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL,
    first_name      text,
    last_name       text,
    -- full_name is generated so a single column powers the searchable list
    full_name       text GENERATED ALWAYS AS (
                        trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
                    ) STORED,
    email           text,
    phone           text,
    -- what kind of relationship(s) this person has with LCAC
    contact_type    text NOT NULL DEFAULT 'community'
                    CHECK (contact_type IN ('family','donor','volunteer','partner','board','staff','community','other')),
    preferred_language text DEFAULT 'en'
                    CHECK (preferred_language IN ('en','es','other')),
    email_opt_in    boolean NOT NULL DEFAULT false,
    do_not_contact  boolean NOT NULL DEFAULT false,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_household       ON contacts (household_id);
CREATE INDEX idx_contacts_organization    ON contacts (organization_id);
CREATE INDEX idx_contacts_email           ON contacts (lower(email));
CREATE INDEX idx_contacts_type            ON contacts (contact_type);
-- trigram index for fast "search the contact list by name" (needs pg_trgm)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_contacts_fullname_search ON contacts USING gin (lower(full_name) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- tags + contact_tags (flexible labels: "major donor", "Spanish-speaking"...)
-- ---------------------------------------------------------------------------
CREATE TABLE tags (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text NOT NULL UNIQUE,
    color       text,                                    -- optional UI hint
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contact_tags (
    contact_id  uuid NOT NULL REFERENCES contacts (id) ON DELETE CASCADE,
    tag_id      uuid NOT NULL REFERENCES tags (id)      ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_contact_tags_tag ON contact_tags (tag_id);

-- ---------------------------------------------------------------------------
-- events (LCAC events; parent of public RSVP intake)
-- ---------------------------------------------------------------------------
CREATE TABLE events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name            text NOT NULL,
    description     text,
    starts_at       timestamptz,
    ends_at         timestamptz,
    location        text,
    is_fundraiser   boolean NOT NULL DEFAULT false,
    is_public       boolean NOT NULL DEFAULT true,       -- whether it accepts public RSVPs
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_events_starts_at ON events (starts_at);

-- ---------------------------------------------------------------------------
-- event_rsvps  *** PUBLIC INTAKE TABLE — anon INSERT-only ***
-- The website RSVP form writes here with the publishable/anon key.
-- Raw, unauthenticated submissions. Staff reconcile to a real contact later
-- (contact_id starts NULL). NOTHING here is anon-readable.
-- ---------------------------------------------------------------------------
CREATE TABLE event_rsvps (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        uuid REFERENCES events (id) ON DELETE SET NULL,
    contact_id      uuid REFERENCES contacts (id) ON DELETE SET NULL, -- set by staff later
    -- fields captured straight from the public form:
    name            text NOT NULL,
    email           text,
    phone           text,
    party_size      integer NOT NULL DEFAULT 1 CHECK (party_size >= 1 AND party_size <= 50),
    message         text,
    -- light anti-abuse / provenance metadata (not trusted, just recorded):
    source_page     text,
    submitted_at    timestamptz NOT NULL DEFAULT now(),
    processed       boolean NOT NULL DEFAULT false       -- staff workflow flag
);

CREATE INDEX idx_event_rsvps_event     ON event_rsvps (event_id);
CREATE INDEX idx_event_rsvps_processed ON event_rsvps (processed) WHERE processed = false;

-- ---------------------------------------------------------------------------
-- donations / gifts (donation tracking + tax receipts + reporting)
-- ---------------------------------------------------------------------------
CREATE TABLE donations (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id        uuid REFERENCES contacts (id) ON DELETE SET NULL,
    organization_id   uuid REFERENCES organizations (id) ON DELETE SET NULL, -- corporate gift
    event_id          uuid REFERENCES events (id) ON DELETE SET NULL,        -- gift via an event/campaign
    amount_cents      bigint NOT NULL CHECK (amount_cents > 0),               -- store money in cents
    currency          text NOT NULL DEFAULT 'USD',
    donated_at        date NOT NULL DEFAULT current_date,
    method            text CHECK (method IN ('cash','check','card','stripe','in_kind','grant','other')),
    is_recurring      boolean NOT NULL DEFAULT false,
    -- tax receipt tracking:
    receipt_number    text UNIQUE,
    receipt_sent_at   timestamptz,
    -- thank-you tracking (replaces the paid CRM's acknowledgement workflow):
    thanked_at        timestamptz,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_donations_contact   ON donations (contact_id);
CREATE INDEX idx_donations_org       ON donations (organization_id);
CREATE INDEX idx_donations_event     ON donations (event_id);
CREATE INDEX idx_donations_date      ON donations (donated_at);
-- find gifts that still need a thank-you (donor acknowledgement report):
CREATE INDEX idx_donations_unthanked ON donations (donated_at) WHERE thanked_at IS NULL;

-- ---------------------------------------------------------------------------
-- volunteers (extends a contact with volunteer status)
-- ---------------------------------------------------------------------------
CREATE TABLE volunteers (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      uuid NOT NULL UNIQUE REFERENCES contacts (id) ON DELETE CASCADE,
    status          text NOT NULL DEFAULT 'prospective'
                    CHECK (status IN ('prospective','active','inactive')),
    background_check_status text DEFAULT 'not_started'
                    CHECK (background_check_status IN ('not_started','pending','cleared','expired')),
    availability    text,
    started_at      date,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_volunteers_status ON volunteers (status);

-- ---------------------------------------------------------------------------
-- volunteer_interests (areas a volunteer wants to help with)
-- ---------------------------------------------------------------------------
CREATE TABLE volunteer_interests (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id    uuid NOT NULL REFERENCES volunteers (id) ON DELETE CASCADE,
    interest        text NOT NULL,   -- e.g. 'summer_camp','events','court_support','admin','fundraising'
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (volunteer_id, interest)
);

CREATE INDEX idx_volunteer_interests_vol ON volunteer_interests (volunteer_id);

-- ---------------------------------------------------------------------------
-- interactions (logged touchpoints / notes — the activity history)
-- ---------------------------------------------------------------------------
CREATE TABLE interactions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      uuid REFERENCES contacts (id) ON DELETE CASCADE,
    organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL,
    donation_id     uuid REFERENCES donations (id) ON DELETE SET NULL,
    event_id        uuid REFERENCES events (id) ON DELETE SET NULL,
    type            text NOT NULL DEFAULT 'note'
                    CHECK (type IN ('note','call','email','meeting','thank_you','event','other')),
    summary         text NOT NULL,
    occurred_at     timestamptz NOT NULL DEFAULT now(),
    created_by      text,            -- staff name/identifier (free text; no auth schema dependency)
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_interactions_contact  ON interactions (contact_id);
CREATE INDEX idx_interactions_occurred ON interactions (occurred_at);

-- ---------------------------------------------------------------------------
-- reminders (follow-up tasks — replaces the CRM's follow-up reminders)
-- ---------------------------------------------------------------------------
CREATE TABLE reminders (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id      uuid REFERENCES contacts (id) ON DELETE CASCADE,
    donation_id     uuid REFERENCES donations (id) ON DELETE SET NULL,
    title           text NOT NULL,
    details         text,
    due_on          date,
    done            boolean NOT NULL DEFAULT false,
    done_at         timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- the "what needs attention today" query (feeds /morning-brief style reports):
CREATE INDEX idx_reminders_open_due ON reminders (due_on) WHERE done = false;

-- ---------------------------------------------------------------------------
-- grants (pipeline + deadlines + status — feeds Module D)
-- ---------------------------------------------------------------------------
CREATE TABLE grants (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    funder_org_id     uuid REFERENCES organizations (id) ON DELETE SET NULL,
    funder_name       text NOT NULL,         -- denormalized for grants from orgs we don't track yet
    title             text NOT NULL,
    stage             text NOT NULL DEFAULT 'prospect'
                      CHECK (stage IN ('prospect','drafting','submitted','awarded','declined','reporting','closed')),
    amount_requested_cents bigint CHECK (amount_requested_cents IS NULL OR amount_requested_cents >= 0),
    amount_awarded_cents   bigint CHECK (amount_awarded_cents   IS NULL OR amount_awarded_cents   >= 0),
    deadline          date,
    submitted_at      date,
    decision_at       date,
    url               text,
    notes             text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_grants_stage    ON grants (stage);
CREATE INDEX idx_grants_deadline ON grants (deadline);

-- ---------------------------------------------------------------------------
-- grant_tasks (deadlines / to-dos under a grant)
-- ---------------------------------------------------------------------------
CREATE TABLE grant_tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    grant_id    uuid NOT NULL REFERENCES grants (id) ON DELETE CASCADE,
    title       text NOT NULL,
    due_on      date,
    done        boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_grant_tasks_grant   ON grant_tasks (grant_id);
CREATE INDEX idx_grant_tasks_open_due ON grant_tasks (due_on) WHERE done = false;

-- ---------------------------------------------------------------------------
-- contact_form_submissions  *** PUBLIC INTAKE TABLE — anon INSERT-only ***
-- The website contact form writes here with the publishable/anon key.
-- NOTHING here is anon-readable.
-- ---------------------------------------------------------------------------
CREATE TABLE contact_form_submissions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name          text,
    email         text,
    phone         text,
    subject       text,
    message       text NOT NULL,
    source_page   text,
    submitted_at  timestamptz NOT NULL DEFAULT now(),
    processed     boolean NOT NULL DEFAULT false        -- staff workflow flag
);

CREATE INDEX idx_contact_form_processed ON contact_form_submissions (processed) WHERE processed = false;
```

---

## 3. Row Level Security — enable + scoped policies

> **Posture recap:** RLS ON for all 16 tables. The app/edge functions use the **service-role key, which bypasses RLS** — so service-role-only tables need **no policy at all** (RLS-on + no-policy = deny-all to anon, exactly like the audit's "✅ What's safe" tables). The **only** policies we write are the two scoped, INSERT-only anon policies on the public intake tables. We never write a permissive `USING (true)` read policy for anon.

```sql
-- ============================================================================
-- 3a. Enable RLS on EVERY table. No exceptions.
-- ============================================================================
ALTER TABLE households               ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations            ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags             ENABLE ROW LEVEL SECURITY;
ALTER TABLE events                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps              ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations                ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_interests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE interactions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE grants                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE grant_tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_form_submissions ENABLE ROW LEVEL SECURITY;
-- (event_rsvps and contact_form_submissions also appear above — listed once each)

-- ============================================================================
-- 3b. Defense-in-depth: REVOKE anon/authenticated grants on the PII tables.
-- RLS already denies them (no policy), but revoking the underlying table
-- grants means even a future accidental permissive policy can't expose them.
-- The audit showed the hole only opened because anon HELD table grants AND a
-- permissive policy existed. Removing the grants closes one half permanently.
-- The service_role keeps full access (it is not affected by these REVOKEs and
-- bypasses RLS regardless).
-- ============================================================================
REVOKE ALL ON households               FROM anon, authenticated;
REVOKE ALL ON organizations            FROM anon, authenticated;
REVOKE ALL ON contacts                 FROM anon, authenticated;
REVOKE ALL ON tags                     FROM anon, authenticated;
REVOKE ALL ON contact_tags             FROM anon, authenticated;
REVOKE ALL ON events                   FROM anon, authenticated;
REVOKE ALL ON donations                FROM anon, authenticated;
REVOKE ALL ON volunteers               FROM anon, authenticated;
REVOKE ALL ON volunteer_interests      FROM anon, authenticated;
REVOKE ALL ON interactions             FROM anon, authenticated;
REVOKE ALL ON reminders                FROM anon, authenticated;
REVOKE ALL ON grants                   FROM anon, authenticated;
REVOKE ALL ON grant_tasks              FROM anon, authenticated;

-- For the two intake tables we revoke everything first, then grant back ONLY
-- INSERT to anon below. Anon must never have SELECT/UPDATE/DELETE here.
REVOKE ALL ON event_rsvps              FROM anon, authenticated;
REVOKE ALL ON contact_form_submissions FROM anon, authenticated;

-- ============================================================================
-- 3c. Service-role-only tables: NO POLICY.
-- ----------------------------------------------------------------------------
-- households, organizations, contacts, tags, contact_tags, events, donations,
-- volunteers, volunteer_interests, interactions, reminders, grants, grant_tasks
--
-- These intentionally have ZERO policies. With RLS ON and no policy, the anon
-- and authenticated roles are DENIED all access. The service-role key (used
-- only server-side by the app / edge functions) BYPASSES RLS and can do
-- everything it needs. This is the safe default from the audit — do NOT add a
-- "TO public USING (true)" convenience policy here; that is the exact bug we
-- are avoiding.
-- ============================================================================

-- ============================================================================
-- 3d. PUBLIC INTAKE: event_rsvps — anon INSERT-only, no read.
-- ============================================================================

-- Grant ONLY the INSERT privilege back to anon (no SELECT/UPDATE/DELETE).
GRANT INSERT ON event_rsvps TO anon;

-- Policy: lets the public RSVP form submit a row using the publishable/anon
-- key. WITH CHECK (true) allows the insert itself; there is deliberately NO
-- USING clause, so this grants NO read/update/delete visibility. Anyone can
-- submit an RSVP; nobody using the anon key can read any RSVP back.
CREATE POLICY "anon can submit event RSVPs (insert only, no read)"
    ON event_rsvps
    FOR INSERT
    TO anon
    WITH CHECK (true);

COMMENT ON POLICY "anon can submit event RSVPs (insert only, no read)" ON event_rsvps IS
    'PUBLIC WEB FORM. Lets the website RSVP form INSERT a submission with the anon key. No SELECT/UPDATE/DELETE for anon. Staff read these via the service role only.';

-- ============================================================================
-- 3e. PUBLIC INTAKE: contact_form_submissions — anon INSERT-only, no read.
-- ============================================================================

GRANT INSERT ON contact_form_submissions TO anon;

-- Policy: lets the public contact form submit a row using the anon key.
-- WITH CHECK (true) allows the insert; no USING clause = no anon read.
CREATE POLICY "anon can submit contact form (insert only, no read)"
    ON contact_form_submissions
    FOR INSERT
    TO anon
    WITH CHECK (true);

COMMENT ON POLICY "anon can submit contact form (insert only, no read)" ON contact_form_submissions IS
    'PUBLIC WEB FORM. Lets the website contact form INSERT a message with the anon key. No SELECT/UPDATE/DELETE for anon. Staff read these via the service role only.';

-- ============================================================================
-- 3f. (Optional hardening) If any helper SQL functions are added later, create
-- them with SECURITY DEFINER + SET search_path = '' to avoid the
-- function_search_path_mutable advisory flagged in the audit.
-- ============================================================================
```

### Why this can't repeat the leak

- No table has a policy `TO public` or `TO anon` with a `USING (true)` read rule. The audit's hole was an `ALL ... USING (true)` policy to `public`; we have none.
- The two anon policies are `FOR INSERT ... WITH CHECK (true)` only. `WITH CHECK` governs what may be written; with no `USING` clause there is **no readable view** for anon — Supabase/PostgREST cannot return rows to the anon key.
- We additionally `REVOKE` the base table grants from `anon`/`authenticated` on every PII table (defense in depth), so even a future mistaken policy can't open a table whose grants were removed.
- Service-role bypasses RLS, so the app keeps full functionality without any permissive policy.

---

## 4. How this maps to replacing the ~$1,500/yr donor CRM

| Paid-CRM feature | How this schema delivers it |
|---|---|
| **One searchable contact list** | `contacts` (single spine) with `full_name` generated column + a `pg_trgm` GIN index for fast name search; `tags`/`contact_tags` for segments; `households` + `organizations` give family and partner context. |
| **Donation tracking** | `donations` with amount (in cents), date, method, recurring flag, links to contact / org / event. Indexed by contact, org, event, and date for statements and rollups. |
| **Tax receipts** | `donations.receipt_number` (unique) + `receipt_sent_at`. A year-end report = `SELECT` by `contact_id` and `donated_at` range (service role). |
| **Event sign-ups** | `events` + public `event_rsvps` intake (anon INSERT from the website form); staff reconcile each RSVP to a `contact`. |
| **Follow-up reminders** | `reminders` with `due_on` + partial index on open items — drives a "what needs attention today" list (pairs with the `/morning-brief` skill). `grant_tasks` does the same for the grant pipeline. |
| **Donor thank-yous** | `donations.thanked_at` + the partial "unthanked" index surfaces gifts awaiting acknowledgement; `interactions` of type `thank_you` log that it was sent (pairs with the `/thank-donor` skill). |
| **Basic reporting** | Plain SQL over `donations` (totals by period / fund / donor), `grants` (pipeline by stage, amount awarded), `events` (RSVP counts), `volunteers` (active count) — all run server-side with the service role. |
| **Grant management (bonus vs. the old CRM)** | `grants` pipeline (stage, deadline, amounts) + `grant_tasks` deadlines feed Module D's grant finder/draft helper. |

**Cost:** replaces the ~$1,500/yr CRM with a free-tier-friendly Supabase project (Postgres + REST). No per-use billing — consistent with the `PACKAGE-SCOPE.md` "no paid-usage APIs without a cap" guardrail.

---

## 5. Apply checklist (for later — DO NOT run now)

1. Create a **new, dedicated** Supabase project for LCAC (not `obemgxqczuifpndzutku`).
2. `CREATE EXTENSION IF NOT EXISTS pg_trgm;` (needed by the contact-search index).
3. Apply Section 2 (tables/indexes), then Section 3 (RLS + REVOKE + the two anon policies) as a single migration.
4. Run `get_advisors` (security) and confirm: **0** permissive `public`/`anon` policies except the two named INSERT-only intake policies; every other table is RLS-on / no-policy.
5. Verify with `has_table_privilege('anon', 'contacts', 'SELECT')` → **false**, and `has_table_privilege('anon', 'event_rsvps', 'INSERT')` → **true**, `...'event_rsvps','SELECT')` → **false**.
6. Wire the website RSVP + contact forms to insert with the **publishable/anon** key; wire the CRM app / edge functions to use the **service-role** key (server-side only, never shipped to the browser).
```
