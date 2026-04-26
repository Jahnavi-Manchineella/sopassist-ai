-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Add 384-dim embedding column (sentence-transformers/all-MiniLM-L6-v2)
ALTER TABLE public.document_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(384);

-- IVFFlat index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON public.document_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Semantic search function using cosine similarity
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(384),
  category_filter text DEFAULT NULL,
  match_limit int DEFAULT 5,
  similarity_threshold float DEFAULT 0.3
)
RETURNS TABLE (
  chunk_id uuid,
  chunk_content text,
  chunk_section_title text,
  chunk_document_id uuid,
  doc_name text,
  doc_category text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    dc.id,
    dc.content,
    dc.section_title,
    dc.document_id,
    d.name,
    d.category,
    1 - (dc.embedding <=> query_embedding) AS similarity
  FROM public.document_chunks dc
  JOIN public.documents d ON d.id = dc.document_id
  WHERE dc.embedding IS NOT NULL
    AND d.is_latest = true
    AND (category_filter IS NULL OR d.category = category_filter)
    AND 1 - (dc.embedding <=> query_embedding) > similarity_threshold
  ORDER BY dc.embedding <=> query_embedding ASC
  LIMIT match_limit;
$$;