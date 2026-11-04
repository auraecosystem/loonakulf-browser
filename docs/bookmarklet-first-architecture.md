# Bookmarklet-first product and runtime architecture

## Product definition

Loonakulf Browser is designed as a **bookmarklet-first browser**: bookmarklets are a primary product primitive, not a secondary bookmark menu. The browser should make it straightforward to create, inspect, organize, test, run, version and export small page-level tools.

The intended differentiator is a focused environment for user-authored browser automation and page augmentation, presented through one shared interface and native platform shells. The phrase "first of its kind" is a product-positioning claim; this repository does not yet contain independent market research establishing global firstness.

## Core product surfaces

1. **Bookmarklet Library** — searchable collections, categories, tags, favorites and user-owned scripts.
2. **Builder** — source editor, bounded input validation, metadata and preview; syntax is not treated as a safety check.
3. **Inspector** — readable source, permissions requested, static risk findings and provenance.
4. **Execution Console** — run against the active tab only after an explicit user action and permission decision.
5. **Activity and rollback** — per-run outcome, timestamp, target origin and version history; never log page secrets or captured content by default.
6. **Import / export** — standard `javascript:` bookmarklet compatibility, with safe handling of untrusted imports.
7. **Cross-shell experience** — shared library and UI contract; platform-specific execution adapters remain responsible for enforcing policy.

## Runtime boundary

The shared React layer validates records and sends a typed run request. Each native shell independently validates the caller, payload and active target, then displays a native confirmation for every run. Static scanning is advisory only. Bookmarklet source is executable, untrusted code.

A production execution request should include:
- a stable bookmarklet identifier and immutable source version;
- the active tab identity and origin, derived by the native shell;
- an explicit user gesture and native confirmation;
- a permission decision scoped to that run and origin;
- a request ID, timeout and bounded source size.

The current bridge uses a smaller `{ title, source }` request and prompts on every run. It does not persist standing permissions.

The native shell must independently validate the sender, active target, origin, payload schema and size. The current adapters show a native consent prompt for each run and recheck the target origin after consent. They must reject stale tab references and unknown bridge methods. Never expose generic shell execution, filesystem access, unrestricted IPC or a general-purpose native `eval` endpoint.

Bookmarklets necessarily execute in the target page's JavaScript context and can access what that page exposes to scripts. Sandboxing a bookmarklet in an isolated world changes its access to the page DOM; it is not a drop-in replacement. The browser must communicate this clearly and require confirmation for privileged actions.

## Shared module

`shared-react-ui/src/bookmarks/runtime.js` provides pure helpers:
- `normalizeBookmarkletSource` — bounded input normalization, no evaluation;
- `validateBookmarkletRequest` — checks the typed native run-request shape and bounds;
- `createBookmarkletRecord` — validates and creates a versioned metadata record;
- `inspectBookmarkletRisk` — heuristic findings, never a safety verdict;
- `BOOKMARKLET_LIMITS` — shared input limits.

The helper does not use `eval` or `new Function`, strip comments, or repeatedly decode percent-encoded source. The legacy `processAndValidateBookmarklet` entry point now performs structural checks only; it does not claim to prove JavaScript syntax or safety. A successful validation means only that the record meets basic input limits.

## Security and privacy principles

- Default to no execution until the user explicitly runs a selected bookmarklet.
- Show the target origin and a 600-character source preview in the native confirmation for every run.
- Treat every imported/shared bookmarklet as untrusted, even if signed or popular.
- Require confirmation for every run; static findings are advisory and do not replace consent.
- Do not persist page content, credentials, cookies or network payloads as execution telemetry.
- Do not rely on User-Agent, Client Hints or browser labels for security decisions.
- Revoke run-scoped permissions when the tab changes origin or closes.
- Keep the existing bookmarklet database compatible; introduce migrations rather than silently dropping records.

## Current implementation versus roadmap

Implemented on this feature branch: shared source normalization and request validation; React builder/library integration; advisory risk findings; per-run native consent and source previews in Electron, PyQt and Swift; native UI-origin, payload-size and active-target checks.

Still required before production: replace the development-server trust origin with a packaged local origin; define a versioned bridge with structured results; add bookmarklet version history and origin-scoped permission management; test navigation races and hostile payloads; and validate each native shell on its actual platform. The current confirmation is per-run and does not persist permission grants.

## Product positioning language

Recommended concise description:

> Loonakulf Browser is a bookmarklet-first browser environment for building, organizing and running personal web tools across desktop and mobile shells.

Use "first-of-its-kind" as an aspiration or positioning statement only where it is clearly presented as a brand claim, not as a proven historical fact.
