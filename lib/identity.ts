import { getCurrentUser } from "./auth";
import { UnauthorizedError } from "./errors";

/**
 * The Composio user ID is the authenticated account ID.
 *
 * Never use a shared value such as "default": connections are isolated per
 * Composio user ID. Replace this module's implementation if your auth system
 * already exposes a stable user identifier.
 */
export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();

  if (!user) {
    throw new UnauthorizedError();
  }

  return user.id;
}
