# LMLM Browser Runtime

A small loopback service that connects Loonakulf Browser to a configurable
OpenAI-compatible inference endpoint, with opt-in local knowledge, deterministic planning, and opt-in bounded
multi-agent inference. It is not the complete LMLM autonomous-agent platform.

## Run

Python 3.11+ is recommended.

```bash
cd lmlm-runtime
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Example: local OpenAI-compatible inference server
export LMLM_MODEL_BASE_URL=http://127.0.0.1:1234/v1
export LMLM_MODEL=your-local-model-id

uvicorn app:app --host 127.0.0.1 --port 8765
```

For Windows PowerShell, use `$env:NAME="value"` instead of `export`.
Set `LMLM_MODEL_API_KEY` only when the configured provider requires it.
The key stays in the runtime process and is never sent to the browser renderer.

## Provider configuration

- `LMLM_MODEL_BASE_URL`: base URL of an OpenAI-compatible chat-completions API.
- `LMLM_MODEL`: provider model identifier.
- `LMLM_MODEL_API_KEY`: optional provider credential.

The runtime supports local model servers and compatible hosted endpoints.
A provider is not bundled; LMLM remains independent of any one model vendor.

## Browser connection

Electron's main process calls this service over loopback. The renderer can only
invoke the narrow `browserAPI.getLmlmStatus()` and `browserAPI.askLmlm()`
methods exposed by preload. It cannot access the provider key or make arbitrary
native calls through this integration.

Page text is shared for analysis only when the user enables the
"Include active page text" option. Saving a page is a separate explicit action.
Model output is displayed as text; it is never executed.

## Security and limitations

- Bind the service to `127.0.0.1`, not `0.0.0.0`.
- Keep the runtime endpoint loopback-only in Electron configuration.
- Do not expose this service directly to the public internet.
- Multi-agent mode provides bounded text-only inference, not autonomous navigation,
  form submission, bookmarklet execution, or general-purpose tool delegation.
- Production deployment still needs authenticated local IPC/service lifecycle,
  rate limits, model-provider policy, privacy controls, and platform-specific
  bridge implementations for PyQt and Swift.


## Local knowledge and agent routing

The runtime includes an explicit-consent SQLite knowledge store.

- Use **Save current page to local knowledge** in the Electron assistant to save the active page. This is user-triggered, not background collection.
- The database defaults to `~/.local/share/loonakulf/lmlm/knowledge.sqlite3`.
- Set `LMLM_DATA_DIR` to choose another local data directory.
- Enable **Use my locally saved knowledge** to retrieve matching saved text in an assistant request. Retrieved text remains untrusted reference data.
- API: `POST /v1/knowledge`, `GET /v1/knowledge/search?q=...`, and `DELETE /v1/knowledge/{document_id}`.


**At-rest protection:** the initial SQLite store is local and uses restrictive filesystem permissions where supported, but it is not encrypted. Use full-disk encryption on the host and do not store highly sensitive material until application-level encryption and authenticated local IPC are implemented.

The agent coordinator exposes `POST /v1/agents/plan` for deterministic routing and `POST /v1/agents/execute` for opt-in inference. Multi-agent mode launches up to three allowlisted specialist requests (research, engineering, security, productivity) concurrently against the configured OpenAI-compatible provider, then runs a synthesis request. At least one specialist must succeed. Requests and outputs are bounded; specialist failures are reported without discarding successful results. This is model orchestration, not autonomous tool use: agents cannot browse, call tools, execute code, access files, or perform browser/OS actions. Electron keeps multi-agent mode opt-in and raises its request timeout for the extra inference round trips. The same configured model endpoint is used for all roles; per-role model routing is not yet implemented.

Run tests with:

```bash
python -m unittest -v
```
