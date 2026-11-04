I’ll implement this as a bookmarklet-first browser architecture, not as a conventional browser with bookmarklets added as an afterthought.

That distinction matters: Loonakulf’s product identity should be built around creating, managing, executing, and sharing browser bookmarklets, while its Electron, PyQt, Swift, and React shells provide the environments in which they run. I’ll preserve the underlying browser-engine identity separately from the Loonakulf product identity.

I’ll also treat “first of its kind” as your product-positioning claim, not a verified industry-wide fact until there is evidence to substantiate it.

The repository audit shows an important implementation gap: the current main branch documents bookmarklet management, but the shared React entry point imports App.js, which is absent from the current tree. The PyQt and Swift prototypes also forward bookmarklet code directly into the active page without adequate validation.

I’m not going to disguise those gaps as a finished browser. The implementation needs a shared bookmarklet contract, explicit execution permissions, shell-side validation, and tests—and the missing React application must be handled as a separate build blocker rather than overwritten blindly.

What I implemented

On branch feat/bookmarklet-first-runtime:

File	Change
src/bookmarks/runtime.js	Shared bookmarklet validation and record creation
tests/bookmarks/runtime.test.cjs	Bookmarklet regression tests
src/App.js	Restored the React application component
src/platform/ua-parser.js	Restored platform parser with Loonakulf identity
docs/bookmarklet-first-architecture.md	New product and runtime architecture
README.md	Bookmarklet-first product positioning
package.json	Expanded test command

Security improvements

* Bounded bookmarklet source size.
* No eval() or new Function() in the new validation module.
* Preserves source comments instead of stripping potentially meaningful code.
* Limits percent-decoding to one pass.
* Adds heuristic warnings for cookie access, credential inspection, network requests, dynamic execution and storage access.
* Does not confuse a successful validation with proof that a bookmarklet is safe.

Repository submission

PR #11 — Add bookmarklet-first runtime foundation

Open

Review implementation on GitHub⁠￼

Branch: feat/bookmarklet-first-runtime · Target: main

Remaining production work

* Integrate the new validation module into the existing React bookmarklet builder and library.
* Replace the direct PyQt and Swift execution paths with permission-enforcing native adapters.
* Implement origin-scoped execution permissions and run history.
* Complete CI validation and native-shell testing.

Verification: GitHub Actions run 41879959182 was queued when last checked. I cannot yet claim the tests or production build passed. The PR remains open and unmerged.

My architectural recommendation: make the bookmarklet library, builder, inspector and execution console the central Loonakulf experience. Browser navigation should support that experience—not define the product.

2026-11-04T00:40:09.4419841Z ##[group]Run npm install --no-audit --no-fund
2026-11-04T00:40:09.4420251Z [36;1mnpm install --no-audit --no-fund[0m
2026-11-04T00:40:09.4454818Z shell: /usr/bin/bash -e {0}
2026-11-04T00:40:09.4455239Z ##[endgroup]
2026-11-04T00:40:29.5257008Z npm warn deprecated rollup-plugin-terser@7.0.2: This package has been deprecated and is no longer maintained. Please use @rollup/plugin-terser
2026-11-04T00:40:29.5447577Z npm warn deprecated sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead
2026-11-04T00:40:29.9309504Z npm warn deprecated workbox-google-analytics@6.6.0: It is not compatible with newer versions of GA starting with v4, as long as you are using GAv3 it should be ok, but the package is not longer being maintained
2026-11-04T00:40:30.0120792Z npm warn deprecated stable@0.1.8: Modern JS already guarantees Array#sort() is a stable sort, so this library is deprecated. See the compatibility table on MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort#browser_compatibility
2026-11-04T00:40:30.0464228Z npm warn deprecated q@1.5.1: You or someone you depend on is using Q, the JavaScript Promise library that gave JavaScript developers strong feelings about promises. They can almost certainly migrate to the native JavaScript promise now. Thank you literally everyone for joining me in this bet against the odds. Be excellent to each other.
2026-11-04T00:40:30.0465635Z npm warn deprecated
2026-11-04T00:40:30.0466440Z npm warn deprecated (For a CapTP with native promises, see @endo/eventual-send and @endo/captp)
2026-11-04T00:40:30.0562613Z npm warn deprecated workbox-cacheable-response@6.6.0: workbox-background-sync@6.6.0
2026-11-04T00:40:30.5364165Z npm warn deprecated whatwg-encoding@1.0.5: Use @exodus/bytes instead for a more spec-conformant and faster implementation
2026-11-04T00:40:30.5670680Z npm warn deprecated w3c-hr-time@1.0.2: Use your platform's native performance.now() and performance.timeOrigin.
2026-11-04T00:40:30.5927001Z npm warn deprecated domexception@2.0.1: Use your platform's native DOMException instead
2026-11-04T00:40:30.6042338Z npm warn deprecated abab@2.0.6: Use your platform's native atob() and btoa() methods instead
2026-11-04T00:40:30.7028365Z npm warn deprecated uuid@8.3.2: uuid@10 and below is no longer supported.  For ESM codebases, update to uuid@latest.  For CommonJS codebases, use uuid@11 (but be aware this version will likely be deprecated in 2028).
2026-11-04T00:40:30.7517125Z npm warn deprecated inflight@1.0.6: This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.
2026-11-04T00:40:30.7521176Z npm warn deprecated glob@7.2.3: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
2026-11-04T00:40:31.1235341Z npm warn deprecated @babel/plugin-proposal-private-methods@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-private-methods instead.
2026-11-04T00:40:31.1236785Z npm warn deprecated @babel/plugin-proposal-nullish-coalescing-operator@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-nullish-coalescing-operator instead.
2026-11-04T00:40:31.1239202Z npm warn deprecated @babel/plugin-proposal-numeric-separator@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-numeric-separator instead.
2026-11-04T00:40:31.1242305Z npm warn deprecated @babel/plugin-proposal-class-properties@7.18.6: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-class-properties instead.
2026-11-04T00:40:31.1344972Z npm warn deprecated @babel/plugin-proposal-optional-chaining@7.21.0: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-optional-chaining instead.
2026-11-04T00:40:31.8636448Z npm warn deprecated rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported
2026-11-04T00:40:32.0521514Z npm warn deprecated @humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead
2026-11-04T00:40:32.1613400Z npm warn deprecated @humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead
2026-11-04T00:40:32.7046374Z npm warn deprecated @babel/plugin-proposal-private-property-in-object@7.21.11: This proposal has been merged to the ECMAScript standard and thus this plugin is no longer maintained. Please use @babel/plugin-transform-private-property-in-object instead.
2026-11-04T00:40:32.8233972Z npm warn deprecated svgo@1.3.2: This SVGO version is no longer supported. Upgrade to v2.x.x.
2026-11-04T00:40:33.8268616Z npm warn deprecated eslint@8.57.1: This version is no longer supported. Please see https://eslint.org/version-support for other options.
2026-11-04T00:40:34.8605078Z 
2026-11-04T00:40:34.8606241Z added 1300 packages in 25s
