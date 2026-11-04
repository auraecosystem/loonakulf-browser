# LMLM Browser Runtime

A small loopback service that connects Loonakulf Browser to a configurable
OpenAI-compatible inference endpoint. It is an initial integration slice, not
the complete LMLM autonomous-agent platform.

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

Page text is collected only when the user explicitly enables the
"Include active page text" option for a request. It is limited to 12,000
characters, is treated as untrusted context, and is not persisted by this
service. Model output is displayed as text; it is never executed.

## Security and limitations

- Bind the service to `127.0.0.1`, not `0.0.0.0`.
- Keep the runtime endpoint loopback-only in Electron configuration.
- Do not expose this service directly to the public internet.
- The initial slice provides contextual assistance, not autonomous navigation,
  form submission, bookmarklet execution, or agent delegation.
- Production deployment still needs authenticated local IPC/service lifecycle,
  rate limits, model-provider policy, privacy controls, and platform-specific
  bridge implementations for PyQt and Swift.
