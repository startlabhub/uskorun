-- Apply BEFORE deploying code; on production/staging only with separate approval.
-- A preflight must first verify zero users with multiple active recordings.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM activities WHERE status='recording' GROUP BY user_id HAVING COUNT(*)>1) THEN
  RAISE EXCEPTION 'Pre-existing duplicate recording sessions require manual resolution';
 END IF;
END $$;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_status_check;
ALTER TABLE activities ADD CONSTRAINT activities_status_check
 CHECK (status IN ('recording','accepted','rejected','review','abandoned'));
CREATE UNIQUE INDEX IF NOT EXISTS only_one_recording_per_user
 ON activities(user_id) WHERE status='recording';
CREATE TABLE IF NOT EXISTS auth_rate_limits (
 bucket_key TEXT NOT NULL,
 window_id BIGINT NOT NULL,
 attempts INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(bucket_key,window_id)
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_window ON auth_rate_limits(window_id);
-- Vacuum/retention job for old auth_rate_limits rows required before public beta.
