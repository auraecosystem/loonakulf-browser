# User-Agent detection

The shared UI exposes `parseUserAgent(userAgent)` from
`src/platform/ua-parser.js`. It returns a normalized browser identity, engine,
operating system and device classification.

## Important distinction

- **Identity** is what the UA string claims (for example, Chrome Mobile iOS).
- **Engine** is the rendering engine reported by the UA. Chrome on iOS uses
  WebKit; it must not be classified as Blink.
- **Capabilities** are measured in the running browser by
  `detectCapabilities(window)`. Do not infer touch, service-worker support or
  online state from a UA string.

The parser is deliberately dependency-free and bounded to the first 2,048
characters of input. UA strings are not proof of device identity and can be
spoofed.

## Example

```js
import { parseUserAgent, detectCapabilities } from "./platform/ua-parser";

const identity = parseUserAgent(navigator.userAgent);
const capabilities = detectCapabilities(window);
```

The supplied iPhone Chrome UA should resolve to Chrome Mobile iOS
155.0.8059.37, WebKit 605.1.15, iOS 27.0.0 and Apple iPhone.

## API boundary

The repository does not currently contain a server/API application. The
suggested `GET /api/v1/ua` endpoint is therefore not added here: creating an
unattached route would imply a running service that this repository does not
provide. The parser is ready to be called by a future API adapter.
