-- Remove inspection photo tagging feature
-- Drop the atomic tag replacement RPC
DROP FUNCTION IF EXISTS public.set_photo_tags(uuid, uuid[]);

-- Drop the join table (CASCADE removes its RLS policies automatically)
DROP TABLE IF EXISTS public.inspection_photo_tags CASCADE;

-- Drop the tags lookup table (CASCADE removes audit trigger and RLS policies)
DROP TABLE IF EXISTS public.inspection_tags CASCADE;
