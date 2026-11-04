<div align="center">

# Loonakulf Browser

**A bookmarklet-first browser for building, organizing and running personal web tools across desktop and mobile shells.**

[![CI](https://github.com/auraecosystem/loonakulf-browser/actions/workflows/ci-build-pipeline.yml/badge.svg?branch=main)](https://github.com/auraecosystem/loonakulf-browser/actions/workflows/ci-build-pipeline.yml)
[![Platform](https://img.shields.io/badge/UI-React%2018-61DAFB?logo=react&logoColor=white)](shared-react-ui/)
[![Status](https://img.shields.io/badge/status-active%20development-orange)](#project-status)

[Repository](https://github.com/auraecosystem/loonakulf-browser) · [Documentation](docs/) · [Issues](https://github.com/auraecosystem/loonakulf-browser/issues) · [CI runs](https://github.com/auraecosystem/loonakulf-browser/actions)

**Hosted demo:** [Open the demo deployment](https://auraecosystem.github.io/loonakulf-browser/)  
<sub>The Pages URL is the planned public preview. It will become available after GitHub Pages is enabled and the deployment workflow completes successfully. Until then, run the app locally using the quick-start below.</sub>

</div>

---

## Overview

Loonakulf Browser is designed as a bookmarklet-first, multi-shell browser. Bookmarklets are a primary product primitive: users should be able to create, inspect, organize, test, run and export small tools for the active web page. A shared interface coordinates platform-specific native containers.

The shared UI owns the browser-facing experience and reusable workflows. Native shells own platform lifecycle, web rendering, navigation policy and privileged operations. The goal is to avoid maintaining three separate browser interfaces while keeping platform-specific capabilities behind narrow, validated interfaces.

### Project visuals

#### Browser interface concept

<p align="center">
  <img src="docs/assets/loonakulf-ui-concept.svg" alt="Loonakulf Browser desktop interface concept showing tabs, navigation, workspace tools, bookmarklets and privacy controls" width="100%" />
</p>

This is a design direction for the shared browser experience, not a screenshot or claim that every illustrated control is already implemented. It keeps the browser surface central, makes bookmarklets discoverable, and keeps privacy and permission state visible.

#### System architecture

<p align="center">
  <img src="docs/assets/loonakulf-architecture.svg" alt="Loonakulf Browser multi-shell architecture diagram" width="100%" />
</p>

<p align="center">
  <img src="docs/assets/loonakulf-runtime-flow.svg" alt="Loonakulf Browser runtime and security flow diagram" width="100%" />
</p>

These are architecture illustrations, not screenshots of a completed native application.

## Current capabilities

| Area | Current implementation |
|---|---|
| Shared browser UI | React 18 entry-point scaffolding; application component requires restoration |
| Bookmarklets | Existing Dexie schema and source utilities; shared record validation added; UI/runtime integration remains pending |
| Browser controls | Navigation, proxy and cache-control UI paths |
| Platform intelligence | Browser, engine, OS, device and CPU identification |
| Client Hints | Low-entropy hints and opt-in high-entropy retrieval with fallback |
| Electron | Main/preload separation, IPC sender checks and native browser controls |
| PyQt | Basic Qt WebEngine container prototype |
| Swift | Basic UIKit and WKWebView container prototype |

**Important:** the PyQt and Swift bridges are prototypes, not production security boundaries. Native bookmarklet execution is privileged and requires explicit authorization and shell-side validation. See [security and architecture notes](docs/multishell-architecture.md).

## Architecture

### System context

```mermaid
flowchart TB
    U[User] --> UI[Shared React UI]
    UI --> C[Versioned capability bridge]
    C --> E[Electron adapter]
    C --> P[PyQt adapter]
    C --> S[Swift adapter]
    E --> ER[Chromium / Electron runtime]
    P --> PR[Qt WebEngine runtime]
    S --> SR[WKWebView runtime]
    ER --> W[Web content]
    PR --> W
    SR --> W
```

### Request and permission flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Shared React UI
    participant Bridge as Native bridge
    participant Shell as Platform shell
    participant Page as Active web page

    User->>UI: Request browser operation
    UI->>Bridge: Send typed method + payload
    Bridge->>Shell: Forward through platform adapter
    Shell->>Shell: Validate origin, method, schema and permission
    alt Request is allowed
        Shell->>Page: Perform scoped operation
        Page-->>Shell: Result / navigation event
        Shell-->>UI: Normalized response
    else Request is rejected
        Shell-->>UI: Structured error
    end
```

### Design rules

1. **One UI, multiple shells.** Shared workflows belong in `shared-react-ui`; native lifecycle and OS integration belong in the shell.
2. **Capabilities, not User-Agent privilege checks.** User-Agent strings and Client Hints are advisory diagnostics, never authorization signals.
3. **Validate at the native boundary.** UI-side validation is not a security boundary.
4. **No generic native execution.** Do not expose unrestricted `eval`, arbitrary shell commands, filesystem access or unrestricted IPC.
5. **Explicit consent for privileged actions.** Bookmarklet execution must be separately permissioned and confirmed.
6. **Privacy by default.** Request high-entropy Client Hints only when a user action and concrete feature require them.

## Repository layout

```text
loonakulf-browser/
├── .github/
│   └── workflows/
│       ├── ci-build-pipeline.yml
│       └── deploy-pages.yml
├── assets/
│   └── js/
│       └── platform.js
├── docs/
│   ├── assets/
│   │   ├── loonakulf-architecture.svg
│   │   ├── loonakulf-runtime-flow.svg
│   │   └── loonakulf-ui-concept.svg
│   ├── Dependencies.md
│   ├── UA-parser.md
│   ├── architecture.md
│   ├── demo.md
│   ├── multishell-architecture.md
│   └── platform-intelligence-audit.md
├── electron-shell/
│   ├── main.js
│   ├── platform.js
│   └── preload.js
├── pyqt-shell/
│   └── main.py
├── shared-react-ui/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── db.js
│   │   ├── index.js
│   │   └── platform/
│   ├── tests/
│   │   └── platform/
│   └── package.json
├── swift-shell/
│   └── BrowserApp/
│       └── ViewController.swift
└── README.md
```

## Quick start

### Requirements

- Node.js 20 or a compatible supported Node.js release
- npm
- Git

### Run the shared React interface

```bash
git clone https://github.com/auraecosystem/loonakulf-browser.git
cd loonakulf-browser/shared-react-ui

npm install
npm run start
```

The development server is expected at [http://localhost:3000](http://localhost:3000).

### Test and build

Run these commands from `shared-react-ui/`:

```bash
# Platform parser regression tests
npm run test:platform

# Production build
npm run build

# Lint source files
npm run lint
```

The CI workflow is configured to run platform regression tests and a React production build. The current default-branch source has a missing `shared-react-ui/src/App.js` import target, so the build must not be described as healthy until that component is restored and CI confirms it. It also checks Electron source syntax. It does not yet produce signed native installers or prove end-to-end behavior in all three shells.

## Platform shells

### Electron — desktop

The Electron shell contains the main process, preload bridge and platform helpers.

Current source includes sender/frame checks, URL and proxy input validation, and allowlisted browser-control actions. Before production use, enforce a strict trusted UI origin, navigation/redirect policy and a packaged application loading strategy. A complete Electron packaging manifest and release pipeline are still outstanding.

### PyQt — desktop prototype

The PyQt shell uses Qt WebEngine and Qt WebChannel. Its current bookmarklet forwarding path can execute code in the target page and must not be treated as a trusted production bridge.

Production work requires strict origin checks, message schemas, method allowlisting, payload limits, permission checks and lifecycle handling.

### Swift — iOS prototype

The Swift shell uses UIKit and WKWebView. Its current script-message handler is a prototype. Production work requires navigation policy, trusted local UI loading, message-origin validation, narrowly scoped handlers and lifecycle cleanup.

## Documentation

| Document | Description |
|---|---|
| [Bookmarklet-first architecture](docs/bookmarklet-first-architecture.md) | Product definition, shared runtime helpers, execution model and security requirements |\n| [Multi-shell architecture](docs/multishell-architecture.md) | Shell responsibilities, bridge contract, security rules and implementation status |
| [Architecture notes](docs/architecture.md) | Existing architecture reference |
| [Dependencies](docs/Dependencies.md) | Dependency and setup notes |
| [User-Agent parser](docs/UA-parser.md) | Platform identity parsing |
| [Platform intelligence audit](docs/platform-intelligence-audit.md) | Detection behavior, limitations and privacy considerations |
| [Demo and deployment](docs/demo.md) | Local preview, GitHub Pages setup and deployment troubleshooting |

## Demo and deployment

The public preview is planned for:

**[https://auraecosystem.github.io/loonakulf-browser/](https://auraecosystem.github.io/loonakulf-browser/)**

The preview is not considered live until the repository's GitHub Pages source is set to **GitHub Actions** and the deployment workflow succeeds. See [docs/demo.md](docs/demo.md) for the exact setup steps.

The hosted preview is for the shared web UI. It does not package or emulate Electron, PyQt or native iOS functionality.

## Project status

| Milestone | Status |
|---|---|
| Bookmarklet-first shared runtime helpers | Added; React UI integration pending |\n| Shared React UI foundation | Blocked by missing `src/App.js` on current default branch |
| Platform intelligence and regression tests | Implemented; continued validation required |
| React production build in CI | Must remain green |
| Versioned shared bridge contract | Specified; implementation pending |
| Electron production hardening | In progress |
| PyQt production bridge | Not ready |
| Swift production bridge | Not ready |
| Native packaging and signed releases | Not implemented |
| Hosted web demo | Pending Pages configuration and successful deployment |

## Security

Please do not report security-sensitive vulnerabilities in public issues. Use GitHub's private vulnerability reporting if it is enabled for this repository, or contact the repository maintainers privately.

Security priorities:

- Treat all web content as untrusted.
- Validate native bridge callers and payloads in the shell.
- Restrict navigation to explicitly supported schemes.
- Keep secrets and privileged operations out of the renderer.
- Require clear user authorization for bookmarklet execution.
- Do not use device identity or User-Agent data as an authorization mechanism.

## Contributing

1. Open an issue describing the bug or proposed change.
2. Keep changes scoped to the appropriate layer.
3. Add or update tests for behavior changes.
4. Run the platform tests and production build.
5. Document new bridge methods and their security requirements.
6. Submit a pull request with test results and known limitations.

## License

A license file was not present in the repository when this README was refreshed. Confirm the project's intended license and add a root-level `LICENSE` file before publishing a license badge or accepting external contributions under a specific license.
