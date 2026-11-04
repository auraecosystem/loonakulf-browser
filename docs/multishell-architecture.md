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
- `executeBookmarklet(code)` — privileged operation, disabled unless the shell explicitly advertises it and the user confirms the action.

The shell must validate every message independently. A UI-side check is not a security boundary. Do not expose generic `eval`, arbitrary filesystem access, shell commands, or unrestricted IPC methods. Reject unknown methods, malformed payloads, oversized strings, untrusted origins and stale/destroyed web-view references.

## Platform identity versus capabilities

User-Agent strings and Client Hints are untrusted, privacy-sensitive hints. Use them only for compatibility diagnostics. Determine actual runtime capabilities by feature detection and by querying the shell bridge. Never use browser identity to grant privileges.

Request high-entropy Client Hints only after a clear user action and only for a feature that needs them. Avoid persisting raw User-Agent strings or detailed device identifiers without a defined product need.

## Current implementation status

- **Shared React UI:** existing browser UI and platform diagnostics are present. The React entry point and HTML host document are part of this integration branch.
- **Electron:** main/preload split and sender/payload checks exist. A native packaging manifest and complete desktop build pipeline are still needed.
- **PyQt:** a basic two-view Qt container exists. Its current bridge forwards bookmarklet JavaScript directly to the target view; treat this as a prototype and do not ship it as a trusted production boundary.
- **Swift:** a basic UIKit/WKWebView container exists. It still needs navigation policy, lifecycle cleanup, local asset/server strategy, and a hardened message contract before production use.
- **Backend:** no backend service is present; browser UI must not assume a remote UA endpoint.

## Recommended implementation sequence

1. Stabilize the shared React build and platform regression tests.
2. Define and test a versioned bridge contract in the shared UI.
3. Implement the contract in Electron first, keeping privileged methods allowlisted.
4. Port the same contract to PyQt with strict origin and payload validation.
5. Port the contract to Swift using WKNavigationDelegate and narrowly scoped WKScriptMessageHandler methods.
6. Add platform-specific build and smoke-test jobs only when each shell has its own dependency manifest and reproducible build instructions.
7. Review bookmarklet execution as a separate high-risk feature before enabling it by default.
