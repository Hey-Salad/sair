-- =============================================================================
-- HeySalad — Multi-tenant schema (Vercel for Platforms ready)
-- =============================================================================
-- Design principles:
--   * EVERYTHING is scoped by tenant_id (a tenant = a business, e.g. a restaurant
--     served at restaurant.heysalad.io).
--   * EVERY billable agent action writes a usage_event + a credit_ledger debit.
--   * users come from HeySalad auth; we reference them by external id and never
--     store passwords here.
--   * Portable Postgres: drops into HeySalad's DB, Neon, or AWS Aurora Postgres.
-- =============================================================================

create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Identity (mirrors HeySalad auth; no credentials stored here)
-- -----------------------------------------------------------------------------
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  external_id   text unique not null,            -- HeySalad auth subject (sub/user_id)
  email         text,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Tenants (one business / workspace per row)
-- -----------------------------------------------------------------------------
create table if not exists tenants (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,            -- subdomain: <slug>.heysalad.io
  name          text not null,
  logo_url      text,
  plan          text not null default 'free',    -- mirrors active subscription tier
  status        text not null default 'active',  -- active | suspended | trialing
  settings      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Custom + wildcard domains managed via the Vercel Platforms API
create table if not exists domains (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  domain        text unique not null,            -- e.g. app.acmebistro.com
  is_primary    boolean not null default false,
  verified      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists domains_tenant_idx on domains(tenant_id);

-- Tenant membership + role (a user can belong to many tenants)
create table if not exists tenant_members (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,
  role          text not null default 'staff',   -- owner | admin | staff
  created_at    timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists tenant_members_user_idx on tenant_members(user_id);

-- Per-user preferences (Personal Config), scoped to a tenant
create table if not exists user_settings (
  user_id        uuid not null references users(id) on delete cascade,
  tenant_id      uuid not null references tenants(id) on delete cascade,
  theme          text not null default 'dark',
  default_model  text not null default 'extended',
  preferences    jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (user_id, tenant_id)
);

-- -----------------------------------------------------------------------------
-- Billing: subscriptions + credit ledger (append-only) + usage metering
-- -----------------------------------------------------------------------------
create table if not exists subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  stripe_customer_id    text,
  stripe_subscription_id text,
  plan                  text not null default 'free',  -- free | starter | pro | enterprise
  status                text not null default 'active',
  monthly_credit_grant  bigint not null default 0,     -- credits granted each cycle
  seats                 int not null default 1,
  current_period_end    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id)
);

-- Append-only ledger. Balance = sum(amount). Positive = grant/top-up, negative = debit.
create table if not exists credit_ledger (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  amount        bigint not null,                 -- + grant/topup, - debit
  reason        text not null,                   -- monthly_grant | topup | usage | refund | adjustment
  usage_event_id uuid,                            -- links a debit to what consumed it
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists credit_ledger_tenant_idx on credit_ledger(tenant_id, created_at);

-- One row per billable agent action (drives the debit above)
create table if not exists usage_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  feature       text not null,                   -- chat | image | research | codey | voice | sms
  units         numeric not null default 0,      -- tokens, images, voice-minutes, messages
  credits_charged bigint not null default 0,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists usage_events_tenant_idx on usage_events(tenant_id, created_at);

-- -----------------------------------------------------------------------------
-- Tenant integrations (customer-owned: ElevenLabs, Twilio, Slack, POS, ...)
-- Credentials stored encrypted at the application layer before insert.
-- -----------------------------------------------------------------------------
create table if not exists tenant_integrations (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references tenants(id) on delete cascade,
  provider              text not null,            -- elevenlabs | twilio | slack | square | ...
  status                text not null default 'connected', -- connected | error | disconnected
  encrypted_credentials text,                     -- app-layer encrypted blob / OAuth tokens
  config                jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (tenant_id, provider)
);
create index if not exists tenant_integrations_tenant_idx on tenant_integrations(tenant_id);

-- -----------------------------------------------------------------------------
-- Projects + Chats + Messages (New Chat, Search Chats, Codey)
-- -----------------------------------------------------------------------------
create table if not exists projects (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  name          text not null,
  instructions  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists projects_tenant_idx on projects(tenant_id);

create table if not exists chats (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  project_id    uuid references projects(id) on delete set null,
  title         text not null default 'New chat',
  kind          text not null default 'chat',    -- chat | codey | research
  model         text not null default 'extended',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists chats_tenant_idx on chats(tenant_id, updated_at desc);

create table if not exists messages (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  chat_id       uuid not null references chats(id) on delete cascade,
  role          text not null,                   -- user | assistant | tool
  content       text not null default '',
  attachments   jsonb not null default '[]'::jsonb,
  tokens        int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists messages_chat_idx on messages(chat_id, created_at);
-- Full-text search support for "Search chats"
create index if not exists messages_fts_idx on messages using gin (to_tsvector('english', content));

-- -----------------------------------------------------------------------------
-- Images (generations)
-- -----------------------------------------------------------------------------
create table if not exists generations (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  prompt        text not null,
  image_url     text,                            -- R2 object URL / signed URL key
  model         text,
  created_at    timestamptz not null default now()
);
create index if not exists generations_tenant_idx on generations(tenant_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Apps catalog + per-tenant enablement (your customised HeySalad apps = eve tools)
-- -----------------------------------------------------------------------------
create table if not exists apps (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,            -- table_mgmt | venue_mgmt | stock_mgmt | ...
  name          text not null,
  description   text,
  icon          text,
  config_schema jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists tenant_apps (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  app_id        uuid not null references apps(id) on delete cascade,
  enabled       boolean not null default true,
  config        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (tenant_id, app_id)
);
create index if not exists tenant_apps_tenant_idx on tenant_apps(tenant_id);

-- -----------------------------------------------------------------------------
-- Deep Research (long-running multi-step agent jobs)
-- -----------------------------------------------------------------------------
create table if not exists research_sessions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  user_id       uuid references users(id) on delete set null,
  query         text not null,
  status        text not null default 'queued',  -- queued | running | done | error
  result        text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists research_sessions_tenant_idx on research_sessions(tenant_id, created_at desc);

create table if not exists research_steps (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references research_sessions(id) on delete cascade,
  step_type     text not null,                   -- search | read | synthesize
  payload       jsonb not null default '{}'::jsonb,
  sources       jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists research_steps_session_idx on research_steps(session_id, created_at);

-- -----------------------------------------------------------------------------
-- Food domain (the "co-pilot for food management" data eve's tools operate on)
-- -----------------------------------------------------------------------------
create table if not exists venues (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  address       text,
  capacity      int,
  created_at    timestamptz not null default now()
);
create index if not exists venues_tenant_idx on venues(tenant_id);

create table if not exists dining_tables (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  venue_id      uuid references venues(id) on delete cascade,
  label         text not null,
  seats         int not null default 2,
  status        text not null default 'available', -- available | reserved | occupied
  created_at    timestamptz not null default now()
);
create index if not exists dining_tables_tenant_idx on dining_tables(tenant_id);

create table if not exists bookings (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  venue_id      uuid references venues(id) on delete set null,
  table_id      uuid references dining_tables(id) on delete set null,
  guest_name    text not null,
  guest_phone   text,
  party_size    int not null default 2,
  starts_at     timestamptz not null,
  status        text not null default 'confirmed', -- confirmed | seated | cancelled | no_show
  source        text,                              -- web | voice | sms | manual
  created_at    timestamptz not null default now()
);
create index if not exists bookings_tenant_idx on bookings(tenant_id, starts_at);

create table if not exists suppliers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  name          text not null,
  contact       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists suppliers_tenant_idx on suppliers(tenant_id);

create table if not exists stock_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  venue_id      uuid references venues(id) on delete cascade,
  supplier_id   uuid references suppliers(id) on delete set null,
  name          text not null,
  unit          text not null default 'unit',    -- kg | litre | unit | case
  quantity      numeric not null default 0,
  reorder_level numeric not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists stock_items_tenant_idx on stock_items(tenant_id);
