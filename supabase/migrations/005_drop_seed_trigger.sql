-- Drop the seed trigger that's blocking user creation.
-- Personas are now seeded by the create-dev-user script instead.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS seed_default_personas();
