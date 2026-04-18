// Runtime polyfills for APIs newer than the baseline supported by the OSes
// listed in README.md (Windows 10+, Ubuntu 22.04+, macOS 13+).
//
// `tsconfig.json` pins `lib` to ES2022 + DOM, so any API newer than that
// is unknown to TypeScript — which is by design. When a new feature is
// needed, add a paired line here:
//   /// <reference lib="esXXXX.FEATURE" />   // re-exposes the TS types
//   import 'core-js/actual/PATH';            // core-js runtime polyfill
// Both parts are required: the `reference` makes the API typecheck,
// the `import` ships the implementation. Any use without this pair will
// fail at build time rather than on a user's machine.

/// <reference lib="es2024.promise" />
import 'core-js/actual/promise/with-resolvers';
