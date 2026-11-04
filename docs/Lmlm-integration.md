---
Documentation date: 4 November 2026
Repository: auraecosystem/loonakulf-browser
Working branch: feat/lmlm-browser-intelligence
Pullrequest: 7 Latest commit recorded in this 
session: 920fd75617462780628942a61d8539c1025986f7
---

> This document consolidates the project-related discussion,
> implementation notes, decisions, verification results, and remaining
> work recorded in this conversation. It is a session record, not a
> claim that every feature is production-ready.

────────

# Loonakulf Browser — LMLM Integration & Engineering Session Documentation

1. Executive summary

The session focused on integrating the LMLM runtime and bounded
multi-agent inference into Loonakulf Browser, strengthening the local
Electron-to-Python boundary, improving provider configuration, and
addressing CI feedback.

The work recorded in this session includes:

• A local SQLite knowledge store with explicit user-controlled saving
and retrieval.
• Deterministic task routing for research, engineering, security, and
productivity.
• FastAPI endpoints for knowledge operations, planning, execution, and
assistance.
• A bounded multi-agent inference flow with specialist model endpoints
and a synthesis step.
• Bearer-token authentication for the local /v1/* API.
• Electron-managed startup and shutdown of the Python runtime, with an
ephemeral per-launch token.
• Provider-readiness checks that distinguish single-model from
multi-agent configuration.
• Regression tests and CI syntax-check updates.
• A React production-build lint correction.

The latest code was committed to the feature branch. The pull request
remained open and unmerged. The latest commits had no reported CI
workflow run or commit status at the time of the final check.

────────

2. Product and architecture boundaries

The project discussion maintains the following separation:

• Loonakulf Browser is the browser/runtime environment and
user-facing application.
• LMLM is the intelligence and execution-control layer integrated
with the browser.
• Specialist agents in the implementation described here perform
bounded model inference and synthesis. They are not autonomous
browser, shell, filesystem, or operating-system agents.
• External projects or unrelated source repositories are not to be
associated with Loonakulf unless explicitly requested.

The intended direction is a browser with an integrated local
intelligence runtime, clear trust boundaries, and explicit user control
over saved knowledge.

────────

3. Work already present before the latest runtime-bootstrap changes

3.1 Local knowledge store

>_+File: lmlm-runtime/knowledge_store.py

Recorded capabilities:

• SQLite-backed local knowledge storage.
• Explicit-save behavior rather than silently storing every page or
conversation.
• Environment-configurable data directory using LMLM_DATA_DIR.
• Default data location:
~/.local/share/loonakulf/lmlm/knowledge.sqlite3
• Restrictive directory and file permissions.
• Save, search, and delete operations.
• Bounds on stored content, title, and URL fields.

Security note:

• SQLite data is not encrypted at rest by this implementation.
• Full-disk encryption is recommended.
• Highly sensitive information should not be stored until
application-level encryption is implemented and reviewed.

3.2 Agent coordinator

>_File: lmlm-runtime/agent_coordinator.py

Recorded behavior:

• Deterministic routing for research, engineering, security, and
productivity tasks.
• A security perspective is always included in the routing strategy.
• Planning and task classification are distinct from tool execution.
• The coordinator’s routing logic does not itself grant agents browser
or operating-system privileges.

3.3 FastAPI runtime

File: lmlm-runtime/app.py

Endpoints recorded in the implementation:

────────

Endpoint                               Purpose

────────

```bash
POST /v1/knowledge                   Save a knowledge item; requires
explicit confirm_save=True.

GET /v1/knowledge/search             Search locally saved knowledge.

DELETE /v1/knowledge/{document_id}   Delete a saved knowledge item.

POST /v1/agents/plan                 Produce a task plan.

POST /v1/agents/execute              Execute bounded specialist
inference and synthesis.

POST /v1/assist                      Generate an assistant response,
with optional opt-in retrieval.

GET /health                          Readiness/health endpoint.
```
## The knowledge retrieval path is opt-in for assistant requests.

3.4 Electron and React integration

Recorded integration points:

• Electron IPC handlers support explicit page saving, assistant
requests, and agent planning/execution.
• The renderer does not need direct access to runtime secrets.
• React UI includes a control to save the current page to local
knowledge.
• React UI includes an opt-in control to use locally saved knowledge
in an answer.
• The assistant UI can display agent plans and bounded multi-agent
results.

3.5 Multi-agent inference
```cmd
>_File: lmlm-runtime/multi_agent_runtime.py
```
Recorded design:

• Up to three allowlisted specialist model requests can run
concurrently.
• Specialist roles are drawn from research, engineering, security, and
productivity.
• Security is always included.
• A synthesis model combines specialist outputs.
• At least one specialist must succeed for the multi-agent operation
to continue.
• Specialist outputs, errors, and execution time are bounded.
• The response identifies its execution mode as:
bounded_multi_agent_inference
• It reports:
  • tools_invoked=[]
  • browser_actions_performed=False

Important boundary:

This is bounded model orchestration, not autonomous tool use. The
specialists do not receive shell, filesystem, browser-control, or
OS-action capabilities in this implementation.

────────

4. Authenticated local IPC

4.1 Runtime API protection
```cmd
>_File: lmlm-runtime/app.py
```
Recorded changes:

• Added hmac comparison and FastAPI dependency/header handling.
• Runtime version was updated to 0.3.0.
• All /v1/* endpoints require an authorization header in the form:
Authorization: Bearer <token>
• The token is read from LMLM_IPC_TOKEN.
• If the token is not configured, protected endpoints fail closed with
HTTP 503.
• Invalid credentials return HTTP 401.
• /health remains unauthenticated for readiness checks.

4.2 Electron request authentication
```cmd
File: electron-shell/main.js
```
The Electron main process attaches the bearer token to requests to the
Python runtime. The renderer is not intended to receive the token.

The earlier environment-based arrangement required the Electron and
runtime processes to be started with the same LMLM_IPC_TOKEN. This
manual arrangement was then improved by the managed runtime bootstrap
described in Section 5.

4.3 Security limitations

Bearer-token authentication is a useful local boundary, but it is not
equivalent to operating-system peer authentication.

Outstanding concerns include:

• OS-level process/peer authentication.
• Secure packaged-runtime distribution.
• Rate limiting and abuse controls.
• Token lifecycle hardening and platform-specific review.
• Avoiding exposure of secrets through logs, renderer state, URLs, or
source control.

────────

5. Electron-managed runtime lifecycle

5.1 New runtime manager
```cmd
>_File: electron-shell/lmlm-runtime-manager.js
```
The session added an Electron-side runtime manager with the following
recorded behavior:

1. If LMLM_RUNTIME_URL is explicitly configured, Electron treats the
runtime as externally managed and uses the externally supplied
token.
2. Otherwise, Electron resolves the local Python runtime directory.
3. It selects an available loopback port.
4. It generates a fresh 256-bit bearer token in memory.
5. It starts Uvicorn bound to 127.0.0.1.
6. It passes LMLM_IPC_TOKEN to the child runtime process environment.
7. It verifies runtime readiness by making an authenticated request to
/v1/agents/plan.
8. It returns the runtime URL and token to the Electron main-process
module only.
9. Electron stops the managed child process when the application quits.

The token is rotated by generating a new random token for each managed
launch.

5.2 Main-process integration

>_File: electron-shell/main.js

Recorded changes:

• Imports startLmlmRuntime and stopLmlmRuntime.
• Stores the managed runtime handle in the Electron main process.
• Uses the managed runtime URL and token for LMLM requests when
available.
• Starts the runtime before creating the browser window.
• Stops the managed runtime during Electron’s before-quit lifecycle
event.
• Logs a startup failure message if the runtime cannot be started.

5.3 Runtime path correction

A follow-up correction changed the development runtime path to resolve
relative to the Electron shell directory:

path.join(__dirname, "..", "lmlm-runtime")

The packaged path uses the application resources directory and expects
the runtime to be placed under:

resources/lmlm-runtime

5.4 Important packaging caveat

The runtime manager starts Python using LMLM_PYTHON when configured,
or python/python3 by platform default. The session did not
establish that a standalone Python distribution and all runtime
dependencies are bundled into the Electron installer.

Therefore, packaged Python distribution and dependency installation
remain production-readiness work. The runtime manager implementation
should be validated on Windows, macOS, and Linux, including packaged
builds.

────────

6. Independent model endpoint routing

File: lmlm-runtime/multi_agent_runtime.py

Each specialist can be configured with its own endpoint, model
identifier, and API key.

────────

Role       |       Endpoint variable        |      Model variable     |         API key variable  |

────────

Research          LMLM_RESEARCH_BASE_URL  |     LMLM_RESEARCH_MODEL    |   LMLM_RESEARCH_API_KEY  |

Engineering       LMLM_ENGINEERING_BASE_URL|   LMLM_ENGINEERING_MODEL   | LMLM_ENGINEERING_API_KEY |

Security          LMLM_SECURITY_BASE_URL    |   LMLM_SECURITY_MODEL     |  LMLM_SECURITY_API_KEY.  |

Productivity      LMLM_PRODUCTIVITY_BASE_URL |  LMLM_PRODUCTIVITY_MODEL  | LMLM_PRODUCTIVITY_API_KEY|

Synthesis         LMLM_SYNTHESIS_BASE_URL    | LMLM_SYNTHESIS_MODEL      | LMLM_SYNTHESIS_API_KEY   |

Fallback variables:
```.env
• LMLM_MODEL_BASE_URL=
• LMLM_MODEL=
• LMLM_MODEL_API_KEY=
```
If a role-specific setting is omitted, the implementation can fall back
to the shared model configuration.

The normal single-model /v1/assist path uses the shared
LMLM_MODEL_BASE_URL. Role-specific endpoints are intended for
multi-agent inference.

────────

7. Provider-readiness correction

A configuration-reporting issue was identified: treating any
role-specific endpoint as proof that the normal single-model assistant
was configured could produce a misleading readiness result.

The session separated the checks in lmlm-runtime/app.py:

• provider_configured() checks whether the shared endpoint required
by single-model assistance is configured.
• multi_agent_provider_configured() checks for at least one
specialist endpoint and a synthesis endpoint, allowing the shared
endpoint to act as a fallback.
• The health response reports separate readiness values for
single-model and multi-agent inference.
• The multi-agent execution route uses the multi-agent-specific
readiness check.

Tests were added for: - A role-specific endpoint not incorrectly
satisfying single-model readiness. - Multi-agent readiness failing when
synthesis is not configured. - Multi-agent readiness accepting
role-specific specialist and synthesis endpoints.

The tests were then changed to use isolated environment patches
(clear=True) so host environment variables cannot unexpectedly affect
their outcomes.

────────

8. Test coverage recorded

File: lmlm-runtime/test_knowledge_agents.py

Tests added or recorded across the implementation include:

• Knowledge save/search/delete behavior.
• Explicit-save requirement.
• Opt-in knowledge retrieval.
• Agent task routing.
• Security specialist inclusion.
• Bounded specialist selection.
• Rejection of unknown specialist roles.
• Mocked specialist execution and synthesis.
• Specialist and synthesis model override selection.
• Local IPC authentication:
  • Missing token rejected.
  • Valid bearer token accepted.
  • Missing server token configuration fails closed.
• Provider readiness:
  • Single-model readiness requires shared endpoint.
  • Multi-agent readiness requires specialist and synthesis
configuration.
  • Role-specific endpoints can satisfy multi-agent readiness.

The test dependency httpx was expected to be available through the
runtime requirements, but a complete latest-commit test run was not
recorded in this session.

────────

9. CI investigation and React build correction

9.1 CI workflow

File: .github/workflows/ci-build-pipeline.yml

The workflow contains three jobs:

1. build-frontend
  • Installs shared UI dependencies.
  • Runs npm run test:platform.
  • Runs npm run build.
2. validate-electron-source
  • Runs Node syntax checks for Electron source files.
3. test-lmlm-runtime
  • Installs lmlm-runtime/requirements.txt.
  • Compiles app.py.
  • Runs python -m unittest -v.

A follow-up edit added:

node --check electron-shell/lmlm-runtime-manager.js

to the Electron syntax-validation job.

9.2 Observed CI result

A GitHub Actions run was inspected. The platform regression tests
passed:

• 10 tests executed.
• 10 passed.
• 0 failed.

The React production build then failed because CI treats ESLint warnings
as errors.

The reported issue was in shared-react-ui/src/App.js:

• bookmarklets was created with a logical-expression fallback:
useLiveQuery(...) || []
• That expression could create a new array on each render.
• The new array identity caused the useMemo dependency warnings at
the categories and filtered calculations.

9.3 Lint correction

The implementation was changed to:

const liveBookmarklets = useLiveQuery(() => db.bookmarklets.toArray(), []);
const bookmarklets = useMemo(() => liveBookmarklets || [], [liveBookmarklets]);

This stabilizes the fallback array through memoization and addresses the
dependency warning reported by the build.

9.4 Verification status after the correction

The recorded CI failure was from an earlier commit, before the lint
correction. Subsequent commits added the correction and other changes.

At the final check in this session:

• The latest branch commit had no reported commit statuses.
• No workflow run was returned for the latest commit.
• The earlier platform test result remains valid for the commit on
which it ran.
• The earlier production build failure is known and the identified
lint issue was patched.
• A successful production build and a full passing CI run on the
latest commit were not verified.

Do not describe the latest build, Python suite, or complete CI pipeline
as passing until a new run confirms it.

────────

10. Repository history and pull request state

The session’s recorded commit sequence includes:

────────

Commit                                       Recorded purpose

────────
`
86bafe3a44c3aec8c3ddc2a5e78135f0f80553a1   Authenticated local IPC, specialist
model routing, and
tests/documentation.
38f79b2ad59b2b33ed874ee32330507d43818d57   Added Electron-managed runtime
startup/lifecycle work and provider
readiness changes in the observed
sequence.
b5ed933805e91173c0551088fb7bcb0a037799d1   Follow-up implementation commit
observed during the session.
e32dcd542bafae430cd8e0a1b63f1d9b85e364d4   React bookmarklet memoization lint
correction.
6959791e7ea21ad29b11262b09cb2901074b218d   CI syntax check for the runtime
manager.
d361de38e1704fab97092090a94552e27822d7ed   Isolated provider-readiness test
environment.
920fd75617462780628942a61d8539c1025986f7   Runtime development-path correction; latest commit reported in the final session response.
`
The exact commit-purpose mapping above is based on the changes recorded
during the conversation. Consult the Git commit history for
authoritative per-commit diffs.

Pull request #7:

• URL: https://github.com/auraecosystem/loonakulf-browser/pull/7
• State at final check: open.
• Draft status at final check: false.
• Base branch: main.
• Merge status: not merged.
• GitHub reported mergeable: false at one check during the session.
Re-check current mergeability before merging.

────────

11. Outstanding engineering work

The following work remains before the implementation should be
considered production-ready.

Security and privacy

• Implement OS-level peer/process authentication in addition to
bearer-token protection.
• Review token lifecycle, process boundaries, and platform-specific
secret handling.
• Add rate limiting and abuse controls.
• Implement application-level encryption for local SQLite knowledge.
• Review log handling to ensure secrets and sensitive request data are
not exposed.

Runtime packaging and lifecycle

• Bundle or reliably provision Python and all runtime dependencies.
• Validate runtime location in packaged Electron builds.
• Test startup timeout, early process exit, crash recovery, and
shutdown behavior.
• Verify port allocation and process termination behavior on Windows,
macOS, and Linux.
• Add robust runtime health reporting and user-facing recovery
behavior.

Model/provider operations

• Define provider policy, key handling, timeouts, and cost controls.
• Validate per-role endpoint configuration with real providers.
• Test partial specialist failures and synthesis behavior.
• Clarify health/readiness behavior for all supported deployment
configurations.

Application integration

• Run full Electron/React/Python integration tests.
• Validate renderer-to-main IPC boundaries.
• Implement and test PyQt/Swift bridges if those platform integrations
remain in scope.
• Add a complete knowledge-management UI if users need to browse and
manage saved items without using API calls.

Release process

• Trigger CI on the latest branch head.
• Confirm platform tests, React build, Electron syntax validation,
Python compilation, and Python unit tests.
• Resolve any newly surfaced failures.
• Re-check PR mergeability and review requirements before merging.

────────

12. Operational configuration reference

Managed local runtime

In the managed Electron mode, do not manually expose the IPC token to
the renderer. Electron is intended to:

• Generate the token.
• Pass it to the runtime child process.
• Attach it to main-process HTTP requests.
• Stop the managed child on application quit.

The runtime directory must be present where the runtime manager expects
it.

External runtime mode

If an external runtime is used, configure the Electron process with:
```.env
export LMLM_RUNTIME_URL="http://127.0.0.1:8765"
export LMLM_IPC_TOKEN="<same-token-configured-for-runtime>"
```
# The Python runtime must receive the same token:
```.env
export LMLM_IPC_TOKEN="<same-token-configured-for-runtime>"
uvicorn app:app --host 127.0.0.1 --port 8765
```
Generate a strong token with:

>_python -c 'import secrets; print(secrets.token_urlsafe(32))'

Never put the token in renderer code, URLs, logs, or source control.

Shared provider fallback
```.env
export LMLM_MODEL_BASE_URL="https://your-provider.example/v1"
export LMLM_MODEL="your-model-id"
export LMLM_MODEL_API_KEY="your-api-key"
```
# Specialist provider overrides

Example environment variable names:
```.env
export LMLM_RESEARCH_BASE_URL="https://research-provider.example/v1"
export LMLM_RESEARCH_MODEL="research-model"
export LMLM_RESEARCH_API_KEY="research-key"

export LMLM_ENGINEERING_BASE_URL="https://engineering-provider.example/v1"
export LMLM_ENGINEERING_MODEL="engineering-model"
export LMLM_ENGINEERING_API_KEY="engineering-key"

export LMLM_SECURITY_BASE_URL="https://security-provider.example/v1"
export LMLM_SECURITY_MODEL="security-model"
export LMLM_SECURITY_API_KEY="security-key"

export LMLM_PRODUCTIVITY_BASE_URL="https://productivity-provider.example/v1"
export LMLM_PRODUCTIVITY_MODEL="productivity-model"
export LMLM_PRODUCTIVITY_API_KEY="productivity-key"

export LMLM_SYNTHESIS_BASE_URL="https://synthesis-provider.example/v1"
export LMLM_SYNTHESIS_MODEL="synthesis-model"
export LMLM_SYNTHESIS_API_KEY="synthesis-key"
```
These are configuration examples, not real credentials or confirmed
provider URLs.

────────

13. Conversation decisions and execution record

The project conversation established or reiterated these practical
expectations:

• ^D means execute the requested work.
• Inspect the existing repository before changing it.
• Preserve existing functionality while implementing changes.
• Make real repository changes when execution is requested and
connected tools permit it.
• Report what was actually changed.
• Distinguish tests that were added from tests that were executed.
• Do not claim CI success without a successful run on the relevant
commit.
• Keep Loonakulf Browser and LMLM project boundaries clear.
• Document implementation in the repository’s documentation rather
than substituting a chat-only visualization or explanation when
repository documentation is requested.

The final state of this session is a series of commits on the feature
branch and an open pull request. It is not a merged release.

────────

14. Final status snapshot

────────

Area                                Session status

────────

Local knowledge store               Implemented; plaintext SQLite at
rest.

Agent routing/planning              Implemented.
```>_
Bounded multi-agent inference       Implemented; model orchestration
only, no autonomous tools.

Independent specialist model        Implemented.
routing

/v1/* bearer-token protection     Implemented.

Electron-managed runtime startup    Implemented in source; packaged
runtime still needs validation.

Ephemeral per-launch token          Implemented in source for managed
mode.

Runtime shutdown on Electron quit   Implemented in source.

Provider readiness distinction      Implemented with tests added.

React lint correction               Patched; latest successful build
not verified.

Platform regression tests           10/10 passed in the inspected
earlier CI run.

Latest full CI                      Not verified.

OS-level peer authentication        Outstanding.

SQLite application-level encryption Outstanding.

Python runtime bundling             Outstanding.

Cross-platform integration tests    Outstanding.
```
PR #7                               Open, not merged.

`Latest recorded branch commit:
920fd75617462780628942a61d8539c1025986f7`

Next recommended engineering action: run the complete CI pipeline
against the latest branch head, fix any failures, then validate packaged
runtime startup and shutdown on each supported desktop platform.
