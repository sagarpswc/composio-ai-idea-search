import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getComposio } from "./composio";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(DATA_DIR, "composio-sessions.json");

type SessionStore = Record<string, string>;

async function readStore(): Promise<SessionStore> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => {
        return typeof entry[1] === "string";
      })
    );
  } catch {
    return {};
  }
}

async function writeStore(store: SessionStore): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = `${STORE_FILE}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryFile, JSON.stringify(store, null, 2), "utf8");
  await rename(temporaryFile, STORE_FILE);
}

async function createSession(userId: string) {
  return getComposio().sessions.create(userId);
}

export type AppSession = Awaited<ReturnType<typeof createSession>>;

const pendingSessions = new Map<string, Promise<AppSession>>();

async function resolveSession(userId: string): Promise<AppSession> {
  const composio = getComposio();
  const store = await readStore();
  const existingSessionId = store[userId];

  if (existingSessionId) {
    try {
      return await composio.sessions.use(existingSessionId);
    } catch {
      // The session may have been deleted or may belong to another project.
      // Fall through and create a fresh session for this user.
    }
  }

  const session = await createSession(userId);
  store[userId] = session.sessionId;
  await writeStore(store);
  return session;
}

/**
 * Returns the persisted Composio session for one application user.
 *
 * Sessions are reused across requests. In production, store the session ID in
 * your database instead of the local JSON file and add a per-user lock if you
 * may serve concurrent first requests.
 */
export function getSession(userId: string): Promise<AppSession> {
  const pending = pendingSessions.get(userId);
  if (pending) {
    return pending;
  }

  const sessionPromise = resolveSession(userId).finally(() => {
    pendingSessions.delete(userId);
  });

  pendingSessions.set(userId, sessionPromise);
  return sessionPromise;
}
