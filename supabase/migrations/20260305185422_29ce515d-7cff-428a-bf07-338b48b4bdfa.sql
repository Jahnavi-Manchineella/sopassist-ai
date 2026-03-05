
-- Add full-text search column to document_chunks
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS fts tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(section_title, '') || ' ' || content)) STORED;

CREATE INDEX IF NOT EXISTS idx_document_chunks_fts ON public.document_chunks USING gin(fts);

-- Add document versioning columns
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS parent_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS is_latest boolean NOT NULL DEFAULT true;

-- Create full-text search function with optional category filter
CREATE OR REPLACE FUNCTION public.search_chunks(
  query_text text,
  category_filter text DEFAULT NULL,
  match_limit int DEFAULT 5
)
RETURNS TABLE(
  chunk_id uuid,
  chunk_content text,
  chunk_section_title text,
  chunk_document_id uuid,
  doc_name text,
  doc_category text,
  rank real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    dc.id,
    dc.content,
    dc.section_title,
    dc.document_id,
    d.name,
    d.category,
    ts_rank(dc.fts, websearch_to_tsquery('english', query_text))
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.fts @@ websearch_to_tsquery('english', query_text)
    AND (category_filter IS NULL OR d.category = category_filter)
    AND d.is_latest = true
  ORDER BY ts_rank(dc.fts, websearch_to_tsquery('english', query_text)) DESC
  LIMIT match_limit;
$$;
