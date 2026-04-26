import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { endpoint, payload } = await req.json();

    if (!endpoint || typeof endpoint !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid 'endpoint'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pythonApiUrl = Deno.env.get("PYTHON_API_URL");
    if (!pythonApiUrl) {
      return new Response(JSON.stringify({ error: "Python API URL not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = `${pythonApiUrl.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseBody = await response.text();
    const contentType = response.headers.get("Content-Type") || "application/json";

    return new Response(responseBody, {
      status: response.status,
      headers: { ...corsHeaders, "Content-Type": contentType },
    });
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "Request to Python API timed out"
      : `Proxy error: ${error instanceof Error ? error.message : String(error)}`;

    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
