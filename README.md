# loonakulf-browser
A bookmarklet browser 

```bash
loonakulf-browser/
├── shared-react-ui/
│   ├── src/
│   │   ├── db.js             # IndexedDB Database Module (Dexie.js)
│   │   ├── parser.js         # Single-line Formatter & Security Auditing Shield
│   │   └── App.js            # Main React Dashboard and Communication Panel
│   ├── .eslintrc.json        # ESLint Configuration File
│   ├── .prettierrc           # Prettier Code Quality Rules
│   └── package.json          # Frontend Dependecies & Script Shortcuts
├── electron-shell/
│   ├── main.js               # Main Electron Process (Chromium Window Layer)
│   ├── preload.js            # Secure IPC JavaScript Communication Bridge
│   └── package.json          # Electron Packaging Manifest
├── pyqt-shell/
│   └── main.py               # Native Python Web Container Framework
├── install.msh               # Automated Repository Setup Script
└── run.ash                   # Concurrent Workspace Process Launcher Script
```

## Platform and User-Agent detection

The shared UI includes a lightweight User-Agent parser and a separate runtime
capability detector. See
[`shared-react-ui/docs/user-agent-detection.md`](shared-react-ui/docs/user-agent-detection.md)
for the normalized fields, limitations and usage example.

Run the parser regression suite from `shared-react-ui/`:

```bash
npm run test:platform
```

The repository does not currently include a server/API application, so the
proposed `/api/v1/ua` endpoint remains an integration point for a future
backend rather than an unconnected route.
