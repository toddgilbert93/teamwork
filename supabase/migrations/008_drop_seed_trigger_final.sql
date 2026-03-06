-- Migration 007 accidentally restored the broken seed trigger.
-- Drop it permanently. Default personas are seeded by the application layer.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS seed_default_personas();
