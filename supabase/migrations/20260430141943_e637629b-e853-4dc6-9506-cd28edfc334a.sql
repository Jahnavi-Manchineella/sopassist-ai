-- Add email_logs table for tracking outbound Gmail sends
CREATE TABLE IF NOT EXISTS public.email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  purpose TEXT NOT NULL, -- 'invite' | 'ticket_assigned' | 'ticket_resolved' | 'qa_submitted' | 'other'
  ticket_id UUID NULL,
  status TEXT NOT NULL, -- 'sent' | 'failed'
  error TEXT NULL,
  gmail_message_id TEXT NULL,
  triggered_by UUID NULL
);

ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read email logs"
  ON public.email_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Inserts only happen from edge functions using the service role, which bypasses RLS.
-- No INSERT policy needed for clients.
