-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General Operations',
  content TEXT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read documents" ON public.documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert documents" ON public.documents FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete documents" ON public.documents FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Document chunks table
CREATE TABLE public.document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  section_title TEXT
);
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read chunks" ON public.document_chunks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert chunks" ON public.document_chunks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  citations JSONB,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);
CREATE POLICY "Users can insert own messages" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
);

-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  query TEXT NOT NULL,
  response TEXT,
  retrieved_chunks JSONB,
  category TEXT DEFAULT 'General Operations',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger for auto-creating profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed demo documents
INSERT INTO public.documents (id, name, file_type, category, content) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Banking SOP Manual', 'txt', 'SOP', 'Standard Operating Procedures for Daily Banking Operations

Section 1: Account Opening Procedures
All new account openings must follow the KYC (Know Your Customer) verification process. Required documents include: government-issued photo ID, proof of address dated within 90 days, and completed account application form. For business accounts, additional documentation includes certificate of incorporation, board resolution, and beneficial ownership declaration.

Section 2: Transaction Processing
All transactions above $10,000 must be reported through the Currency Transaction Report (CTR). Wire transfers require dual authorization from two authorized officers. Same-day settlement is available for domestic transfers initiated before 2:00 PM EST.

Section 3: Cash Handling Procedures
Cash drawers must be balanced at the beginning and end of each shift. Discrepancies exceeding $50 must be reported to the branch manager immediately. All cash shipments must be logged in the vault management system with dual custody requirements.

Section 4: Customer Service Standards
Response time for customer inquiries: phone calls within 3 rings, emails within 24 hours, in-branch wait time not to exceed 10 minutes. Escalation procedures require supervisor involvement for complaints unresolved within 48 hours.'),

  ('00000000-0000-0000-0000-000000000002', 'Compliance Policy Framework', 'txt', 'Compliance', 'Compliance Policy Framework - Version 3.2

Section 1: Anti-Money Laundering (AML) Policy
All employees must complete AML training annually. Suspicious Activity Reports (SARs) must be filed within 30 days of detection. Enhanced due diligence is required for politically exposed persons (PEPs) and high-risk jurisdictions as defined by FATF.

Section 2: Data Privacy and Protection
Customer data must be encrypted at rest and in transit using AES-256 encryption. Access to customer records requires role-based authentication. Data retention period is 7 years for transaction records and 5 years for account documentation. GDPR and CCPA compliance is mandatory for applicable jurisdictions.

Section 3: Regulatory Reporting
Quarterly Call Reports must be submitted to the OCC within 30 days of quarter-end. Annual stress test results must be reported to the Federal Reserve by April 5th. HMDA data must be submitted annually by March 1st.

Section 4: Internal Audit Requirements
Internal audits must be conducted quarterly for high-risk areas and annually for standard operations. Audit findings must be remediated within 90 days for critical issues and 180 days for non-critical findings.'),

  ('00000000-0000-0000-0000-000000000003', 'Customer Onboarding Procedure', 'txt', 'SOP', 'Customer Onboarding Procedure Guide

Section 1: Individual Account Onboarding
Step 1: Identity Verification - Verify government-issued ID using the automated ID verification system. Cross-reference against OFAC sanctions list and internal watchlists.
Step 2: Risk Assessment - Complete customer risk rating questionnaire. Assign risk level (Low/Medium/High) based on occupation, transaction patterns, and geographic factors.
Step 3: Product Selection - Present appropriate product recommendations based on customer needs assessment. Ensure suitability compliance for investment products.
Step 4: Account Activation - Generate account number, issue debit card, set up online banking credentials, and schedule 30-day follow-up call.

Section 2: Business Account Onboarding
Additional requirements include: business license verification, UBO (Ultimate Beneficial Owner) identification for ownership exceeding 25%, and industry-specific compliance checks for regulated sectors (gaming, cryptocurrency, cannabis).

Section 3: Digital Onboarding
Remote onboarding requires video KYC verification for accounts above $50,000. Digital signatures are accepted for standard accounts. Biometric enrollment is mandatory for mobile banking access.');

-- Seed document chunks
INSERT INTO public.document_chunks (document_id, chunk_index, content, section_title) VALUES
  ('00000000-0000-0000-0000-000000000001', 0, 'All new account openings must follow the KYC (Know Your Customer) verification process. Required documents include: government-issued photo ID, proof of address dated within 90 days, and completed account application form. For business accounts, additional documentation includes certificate of incorporation, board resolution, and beneficial ownership declaration.', 'Account Opening Procedures'),
  ('00000000-0000-0000-0000-000000000001', 1, 'All transactions above $10,000 must be reported through the Currency Transaction Report (CTR). Wire transfers require dual authorization from two authorized officers. Same-day settlement is available for domestic transfers initiated before 2:00 PM EST.', 'Transaction Processing'),
  ('00000000-0000-0000-0000-000000000001', 2, 'Cash drawers must be balanced at the beginning and end of each shift. Discrepancies exceeding $50 must be reported to the branch manager immediately. All cash shipments must be logged in the vault management system with dual custody requirements.', 'Cash Handling Procedures'),
  ('00000000-0000-0000-0000-000000000001', 3, 'Response time for customer inquiries: phone calls within 3 rings, emails within 24 hours, in-branch wait time not to exceed 10 minutes. Escalation procedures require supervisor involvement for complaints unresolved within 48 hours.', 'Customer Service Standards'),
  ('00000000-0000-0000-0000-000000000002', 0, 'All employees must complete AML training annually. Suspicious Activity Reports (SARs) must be filed within 30 days of detection. Enhanced due diligence is required for politically exposed persons (PEPs) and high-risk jurisdictions as defined by FATF.', 'Anti-Money Laundering Policy'),
  ('00000000-0000-0000-0000-000000000002', 1, 'Customer data must be encrypted at rest and in transit using AES-256 encryption. Access to customer records requires role-based authentication. Data retention period is 7 years for transaction records and 5 years for account documentation. GDPR and CCPA compliance is mandatory for applicable jurisdictions.', 'Data Privacy and Protection'),
  ('00000000-0000-0000-0000-000000000002', 2, 'Quarterly Call Reports must be submitted to the OCC within 30 days of quarter-end. Annual stress test results must be reported to the Federal Reserve by April 5th. HMDA data must be submitted annually by March 1st.', 'Regulatory Reporting'),
  ('00000000-0000-0000-0000-000000000002', 3, 'Internal audits must be conducted quarterly for high-risk areas and annually for standard operations. Audit findings must be remediated within 90 days for critical issues and 180 days for non-critical findings.', 'Internal Audit Requirements'),
  ('00000000-0000-0000-0000-000000000003', 0, 'Identity Verification - Verify government-issued ID using the automated ID verification system. Cross-reference against OFAC sanctions list and internal watchlists. Risk Assessment - Complete customer risk rating questionnaire. Assign risk level based on occupation, transaction patterns, and geographic factors.', 'Individual Account Onboarding'),
  ('00000000-0000-0000-0000-000000000003', 1, 'Additional requirements include: business license verification, UBO (Ultimate Beneficial Owner) identification for ownership exceeding 25%, and industry-specific compliance checks for regulated sectors (gaming, cryptocurrency, cannabis).', 'Business Account Onboarding'),
  ('00000000-0000-0000-0000-000000000003', 2, 'Remote onboarding requires video KYC verification for accounts above $50,000. Digital signatures are accepted for standard accounts. Biometric enrollment is mandatory for mobile banking access.', 'Digital Onboarding');
