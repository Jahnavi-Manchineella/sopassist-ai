

## Plan: Create Python API Proxy Edge Function

### What
Create an edge function that acts as a proxy between the frontend and an external Python API, forwarding requests and returning responses. This allows integrating Python-based processing (ML models, data pipelines, etc.) into the existing TypeScript/React app.

### Steps

1. **Add the Python API URL as a secret**
   - Use the `add_secret` tool to request `PYTHON_API_URL` from the user (e.g. `https://my-python-api.com`)

2. **Create edge function `supabase/functions/python-proxy/index.ts`**
   - Accepts POST requests with a JSON body containing `endpoint` (the path on the Python API) and `payload` (data to forward)
   - Authenticates the caller via Supabase JWT
   - Forwards the request to `${PYTHON_API_URL}/${endpoint}` with the payload
   - Returns the Python API response back to the client
   - Full CORS support
   - Error handling for timeouts, unreachable API, etc.

3. **Update `supabase/config.toml`**
   - Add `[functions.python-proxy]` with `verify_jwt = false`

4. **Create a client helper `src/lib/python-proxy.ts`**
   - Utility function to call the proxy from the frontend via `supabase.functions.invoke('python-proxy', { body: { endpoint, payload } })`
   - Typed interface for request/response

### Usage Example
```typescript
// Frontend usage
import { callPythonAPI } from "@/lib/python-proxy";

const result = await callPythonAPI("analyze", { text: "some data" });
// Proxies to: https://my-python-api.com/analyze
```

### Security
- JWT verification in function code ensures only authenticated users can call it
- Python API URL stored as a secret, never exposed to the client

