-- Quick registration: service descriptions are optional during initial submission.
-- Apply after reconciling local and remote migration history; do not deploy blindly.
begin;
alter table public.service_listings alter column description drop not null;
commit;
