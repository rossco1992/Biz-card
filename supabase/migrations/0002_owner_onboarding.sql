create policy "owners can create own profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = user_id);

create policy "owners can delete own profile"
on public.profiles for delete
to authenticated
using (auth.uid() = user_id);
