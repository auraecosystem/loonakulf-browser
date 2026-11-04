# Repository audit: platform intelligence integration

## Scope

Reviewed the default-branch repository layout, shared React UI, platform parser,
Electron shell, preload bridge, and available test configuration before adding
platform detection. This is a source-level audit; no local install, browser
launch, or CI run was available during this change.

## Existing architecture

- `shared-react-ui/` is the React application and owns bookmarklet storage and
  user-facing controls.
- `shared-react-ui/src/platform/ua-parser.js` already contained a small
  dependency-free UA parser and capability detector.
- `electron-shell/` hosts the browser UI and target page in separate
  BrowserWindows, with a context-isolated preload bridge.
- `pyqt-shell/` and `swift-shell/` are separate native-container areas.
- The repository has no backend/API application, so a standalone UA HTTP
  endpoint would not have a server to attach to.

## Findings

1. **Existing parser misclassified desktop Chromium engines.** It selected
   AppleWebKit before distinguishing Blink, so desktop Chrome could be
   reported as WebKit. The updated parser classifies Chromium-family desktop
   browsers as Blink while preserving WebKit for all iOS browsers.
2. **Client Hints were not consumed.** The updated module can read low-entropy
   hints and request high-entropy architecture, model, platform version and
   full browser versions on demand, with a safe fallback.
3. **Detection must remain advisory.** UA strings and Client Hints are
   spoofable/reduced and must not be treated as identity or authorization.
   Runtime capabilities are kept separate from UA classification.
4. **The React application needs a separate build repair.** The reviewed
   `shared-react-ui/src/App.js` contains malformed JSX/expressions in its
   current source. It was not rewritten as part of this focused integration,
   because doing so would risk replacing unrelated bookmarklet UI behavior.
5. **Electron hardening remains a separate task.** IPC handlers in
   `electron-shell/main.js` should validate sender/frame ownership and payload
   schemas, validate navigation URLs, and handle closed/destroyed target
   windows. Bookmarklet execution is inherently privileged and should remain
   explicitly user-triggered with the existing warning/audit flow.

## Changes in this branch

- Expanded the existing dependency-free parser with browser, engine, OS,
  device and CPU normalization.
- Added optional User-Agent Client Hints support with graceful fallback.
- Added a stable `src/platform/index.js` module entry point.
- Expanded Node regression tests for iOS, Blink, Gecko, Client Hints, bounded
  input and runtime capabilities.
- Updated platform detection documentation.

## Verification status

The regression suite is defined as `npm run test:platform` in
`shared-react-ui/package.json`. It has not been executed in a local checkout
for this change. The React build is expected to remain blocked until the
pre-existing malformed App component is repaired. No claim of a successful
application build or live browser test is made.
