-- Add new role enum values for SOPAssist banking ops roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'process_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'process_analyst';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'senior_manager';