# Demo and deployment

## Local demo

The shared React interface can be previewed locally:

```bash
git clone https://github.com/auraecosystem/loonakulf-browser.git
cd loonakulf-browser/shared-react-ui
npm install
npm run start
```

Open [http://localhost:3000](http://localhost:3000).

To validate the production bundle:

```bash
npm run test:platform
npm run build
```

## Hosted demo

Planned GitHub Pages URL:

[https://auraecosystem.github.io/loonakulf-browser/](https://auraecosystem.github.io/loonakulf-browser/)

This URL is not considered live until the repository's Pages configuration is enabled and the deployment workflow has completed successfully.

### Enable GitHub Pages

1. Open the repository's **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Merge the Pages deployment workflow into `main`.
4. Open **Actions → Deploy Loonakulf Browser demo** and inspect the run.
5. After a successful deployment, open the hosted demo URL above.

The workflow publishes only the static React build. It does not package Electron, run the PyQt shell, or provide native iOS functionality.

## Troubleshooting

- **404 at the demo URL:** confirm Pages uses GitHub Actions and that the deployment workflow completed successfully.
- **Blank page or missing assets:** inspect the browser console and confirm the build was generated with the repository base path.
- **Build failure:** run `npm install`, `npm run test:platform` and `npm run build` from `shared-react-ui/`.
- **Native features unavailable:** expected in the hosted web preview; native shell capabilities require their respective desktop or mobile runtime.
