-- Guest names are optional free text; do not reject short or blank names.
alter table public.lodging_inquiries
  drop constraint if exists lodging_inquiries_guest_name_check;
