-- Run this in Supabase SQL Editor (supabase.com > your project > SQL Editor)

-- 1. Create the pins table
create table pins (
  id text primary key,
  "postType" text not null default 'tenant',
  bhk text not null,
  rent integer not null,
  deposit integer,
  "depositMonths" integer,
  furnishing text default 'semi',
  society text default 'gated',
  "availableFrom" text,
  floor integer,
  area integer,
  pets text,
  notes text,
  contact text,
  lat double precision not null,
  lng double precision not null,
  neighborhood text,
  "vacantSoon" boolean default false,
  "budgetPerPerson" integer,
  "currentOccupants" integer,
  "genderPref" text,
  "foodPref" text,
  "smokingPref" text,
  "moveInTimeline" text,
  "createdAt" timestamptz default now(),
  reports integer default 0
);

-- 2. Enable Row Level Security
alter table pins enable row level security;

-- 3. Anyone can read all pins
create policy "Anyone can read pins"
  on pins for select
  using (true);

-- 4. Anyone can insert pins (anonymous posting)
create policy "Anyone can insert pins"
  on pins for insert
  with check (true);

-- 5. Anyone can update pins (for report count)
create policy "Anyone can update pins"
  on pins for update
  using (true);

-- 6. Anyone can delete pins (for report-based removal)
create policy "Anyone can delete pins"
  on pins for delete
  using (true);

-- 7. Auto-delete owner/flatmate pins older than 15 days
--    Run this as a cron job via Supabase Edge Functions, or manually.
--    For now, the frontend already filters these out client-side.

-- 6. Create an index for faster queries
create index idx_pins_posttype on pins ("postType");
create index idx_pins_created on pins ("createdAt");
create index idx_pins_location on pins (lat, lng);

-- 7. Enable realtime (so new pins appear for everyone instantly)
alter publication supabase_realtime add table pins;
