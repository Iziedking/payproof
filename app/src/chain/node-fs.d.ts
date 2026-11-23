// The one Node function the tests use (engine.test.ts runs in vitest's node environment).
// Declared here so the app does not need @types/node.
declare module 'node:fs' {
  export function readFileSync(path: URL): Uint8Array
}
