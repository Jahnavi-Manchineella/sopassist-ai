
-- Allow guest tickets
ALTER TABLE public.tickets ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS guest_name text;

-- Replace insert policy to allow guests
DROP POLICY IF EXISTS "Users can create own tickets" ON public.tickets;

CREATE POLICY "Anyone can create tickets"
ON public.tickets
FOR INSERT
TO anon, authenticated
WITH CHECK (
  (auth.uid() IS NOT NULL AND auth.uid() = user_id)
  OR (auth.uid() IS NULL AND user_id IS NULL AND user_email IS NOT NULL)
);

-- Allow guests no read access; admins/SMEs/owners already covered. Keep existing select policy.
