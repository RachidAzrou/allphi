-- Iteration 2: dispatching the completed accident report by e-mail to the
-- company's central claims address (fleet manager). We track the lifecycle on
-- the report row so the wizard can show live status + retry behaviour.

-- Central claims e-mail per company. Single-tenant for now; one row in
-- company_profile, so this column lives there.
alter table public.company_profile
  add column if not exists claims_email text;

-- Per-report dispatch state. NULL email_status means "not yet attempted".
alter table public.ongeval_aangiften
  add column if not exists email_status text
    check (email_status in ('queued', 'sending', 'sent', 'failed')),
  add column if not exists email_recipient text,
  add column if not exists email_cc text,
  add column if not exists email_message_id text,
  add column if not exists email_sent_at timestamptz,
  add column if not exists email_error text,
  add column if not exists email_attempts integer not null default 0;

create index if not exists ongeval_aangiften_email_status
  on public.ongeval_aangiften (email_status)
  where email_status is not null;
