-- ============================================================================
-- Holistic Health — initial schema
-- See CLAUDE.md "Database schema" for the canonical reference.
-- ============================================================================

-- Daily merged health metrics (output of HealthSyncService — multi-provider merge).
create table daily_health_metrics (
  date            date primary key,
  readiness       smallint,
  sleep_score     smallint,
  hrv             numeric(6,2),
  resting_hr      smallint,
  sleep_minutes   smallint,
  deep_minutes    smallint,
  rem_minutes     smallint,
  body_temp_dev   numeric(4,2),
  steps           integer,
  active_cals     integer,
  sources         text[]      not null default '{}',
  synced_at       timestamptz not null default now()
);

-- Staging table for Apple Health export uploads (Phase 1 only).
-- When the iOS app ships, HealthKitAdapter reads directly from the device
-- and this table becomes unused.
create table apple_health_daily (
  date            date primary key,
  steps           integer,
  active_cals     integer,
  resting_hr      smallint,
  workouts        jsonb,
  imported_at     timestamptz not null default now()
);

create table meals (
  id              uuid primary key default gen_random_uuid(),
  date            date        not null,
  time            time        not null,
  photo_path      text,
  total_cals      smallint,
  total_prot      numeric(6,1),
  total_carbs     numeric(6,1),
  total_fat       numeric(6,1),
  created_at      timestamptz not null default now()
);

create table meal_items (
  id              uuid primary key default gen_random_uuid(),
  meal_id         uuid        not null references meals(id) on delete cascade,
  name            text        not null,
  portion_g       numeric(7,1),
  calories        smallint,
  protein_g       numeric(6,1),
  carbs_g         numeric(6,1),
  fat_g           numeric(6,1),
  confidence      numeric(3,2),
  source          text        not null default 'ai'
);

create table supplements (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null,
  brand           text,
  default_dose    text,
  created_at      timestamptz not null default now()
);

create table supplement_ingredients (
  id              uuid primary key default gen_random_uuid(),
  supplement_id   uuid        not null references supplements(id) on delete cascade,
  name            text        not null,
  amount          numeric(8,2),
  unit            text        not null default 'mg'
);

create table dose_logs (
  id              uuid primary key default gen_random_uuid(),
  supplement_id   uuid        not null references supplements(id),
  date            date        not null,
  time            time        not null,
  dose_desc       text,
  created_at      timestamptz not null default now()
);

-- Oura OAuth tokens — single row, personal use.
create table oura_tokens (
  id              int primary key default 1,
  access_token    text        not null,
  refresh_token   text        not null,
  expires_at      timestamptz not null,
  updated_at      timestamptz not null default now(),
  constraint single_row check (id = 1)
);

create index on meals(date);
create index on dose_logs(date);
create index on meal_items(meal_id);
create index on dose_logs(supplement_id);
