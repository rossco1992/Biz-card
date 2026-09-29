-- Preserve a plain-text fallback and freeze formatted content when scheduling.
alter table public.profiles add column email_signature_html text;
alter table public.profiles add constraint signature_html_size check (email_signature_html is null or octet_length(email_signature_html) <= 102400);
alter table public.followups add column body_html_snapshot text;
