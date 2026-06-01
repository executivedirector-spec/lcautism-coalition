-- ============================================================
-- LCAC Email Co-Pilot — Supabase Schema
-- Project: lcac-crm (ref: byxuapnhhuxekamgnwaf)
-- Run this in the Supabase SQL editor
-- ============================================================

-- queued_replies: holds every inbound email + its AI draft
create table if not exists queued_replies (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz default now(),

  -- inbound email fields
  inbox            text not null,              -- 'info' | 'outreach' | 'executivedirector'
  from_email       text not null,
  from_name        text,
  subject          text,
  body_text        text not null,              -- plain text of inbound email
  received_at      timestamptz default now(),

  -- CRM link (optional — matched by email if contact exists)
  contact_id       uuid references contacts(id) on delete set null,

  -- AI draft
  draft_subject    text,
  draft_body       text,                       -- the generated reply draft
  draft_generated_at timestamptz,

  -- approval flow
  status           text not null default 'pending'
                   check (status in ('pending','approved','sent','discarded','failed')),
  edited_body      text,                       -- if Michelle edits before approving
  approved_at      timestamptz,
  sent_at          timestamptz,
  sent_message_id  text,                       -- Gmail message ID after send

  -- cost tracking
  tokens_used      int,
  cost_usd         numeric(8,6)
);

-- Index for the CRM inbox tab (pending first, newest first)
create index if not exists queued_replies_status_idx
  on queued_replies(status, created_at desc);

-- RLS: staff login only — no public access ever
alter table queued_replies enable row level security;

create policy "staff only"
  on queued_replies
  for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- system_costs: track monthly API spend (reuse pattern)
-- ============================================================
create table if not exists system_costs (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz default now(),
  service      text not null,   -- 'claude-email-copilot'
  tokens_in    int,
  tokens_out   int,
  cost_usd     numeric(8,6),
  month        text             -- 'YYYY-MM' for easy grouping
);
