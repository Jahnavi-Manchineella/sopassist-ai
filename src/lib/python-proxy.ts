import { supabase } from "@/integrations/supabase/client";

export interface PythonProxyResponse<T = unknown> {
  data: T | null;
  error: string | null;
}

export async function callPythonAPI<T = unknown>(
  endpoint: string,
  payload?: Record<string, unknown>
): Promise<PythonProxyResponse<T>> {
  const { data, error } = await supabase.functions.invoke("python-proxy", {
    body: { endpoint, payload },
  });

  if (error) {
    return { data: null, error: error.message };
  }

  if (data?.error) {
    return { data: null, error: data.error };
  }

  return { data: data as T, error: null };
}
