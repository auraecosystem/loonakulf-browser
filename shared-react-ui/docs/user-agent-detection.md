# User-Agent and platform intelligence

The shared UI platform module is dependency-free and available through the
stable entry point:

```js
import {
  parseUserAgent,
  getUserAgentClientHints,
  detectCapabilities
} from "./platform";

const hints = await getUserAgentClientHints(navigator);
const identity = parseUserAgent(navigator.userAgent, hints || {});
const capabilities = detectCapabilities(window);
```

## Normalized result

- `browser`: name, full version, major version and detection source.
- `engine`: Blink, WebKit, Gecko, Trident or Unknown.
- `os`: operating-system name, version and detection source.
- `device`: vendor, model, type (desktop/mobile/tablet) and detection source.
- `cpu`: normalized architecture when available.
- `isMobile` / `isTablet`: convenience flags.

## Client Hints

`getUserAgentClientHints(navigator)` reads low-entropy User-Agent Client
Hints by default. High-entropy values (architecture, model, platform version
and full browser versions) are requested only when the caller explicitly
passes `{ includeHighEntropy: true }`. If permission or browser support is
unavailable, it safely falls back to low-entropy values or returns `null`.

High-entropy hints can expose additional device information. Request them only
when needed, avoid persisting them by default, and explain collection to users
when appropriate.

## Identity versus capabilities

- **Identity** is what the UA string or Client Hints report. These values can
  be reduced, spoofed or unavailable; they are not proof of device identity.
- **Engine** reflects platform constraints. Chrome, Firefox and Edge on iOS
  use WebKit and must not be classified as Blink or Gecko.
- **Capabilities** are measured in the active runtime by
  `detectCapabilities(window)`. Touch, online state and service-worker
  support must not be inferred from a UA string.

Input is bounded to 2,048 characters. The parser does not execute the UA
string and does not create a persistent fingerprint.

## Tests

Run from `shared-react-ui/`:

```bash
npm run test:platform
```

Coverage includes iPhone Chrome/Safari, desktop Chrome/Blink, Firefox/Gecko,
Client Hints, missing inputs and capability detection.

## API boundary

This repository currently has no backend/API application. No detached
`GET /api/v1/ua` endpoint is added; a future backend can import the same
normalization logic through an explicit adapter.
