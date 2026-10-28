CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'runner' CHECK (role IN ('runner','merchant','admin')),
  consent_version TEXT NOT NULL DEFAULT 'beta-2026-10',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  details TEXT NOT NULL,
  target_miles NUMERIC NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  state TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS challenge_members (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, challenge_id)
);
CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('run','walk')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  distance_miles NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording','accepted','rejected','review')),
  reason TEXT,
  UNIQUE (user_id,client_id)
);
CREATE TABLE IF NOT EXISTS challenge_contributions (
  challenge_id UUID NOT NULL REFERENCES challenges(id),
  activity_id UUID NOT NULL REFERENCES activities(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  miles NUMERIC NOT NULL,
  PRIMARY KEY (challenge_id,activity_id)
);
CREATE TABLE IF NOT EXISTS points_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  delta INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type,source_id)
);
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS team_members (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  merchant TEXT NOT NULL,
  details TEXT NOT NULL,
  city TEXT NOT NULL,
  cost_points INTEGER NOT NULL CHECK (cost_points >= 0),
  max_claims INTEGER NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT TRUE,
  state TEXT NOT NULL DEFAULT 'draft',
  ends_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES offers(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  encrypted_code TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'issued' CHECK (state IN ('issued','redeemed','revoked')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  UNIQUE (offer_id,user_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_redeemed_voucher ON vouchers(id) WHERE state='redeemed';
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  object_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_activities_user ON activities(user_id,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributions_challenge ON challenge_contributions(challenge_id);

CREATE TABLE IF NOT EXISTS team_contributions (
  team_id UUID NOT NULL REFERENCES teams(id),
  activity_id UUID NOT NULL REFERENCES activities(id),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  miles NUMERIC NOT NULL,
  PRIMARY KEY (activity_id)
);
CREATE TABLE IF NOT EXISTS merchant_access (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  offer_id UUID NOT NULL REFERENCES offers(id),
  PRIMARY KEY (user_id,offer_id)
);
