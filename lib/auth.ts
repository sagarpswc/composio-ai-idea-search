import {
  createHmac,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { AuthError } from "./errors";

export type AuthUser = {
  id: string;
  email: string;
  createdAt: string;
};

type StoredUser = AuthUser & {
  passwordHash: string;
};

type UsersFile = {
  users: StoredUser[];
};

export type SessionPayload = {
  sub: string;
  email: string;
  exp: number;
};

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const COOKIE_NAME = "composio_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be set to a random string of at least 32 characters."
    );
  }

  return secret;
}

function scryptAsync(
  password: string,
  salt: Buffer,
  keyLength: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, 64);

  return `scrypt$${salt.toString("hex")}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(
  password: string,
  encodedHash: string
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = encodedHash.split("$");

  if (scheme !== "scrypt" || !saltHex || !hashHex) {
    return false;
  }

  const expected = Buffer.from(hashHex, "hex");
  const actual = await scryptAsync(password, Buffer.from(saltHex, "hex"), 64);

  return (
    expected.length === actual.length && timingSafeEqual(expected, actual)
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isStoredUser(value: unknown): value is StoredUser {
  if (!value || typeof value !== "object") {
    return false;
  }

  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.email === "string" &&
    typeof user.passwordHash === "string" &&
    typeof user.createdAt === "string"
  );
}

async function readUsers(): Promise<StoredUser[]> {
  try {
    const raw = await readFile(USERS_FILE, "utf8");
    const parsed: unknown = JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as UsersFile).users)
    ) {
      return [];
    }

    return (parsed as UsersFile).users.filter(isStoredUser);
  } catch {
    return [];
  }
}

async function writeUsers(users: StoredUser[]): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const temporaryFile = `${USERS_FILE}.${process.pid}.${Date.now()}.tmp`;
  const payload: UsersFile = { users };

  await writeFile(temporaryFile, JSON.stringify(payload, null, 2), "utf8");
  await rename(temporaryFile, USERS_FILE);
}

let writeQueue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

function toPublicUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    createdAt: user.createdAt,
  };
}

export async function registerUser(
  rawEmail: string,
  password: string
): Promise<AuthUser> {
  const email = normalizeEmail(rawEmail);

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    throw new AuthError("Enter a valid email address.", 400);
  }

  if (password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.", 400);
  }

  if (password.length > 128) {
    throw new AuthError("Password must be 128 characters or fewer.", 400);
  }

  const passwordHash = await hashPassword(password);

  return enqueue(async () => {
    const users = await readUsers();

    if (users.some((user) => user.email === email)) {
      throw new AuthError("An account with that email already exists.", 409);
    }

    const user: StoredUser = {
      id: randomUUID(),
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await writeUsers(users);

    return toPublicUser(user);
  });
}

export async function loginUser(
  rawEmail: string,
  password: string
): Promise<AuthUser> {
  const email = normalizeEmail(rawEmail);

  if (
    !EMAIL_PATTERN.test(email) ||
    !password ||
    password.length > 128
  ) {
    throw new AuthError("Invalid email or password.", 401);
  }

  const users = await readUsers();
  const user = users.find((candidate) => candidate.email === email);

  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    throw new AuthError("Invalid email or password.", 401);
  }

  return toPublicUser(user);
}

function sign(value: string): string {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

export async function createSessionCookie(user: AuthUser): Promise<void> {
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const token = `${encoded}.${sign(encoded)}`;
  const store = await cookies();

  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySessionCookie(): Promise<void> {
  const store = await cookies();

  store.set(COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    typeof payload.exp === "number"
  );
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const [encoded, signature] = token.split(".");

  if (!encoded || !signature) {
    return null;
  }

  const expected = sign(encoded);

  if (
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );

    if (!isSessionPayload(parsed) || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: parsed.sub,
      email: parsed.email,
      createdAt: "",
    };
  } catch {
    return null;
  }
}
