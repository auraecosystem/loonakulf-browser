# Loonakulf Browser

A shared React browser interface with platform-specific desktop and mobile shells.

## Repository layout

```text
Loonakulf-browser/
├── shared-react-ui/       # Shared browser interface and platform intelligence
│   ├── src/
│   │   ├── App.js         # Browser UI and communication layer
│   │   ├── index.js       # React application entry point
│   │   └── platform/      # UA parsing and runtime capability detection
│   ├── public/
│   │   └── index.html     # React host document
│   └── package.json
├── electron-shell/        # Electron desktop container (macOS and Windows)
│   ├── main.js
│   ├── preload.js
│   └── platform.js
├── pyqt-shell/            # Python / Qt desktop container
│   └── main.py
├── swift-shell/           # Native iOS container
│   └── BrowserApp/
│       └── ViewController.swift
├── docs/
└── .github/workflows/
```

## Architecture

The shared React application owns browser-facing UI and reusable workflows. Each native shell owns its platform lifecycle, embedded web view, navigation policy, and privileged operations. Shells should expose a narrow, versioned bridge; the UI must not infer native privileges from User-Agent strings.

See [the multi-shell architecture and implementation status](docs/multishell-architecture.md).

## Platform intelligence

The shared UI includes a lightweight User-Agent parser and a separate runtime capability detector. User-Agent and Client Hints are advisory diagnostics only; they must never be used for authentication or authorization. High-entropy Client Hints require explicit opt-in.

Run the platform regression suite from `shared-react-ui/`:

```bash
npm run test:platform
```

Build the shared React application from the same directory:

```bash
npm ci
npm run build
```

The repository does not currently include a backend/API application, so no standalone UA HTTP endpoint is exposed.
