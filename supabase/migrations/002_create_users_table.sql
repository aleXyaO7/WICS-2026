drop table if exists public.users;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  email text not null unique,
  password_hash text not null,
  elo_rating integer not null default 1200,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.users is 'User accounts with username, email, and ELO rating';
comment on column public.users.username is 'Unique username for the user';
comment on column public.users.email is 'Unique email address for the user';
comment on column public.users.elo_rating is 'User ELO rating, starts at 1200';

create index users_username_idx on public.users(username);

create index users_email_idx on public.users(email);

create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_users_updated_at
  before update on public.users
  for each row
  execute function update_updated_at_column();
