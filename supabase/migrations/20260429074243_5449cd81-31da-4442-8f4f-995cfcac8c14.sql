-- 1. QA table
CREATE TABLE public.ticket_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  qa_type text NOT NULL CHECK (qa_type IN ('requester_rating', 'admin_review')),
  reviewer_id uuid NOT NULL,
  reviewer_email text,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  verdict text CHECK (verdict IN ('approved', 'needs_rework')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ticket_qa_unique_per_type
  ON public.ticket_qa (ticket_id, qa_type, reviewer_id);

ALTER TABLE public.ticket_qa ENABLE ROW LEVEL SECURITY;

-- View: requester sees own QA, staff see all
CREATE POLICY "View QA for accessible tickets"
  ON public.ticket_qa FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_qa.ticket_id
        AND (t.user_id = auth.uid()
             OR public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'sme'::app_role))
    )
  );

-- Requester can insert their own rating; admin can insert review
CREATE POLICY "Requester rates own resolved ticket"
  ON public.ticket_qa FOR INSERT TO authenticated
  WITH CHECK (
    qa_type = 'requester_rating'
    AND reviewer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_qa.ticket_id
        AND t.user_id = auth.uid()
        AND t.status IN ('resolved', 'closed')
    )
  );

CREATE POLICY "Admin posts QA review"
  ON public.ticket_qa FOR INSERT TO authenticated
  WITH CHECK (
    qa_type = 'admin_review'
    AND reviewer_id = auth.uid()
    AND public.has_role(auth.uid(), 'admin'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_qa.ticket_id
        AND t.status IN ('resolved', 'closed')
    )
  );

-- 2. Trigger: reopen ticket on "needs_rework"
CREATE OR REPLACE FUNCTION public.handle_qa_rework()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.qa_type = 'admin_review' AND NEW.verdict = 'needs_rework' THEN
    UPDATE public.tickets
    SET status = 'in_progress', resolved_at = NULL
    WHERE id = NEW.ticket_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ticket_qa_rework_trigger
  AFTER INSERT ON public.ticket_qa
  FOR EACH ROW EXECUTE FUNCTION public.handle_qa_rework();

-- 3. Admin member management on user_roles
CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Admin can read all profiles (to list users)
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));