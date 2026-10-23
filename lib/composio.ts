import { Composio } from "@composio/core";

let client: Composio | null = null;

/**
 * Server-only Composio client.
 *
 * The project key is read lazily so `next build` can run without a key.
 * Never import this module from a Client Component.
 */
export function getComposio(): Composio {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "COMPOSIO_API_KEY is not set. Add your project key to .env.local and restart the dev server."
    );
  }

  if (apiKey.startsWith("uak_")) {
    throw new Error(
      "COMPOSIO_API_KEY must be a project key (ak_...). A user API key (uak_...) is not valid for this website backend."
    );
  }

  client ??= new Composio({ apiKey });
  return client;
}
