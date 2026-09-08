/**
 * packages/calle/client.ts
 * CALL-E SDK client wrapper.
 * Owner: Aryan
 *
 * RULE: This is the ONLY place in the codebase that constructs a CalleClient.
 * Never construct one elsewhere — import getCalle() from here.
 *
 * The CALLE_API_KEY must live in .env and never appear in code or logs.
 *
 * ── Why this is async ────────────────────────────────────────────────────────
 *
 * @call-e/calle@0.7.0 is ESM-only. Its package.json sets "type": "module" and
 * its "exports" map declares only an "import" condition — there is no "require"
 * condition, so `require("@call-e/calle")` fails with
 * ERR_PACKAGE_PATH_NOT_EXPORTED.
 *
 * This package compiles to CommonJS, and TypeScript downlevels a plain
 * `await import(...)` into `require(...)` — which hits exactly that error. So
 * we go through a Function-constructed import, which TypeScript leaves alone
 * and Node executes as a genuine dynamic ESM import.
 *
 * Remove this indirection only after confirming the whole build is ESM, or
 * after the SDK ships a "require" condition. A static import here will
 * typecheck cleanly and then fail at runtime — which is the worst outcome,
 * because the mock path keeps working and hides it.
 */

import type { CalleClient as CalleClientType } from "@call-e/calle";

/**
 * Not rewritten by TypeScript's CommonJS emit, unlike a bare `import()`.
 */
const importEsm = new Function(
  "specifier",
  "return import(specifier);"
) as (specifier: string) => Promise<typeof import("@call-e/calle")>;

let clientPromise: Promise<CalleClientType> | null = null;

/**
 * Returns the shared CALL-E client, constructing it on first use.
 *
 * Throws if CALLE_API_KEY is missing. The key is never logged — the message
 * points at the dashboard rather than echoing anything.
 */
export async function getCalle(): Promise<CalleClientType> {
  if (!process.env.CALLE_API_KEY) {
    throw new Error(
      "CALLE_API_KEY is not set. Add it to your .env file.\n" +
      "Get your key from: https://dashboard.heycall-e.com/account/api-keys"
    );
  }

  if (!clientPromise) {
    clientPromise = importEsm("@call-e/calle").then(
      ({ CalleClient }) => new CalleClient({ apiKey: process.env.CALLE_API_KEY! })
    );
  }

  return clientPromise;
}

/** Test seam — lets a probe wrap the client without patching the SDK globally. */
export function __setCalleClientForTesting(client: CalleClientType | null): void {
  clientPromise = client ? Promise.resolve(client) : null;
}

// Re-export types we use from the SDK
export type { Call, CreateCallInput } from "@call-e/calle";
