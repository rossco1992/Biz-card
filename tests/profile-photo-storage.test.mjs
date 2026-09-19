import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('photo storage isolates writes by owner and limits accepted uploads', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role authenticated; create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('app.uid', true), '')::uuid $$;
      create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1, '/') $$;
      create table public.profiles(id uuid primary key);
      create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects(bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema auth, storage to authenticated;
      grant select, insert, update, delete on storage.objects to authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/0004_profile_photos.sql', import.meta.url), 'utf8'));
    const { rows: [bucket] } = await db.query('select * from storage.buckets');
    assert.equal(bucket.public, true);
    assert.equal(Number(bucket.file_size_limit), 2097152);
    assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg']);
    const owner = '11111111-1111-1111-1111-111111111111';
    const other = '22222222-2222-2222-2222-222222222222';
    await db.exec(`set role authenticated; set app.uid = '${owner}';`);
    await db.query("insert into storage.objects values ('profile-photos', $1)", [`${owner}/photo.jpg`]);
    await assert.rejects(db.query("insert into storage.objects values ('profile-photos', $1)", [`${other}/photo.jpg`]), /row-level security/);
    await assert.rejects(db.query("insert into storage.objects values ('other-bucket', $1)", [`${owner}/photo.jpg`]), /row-level security/);
    await db.exec(`set app.uid = '${other}'`);
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 0);
    await db.exec(`set app.uid = '${owner}'`);
    assert.equal((await db.query('delete from storage.objects returning *')).rows.length, 1);
  } finally { await db.close(); }
});
