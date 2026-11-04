# Bookmarklet-first product and runtime architecture

## Product definition

Loonakulf Browser is designed as a **bookmarklet-first browser**: bookmarklets are a primary product primitive, not a secondary bookmark menu. The browser should make it straightforward to create, inspect, organize, test, run, version and export small page-level tools.

The intended differentiator is a focused environment for user-authored browser automation and page augmentation, presented through one shared interface and native platform shells. The phrase "first of its kind" is a product-positioning claim; this repository does not yet contain independent market research establishing global firstness.

## Core product surfaces

1. **Bookmarklet Library** — searchable collections, categories, tags, favorites and user-owned scripts.
2. **Builder** — source editor, JavaScript syntax diagnostics, metadata and preview.
3. **Inspector** — readable source, permissions requested, static risk findings and provenance.
4. **Execution Console** — run against the active tab only after an explicit user action and permission decision.
5. **Activity and rollback** — per-run outcome, timestamp, target origin and version history; never log page secrets or captured content by default.
6. **Import / export** — standard `javascript:` bookmarklet compatibility, with safe handling of untrusted imports.
7. **Cross-shell experience** — shared library and UI contract; platform-specific execution adapters remain responsible for enforcing policy.

## Runtime boundary

The shared React layer validates records and presents consent. It must not treat source validation or static scanning as proof of safety. Bookmarklet source is executable, untrusted code.

A production execution request should include:
- a stable bookmarklet identifier and immutable source version;
- the active tab identity and origin;
- an explicit user gesture;
- a permission decision scoped to that run and origin;
- a request ID, timeout and bounded source size.

The native shell must independently validate the sender, active target, origin, payload schema, size and permission. It must reject stale tab references and unknown bridge methods. Never expose generic shell execution, filesystem access, unrestricted IPC or a general-purpose native `eval` endpoint.

Bookmarklets necessarily execute in the target page's JavaScript context and can access what that page exposes to scripts. Sandboxing a bookmarklet in an isolated world changes its access to the page DOM; it is not a drop-in replacement. The browser must communicate this clearly and require confirmation for privileged actions.

## Shared module

`shared-react-ui/src/bookmarks/runtime.js` provides pure helpers:
- `normalizeBookmarkletSource` — bounded input normalization, no evaluation;
- `createBookmarkletRecord` — validates and creates a versioned metadata record;
- `inspectBookmarkletRisk` — heuristic findings, never a safety verdict;
- `BOOKMARKLET_LIMITS` — shared input limits.

The helper intentionally does not use `eval`, `new Function`, strip comments, or repeatedly decode percent-encoded source. A successful validation means only that the record meets basic structural limits.

## Security and privacy principles

- Default to no execution until the user explicitly runs a selected bookmarklet.
- Show the target origin and the source before first execution.
- Treat every imported/shared bookmarklet as untrusted, even if signed or popular.
- Ask before scripts that access cookies, credentials, storage, network APIs or forms.
- Do not persist page content, credentials, cookies or network payloads as execution telemetry.
- Do not rely on User-Agent, Client Hints or browser labels for security decisions.
- Revoke run-scoped permissions when the tab changes origin or closes.
- Keep the existing bookmarklet database compatible; introduce migrations rather than silently dropping records.

## Current implementation versus roadmap

Implemented in this change: shared source normalization, metadata validation, heuristic risk findings and unit tests.

Still required before production execution: integrate the module into the React builder/library, replace direct PyQt and Swift execution bridges with policy-enforcing adapters, add per-origin permissions, run isolation/abuse tests, and verify each native shell with its own build pipeline. Electron already has a sender check, but must also enforce user consent and origin-scoped authorization for bookmarklet runs.

## Product positioning language

Recommended concise description:

> Loonakulf Browser is a bookmarklet-first browser environment for building, organizing and running personal web tools across desktop and mobile shells.

Use "first-of-its-kind" as an aspiration or positioning statement only where it is clearly presented as a brand claim, not as a proven historical fact.
