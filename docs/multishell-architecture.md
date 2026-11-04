# Multi-shell architecture

## Design goal

Keep one browser interface and one set of browser workflows in `shared-react-ui`. Treat Electron, PyQt and Swift as platform adapters, not separate browser products.

## Responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| `shared-react-ui` | UI state, bookmarklet management, diagnostics, shared validation and bridge client | Native process lifecycle or unrestricted operating-system access |
| `electron-shell` | Window lifecycle, WebContents, navigation policy, IPC validation and desktop packaging | UI business rules duplicated from React |
| `pyqt-shell` | Qt application lifecycle, QWebEngine configuration and a constrained Qt bridge | Arbitrary execution from untrusted UI messages |
| `swift-shell/BrowserApp` | UIKit lifecycle, WKWebView configuration, navigation delegates and message handlers | Unvalidated JavaScript execution or unrestricted native calls |

## Bridge contract

A production bridge should be explicit, versioned and capability-based. The shared UI should depend on a small adapter with these conceptual operations:

- `getRuntimeInfo()` — returns shell name, bridge version and supported capabilities.
- `navigate(url)` — accepts only validated HTTP(S) URLs.
- `goBack()`, `goForward()`, `reload()` — browser navigation controls.
- `clearSiteData()` — asks the shell to clear the selected browsing data scope.
- `setProxy(config)` — validates protocol, host and port in the native shell.
- `executeBookmarklet({ title, source })` — privileged operation. The native shell validates the caller, request size and active HTTP(S) target, then asks for per-run confirmation before execution.

The shell must validate every message independently. A UI-side check is not a security boundary. Do not expose generic `eval`, arbitrary filesystem access, shell commands, or unrestricted IPC methods. Reject malformed payloads, oversized strings, untrusted origins and stale/destroyed web-view references. Bookmarklet requests must be confirmed natively for every run; consent is not a trust verdict.

## Platform identity versus capabilities

User-Agent strings and Client Hints are untrusted, privacy-sensitive hints. Use them only for compatibility diagnostics. Determine actual runtime capabilities by feature detection and by querying the shell bridge. Never use browser identity to grant privileges.

Request high-entropy Client Hints only after a clear user action and only for a feature that needs them. Avoid persisting raw User-Agent strings or detailed device identifiers without a defined product need.

## Current implementation status

- **Shared React UI:** bookmarklet builder, local library, bounded source normalization, bridge-request validation and heuristic risk findings are integrated. The UI sends a typed `{ title, source }` request to the native adapter. Static inspection is advisory and is not a safety verdict.
- **Electron:** main/preload split, main-frame sender checks, localhost UI-origin restriction, bounded request validation, native per-run consent with a source preview, and target-origin recheck are implemented on this branch. The trusted UI URL is still the development server; packaged-origin support and end-to-end tests remain outstanding.
- **PyQt:** the two-view Qt container validates the UI origin and request shape, bounds source size, asks for native per-run consent with a source preview, and rechecks the target origin before execution. It remains a prototype pending packaged-origin support and end-to-end tests.
- **Swift:** the UIKit/WKWebView adapter restricts UI navigation, validates main-frame message origin and request bounds, asks for native per-run consent with a source preview, and rechecks the target origin. It remains a prototype pending an Xcode project, packaged-origin strategy and device testing.
- **Backend:** no backend service is present; browser UI must not assume a remote UA endpoint.

## Recommended implementation sequence

1. Keep the React production build and bookmarklet/platform regression tests green.
2. Replace the development-server trust origin with a packaged, authenticated local UI origin in each shell.
3. Formalize a versioned bridge contract with structured success/failure results and explicit capability discovery.
4. Add bookmarklet version history, run history and origin-scoped permission management without persisting page content or secrets.
5. Add end-to-end tests for user cancellation, malformed payloads, navigation races and cross-origin changes in Electron and PyQt.
6. Add an Xcode project, compile the Swift adapter on macOS, and test the WKWebView bridge on a real iOS device.
7. Add reproducible native packaging and release pipelines.
