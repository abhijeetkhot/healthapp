-- Storage bucket for meal photos. Private (service-role only) — the browser
-- never reads these directly; route handlers fetch via signed URLs if needed.
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;
