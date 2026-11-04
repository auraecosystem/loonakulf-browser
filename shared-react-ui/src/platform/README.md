# Loonakulf UA identity

The Loonakulf UA adapter lives at `src/platform/loonakulf-ua-parser.js`.

It provides:
- `parseLoonakulfUserAgent(ua, clientHints)`: product identity plus independently parsed engine, OS, device and CPU.
- `isLoonakulfUserAgent(ua)` and `getLoonakulfVersion(ua)`: product-token checks.
- `withLoonakulfProductToken(ua, version)`: idempotently appends/replaces the product token.

Browser identity and rendering-engine identity are intentionally separate. For example, a desktop Loonakulf UA may report browser `Loonakulf` and engine `Blink`; an iOS build may report browser `Loonakulf` and engine `WebKit`.

The token is a user-agent compatibility/branding signal and can be spoofed. Never use it as authentication, authorization, or proof that a request came from an official Loonakulf installation.

Run the focused tests with:

```sh
npm run test:platform
```
