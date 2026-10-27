import { readFile } from "node:fs/promises";
import path from "node:path";

const CACHE_FILE = path.join(process.cwd(), ".data", "composio-cache.json");

const GENERIC_QUERY_TOKENS = new Set([
  "add",
  "apply",
  "archive",
  "cancel",
  "change",
  "check",
  "create",
  "delete",
  "download",
  "edit",
  "export",
  "fetch",
  "find",
  "generate",
  "get",
  "insert",
  "list",
  "load",
  "make",
  "modify",
  "move",
  "new",
  "open",
  "post",
  "read",
  "remove",
  "retrieve",
  "save",
  "search",
  "send",
  "set",
  "show",
  "trash",
  "update",
  "upload",
  "view",
]);

const HIGH_SPECIFICITY_TOKENS = new Set([
  "check",
  "comment",
  "diff",
  "ephemeral",
  "file",
  "label",
  "milestone",
  "profile",
  "reaction",
  "reminder",
  "run",
  "thread",
]);

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "do",
  "does",
  "for",
  "from",
  "has",
  "have",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "just",
  "me",
  "my",
  "of",
  "on",
  "or",
  "our",
  "please",
  "so",
  "some",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "up",
  "us",
  "use",
  "using",
  "was",
  "we",
  "when",
  "where",
  "which",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const INTENT_LIBRARY = [
  {
    id: "create",
    words: [
      "create",
      "add",
      "make",
      "new",
      "open",
      "file",
      "insert",
      "generate",
      "write",
      "upload",
      "save",
      "post",
    ],
  },
  {
    id: "send",
    words: [
      "send",
      "notify",
      "email",
      "message",
      "share",
      "alert",
      "post",
      "reply",
      "announce",
      "invite",
      "publish",
      "deliver",
    ],
  },
  {
    id: "read",
    words: [
      "get",
      "list",
      "fetch",
      "find",
      "search",
      "read",
      "retrieve",
      "view",
      "show",
      "download",
      "export",
      "check",
      "load",
      "inspect",
    ],
  },
  {
    id: "update",
    words: [
      "update",
      "edit",
      "modify",
      "change",
      "rename",
      "move",
      "assign",
      "label",
      "mark",
      "set",
      "close",
    ],
  },
  {
    id: "delete",
    words: ["delete", "remove", "archive", "trash", "cancel", "revoke"],
  },
  {
    id: "schedule",
    words: ["schedule", "remind", "reminder", "calendar", "event", "meeting"],
  },
] as const;

const TERM_DISPLAY: Record<string, string> = {
  attach: "attachment",
  creat: "create",
  delet: "delete",
  descript: "description",
  emiss: "email",
  issu: "issue",
  messag: "message",
  notif: "notification",
  notifi: "notify",
  repositori: "repository",
  schedul: "schedule",
  submiss: "submission",
  summari: "summary",
  updat: "update",
  upload: "upload",
};

const EXPANSION_WORDS: Record<string, string[]> = {
  notify: ["send", "message", "alert", "post", "inform"],
  notification: ["notify", "send", "message", "alert"],
  issue: ["bug", "ticket", "task"],
  ticket: ["issue", "bug"],
  message: ["msg", "text", "chat", "note"],
  email: ["mail", "message"],
  mail: ["email", "message"],
  attachment: ["file", "document"],
  file: ["attachment", "document"],
  document: ["doc", "file"],
  sheet: ["spreadsheet", "row", "table"],
  spreadsheet: ["sheet", "row", "table"],
  row: ["record", "entry"],
  calendar: ["event", "meeting", "schedule"],
  event: ["meeting", "calendar"],
  meeting: ["event", "calendar"],
  repository: ["repo", "project"],
  repo: ["repository", "project"],
  pull: ["merge"],
  pr: ["pull", "merge"],
  invoice: ["bill", "payment"],
  customer: ["contact", "client"],
  lead: ["contact", "prospect"],
  form: ["survey", "submission", "response"],
  submission: ["form", "response"],
  response: ["reply", "answer", "form"],
  create: ["add", "make", "new", "open", "post"],
  send: ["post", "share", "deliver", "notify"],
  get: ["fetch", "list", "read", "retrieve", "search", "find"],
  update: ["edit", "modify", "change", "set"],
  delete: ["remove", "archive", "trash"],
  download: ["export", "save", "fetch"],
  upload: ["save", "create", "add"],
  sent: ["send"],
  made: ["make", "create"],
  wrote: ["write", "create"],
  built: ["build", "create"],
};

const STATIC_APP_ALIASES: Record<string, string[]> = {
  github: ["github"],
  slack: ["slack"],
  gmail: ["gmail", "google mail"],
  googlesheets: ["google sheets", "gsheets"],
  googledrive: ["google drive", "gdrive"],
  googlecalendar: ["google calendar", "gcal"],
  googleforms: ["google forms", "google form"],
  googledocs: ["google docs", "gdocs"],
  googletasks: ["google tasks"],
  google_chat: ["google chat"],
  notion: ["notion"],
  jira: ["jira"],
  linear: ["linear"],
  asana: ["asana"],
  trello: ["trello"],
  discord: ["discord"],
  telegram: ["telegram"],
  whatsapp: ["whatsapp"],
  twitter: ["twitter"],
  linkedin: ["linkedin"],
  stripe: ["stripe"],
  shopify: ["shopify"],
  airtable: ["airtable"],
  hubspot: ["hubspot"],
  salesforce: ["salesforce"],
  dropbox: ["dropbox"],
  one_drive: ["onedrive", "one drive"],
  outlook: ["outlook"],
  mailchimp: ["mailchimp"],
  zoom: ["zoom"],
  googlemeet: ["google meet"],
};

type ActionKind = "read" | "create" | "update" | "delete" | "action";

type RawAction = {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  kind?: unknown;
};

type RawToolkit = {
  slug?: unknown;
  name?: unknown;
  description?: unknown;
  logo?: unknown;
  categories?: unknown;
  toolsCount?: unknown;
  authConfigDetails?: unknown;
};

type CacheEntry<T> = {
  value?: T;
};

type RawCache = {
  toolkits?: Record<string, CacheEntry<RawToolkit>>;
  tools?: Record<string, CacheEntry<RawAction[]>>;
};

export type DiscoveryAction = {
  slug: string;
  name: string;
  description: string;
  kind: ActionKind;
};

type IndexedAction = DiscoveryAction & {
  nameTokens: Set<string>;
  descriptionTokens: Set<string>;
  nameNormalized: string;
};

export type DiscoveryToolkit = {
  slug: string;
  name: string;
  description: string;
  logo: string | null;
  categories: string[];
  scopes: string[];
  scopeCount: number;
  isNoAuth: boolean;
  toolsCount: number;
  actions: IndexedAction[];
};

export type ToolkitSummary = Omit<DiscoveryToolkit, "actions">;

type AliasEntry = {
  alias: string;
  slug: string;
};

type DiscoveryIndex = {
  toolkits: DiscoveryToolkit[];
  bySlug: Map<string, DiscoveryToolkit>;
  actionBySlug: Map<string, { toolkit: DiscoveryToolkit; action: IndexedAction }>;
  aliasEntries: AliasEntry[];
};

export type MentionRole = "primary" | "source" | "destination";

export type PromptMention = {
  slug: string;
  name: string;
  alias: string;
  position: number;
  clauseIndex: number;
  role: MentionRole;
};

export type PromptClause = {
  index: number;
  text: string;
  normalized: string;
  intentIds: string[];
  primaryTokens: string[];
  intentTokens: string[];
  objectTokens: string[];
  objectWords: string[];
  mentions: PromptMention[];
};

export type PromptAnalysis = {
  prompt: string;
  normalized: string;
  clauses: PromptClause[];
  mentions: PromptMention[];
  intents: string[];
  primaryTokens: string[];
  objectTokens: string[];
  objectWords: string[];
};

export type ActionCandidate = {
  toolkit: ToolkitSummary;
  action: DiscoveryAction;
  score: number;
  matchedTerms: string[];
  reason: string;
  role: MentionRole;
  clauseIndex: number;
  explicit: boolean;
};

export type RankedActions = {
  analysis: PromptAnalysis;
  candidates: ActionCandidate[];
};

const INTENT_WORD_MAP = new Map<string, string[]>();
const INTENT_PRIMARY_WORDS = new Map<string, Set<string>>();
const INTENT_EXPANDED_WORDS = new Map<string, Set<string>>();
const EXPANSIONS = new Map<string, Set<string>>();

function rawTokens(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function rootToken(value: string): string {
  let token = value;

  if (/^\d+$/.test(token)) {
    return token;
  }

  if (token.length > 5 && token.endsWith("ied")) {
    token = `${token.slice(0, -3)}y`;
  } else if (token.length > 5 && token.endsWith("ies")) {
    token = `${token.slice(0, -3)}y`;
  } else if (token.length > 5 && token.endsWith("ing")) {
    token = token.slice(0, -3);
  } else if (token.length > 4 && token.endsWith("ed")) {
    token = token.slice(0, -2);
  } else if (token.length > 4 && token.endsWith("es")) {
    token = token.slice(0, -2);
  } else if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    token = token.slice(0, -1);
  }

  if (token.length > 4 && token.endsWith("e")) {
    token = token.slice(0, -1);
  }

  return token;
}

function displayTerm(token: string): string {
  return TERM_DISPLAY[token] ?? token;
}

function normalizePhrase(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenize(value: string, keepStopWords = false): string[] {
  return rawTokens(value)
    .map(rootToken)
    .filter((token) => token.length > 1 && (keepStopWords || !STOP_WORDS.has(token)));
}

function tokenSet(value: string): Set<string> {
  return new Set(tokenize(value));
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function normalizeKind(value: unknown): ActionKind {
  return value === "read" || value === "create" || value === "update" || value === "delete"
    ? value
    : "action";
}

function collectScopes(authConfigDetails: unknown): string[] {
  const scopes = new Set<string>();

  if (!Array.isArray(authConfigDetails)) {
    return [];
  }

  for (const config of authConfigDetails) {
    if (!config || typeof config !== "object") {
      continue;
    }

    const required = (config as { requiredScopes?: unknown }).requiredScopes;
    if (Array.isArray(required)) {
      for (const scope of required) {
        if (typeof scope === "string" && scope.trim()) {
          scopes.add(scope.trim());
        }
      }
    }

    const fields = (
      config as {
        fields?: {
          authConfigCreation?: {
            optional?: unknown[];
            required?: unknown[];
          };
        };
      }
    ).fields;

    for (const group of [
      fields?.authConfigCreation?.optional,
      fields?.authConfigCreation?.required,
    ]) {
      if (!Array.isArray(group)) {
        continue;
      }

      for (const field of group) {
        if (!field || typeof field !== "object") {
          continue;
        }

        const name = (field as { name?: unknown }).name;
        const defaultValue = (field as { default?: unknown }).default;

        if (
          typeof name === "string" &&
          name.toLowerCase().includes("scope") &&
          typeof defaultValue === "string"
        ) {
          for (const scope of defaultValue.split(/[,\s]+/)) {
            if (scope.trim()) {
              scopes.add(scope.trim());
            }
          }
        }
      }
    }
  }

  return [...scopes];
}

function isNoAuthToolkit(authConfigDetails: unknown): boolean {
  if (!Array.isArray(authConfigDetails) || authConfigDetails.length === 0) {
    return false;
  }

  return authConfigDetails.every((config) => {
    if (!config || typeof config !== "object") {
      return false;
    }

    return String((config as { mode?: unknown }).mode ?? "").toUpperCase() === "NO_AUTH";
  });
}

function addIntentWords(
  map: Map<string, Set<string>>,
  id: string,
  words: readonly string[]
): void {
  const set = new Set<string>();

  for (const word of words) {
    const normalized = rootToken(word);
    set.add(normalized);

    for (const expansion of EXPANSIONS.get(normalized) ?? []) {
      set.add(expansion);
    }
  }

  map.set(id, set);
}

for (const [word, values] of Object.entries(EXPANSION_WORDS)) {
  const key = rootToken(word);
  const set = EXPANSIONS.get(key) ?? new Set<string>();
  for (const value of values) {
    set.add(rootToken(value));
  }
  EXPANSIONS.set(key, set);
}

for (const intent of INTENT_LIBRARY) {
  for (const word of intent.words) {
    const key = rootToken(word);
    const ids = INTENT_WORD_MAP.get(key) ?? [];
    ids.push(intent.id);
    INTENT_WORD_MAP.set(key, unique(ids));
  }
}

for (const intent of INTENT_LIBRARY) {
  INTENT_PRIMARY_WORDS.set(intent.id, new Set(intent.words.map(rootToken)));
  addIntentWords(INTENT_EXPANDED_WORDS, intent.id, intent.words);
}

const READ_PRIMARY_WORDS = INTENT_PRIMARY_WORDS.get("read") ?? new Set<string>();
const READ_EXPANDED_WORDS = INTENT_EXPANDED_WORDS.get("read") ?? new Set<string>();

function addExpansions(tokens: Iterable<string>): Set<string> {
  const result = new Set<string>();

  for (const token of tokens) {
    result.add(token);
    for (const expansion of EXPANSIONS.get(token) ?? []) {
      result.add(expansion);
    }
  }

  return result;
}

function toolkitSummary(toolkit: DiscoveryToolkit): ToolkitSummary {
  return {
    slug: toolkit.slug,
    name: toolkit.name,
    description: toolkit.description,
    logo: toolkit.logo,
    categories: toolkit.categories,
    scopes: toolkit.scopes,
    scopeCount: toolkit.scopeCount,
    isNoAuth: toolkit.isNoAuth,
    toolsCount: toolkit.toolsCount,
  };
}

let indexPromise: Promise<DiscoveryIndex> | null = null;

export function loadDiscoveryIndex(): Promise<DiscoveryIndex> {
  if (!indexPromise) {
    indexPromise = buildDiscoveryIndex().catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  return indexPromise;
}

async function buildDiscoveryIndex(): Promise<DiscoveryIndex> {
  const raw = await readFile(CACHE_FILE, "utf8");
  const cache = JSON.parse(raw) as RawCache;
  const toolkits: DiscoveryToolkit[] = [];
  const bySlug = new Map<string, DiscoveryToolkit>();
  const actionBySlug = new Map<
    string,
    { toolkit: DiscoveryToolkit; action: IndexedAction }
  >();

  for (const [key, entry] of Object.entries(cache.toolkits ?? {})) {
    const toolkit = entry?.value;
    if (!toolkit) {
      continue;
    }

    const slug = String(toolkit.slug ?? key).trim().toLowerCase();
    if (!slug || slug === "composio") {
      continue;
    }

    const actions = (cache.tools?.[key]?.value ?? cache.tools?.[slug]?.value ?? [])
      .map((action) => {
        const actionSlug = String(action.slug ?? "").trim();
        const actionName = String(action.name ?? actionSlug).trim();
        const description = String(action.description ?? "").trim();

        if (!actionSlug) {
          return null;
        }

        const indexed: IndexedAction = {
          slug: actionSlug,
          name: actionName || actionSlug,
          description,
          kind: normalizeKind(action.kind),
          nameTokens: tokenSet(actionName),
          descriptionTokens: tokenSet(description),
          nameNormalized: normalizePhrase(actionName),
        };

        return indexed;
      })
      .filter((action): action is IndexedAction => Boolean(action));

    const scopes = collectScopes(toolkit.authConfigDetails);
    const built: DiscoveryToolkit = {
      slug,
      name: String(toolkit.name ?? slug).trim() || slug,
      description: String(toolkit.description ?? "").trim(),
      logo: typeof toolkit.logo === "string" && toolkit.logo.trim() ? toolkit.logo.trim() : null,
      categories: Array.isArray(toolkit.categories)
        ? unique(toolkit.categories.map((category) => String(category).trim()).filter(Boolean))
        : [],
      scopes,
      scopeCount: scopes.length,
      isNoAuth: isNoAuthToolkit(toolkit.authConfigDetails),
      toolsCount:
        typeof toolkit.toolsCount === "number" && Number.isFinite(toolkit.toolsCount)
          ? toolkit.toolsCount
          : actions.length,
      actions,
    };

    toolkits.push(built);
    bySlug.set(slug, built);

    for (const action of actions) {
      if (!actionBySlug.has(action.slug)) {
        actionBySlug.set(action.slug, { toolkit: built, action });
      }
    }
  }

  const aliasMap = new Map<string, string>();

  for (const [slug, aliases] of Object.entries(STATIC_APP_ALIASES)) {
    if (!bySlug.has(slug)) {
      continue;
    }

    for (const alias of aliases) {
      const normalized = normalizePhrase(alias);
      if (normalized.length >= 3 && !aliasMap.has(normalized)) {
        aliasMap.set(normalized, slug);
      }
    }
  }

  for (const toolkit of toolkits) {
    const candidates = [
      normalizePhrase(toolkit.name),
      normalizePhrase(toolkit.slug.replace(/_/g, " ")),
    ];

    for (const alias of candidates) {
      if (alias.length >= 3 && !aliasMap.has(alias)) {
        aliasMap.set(alias, toolkit.slug);
      }
    }
  }

  const aliasEntries = [...aliasMap.entries()]
    .map(([alias, slug]) => ({ alias, slug }))
    .sort((a, b) => {
      const words = b.alias.split(" ").length - a.alias.split(" ").length;
      return words || b.alias.length - a.alias.length || a.alias.localeCompare(b.alias);
    });

  return { toolkits, bySlug, actionBySlug, aliasEntries };
}

function splitClauses(prompt: string): string[] {
  const splitter =
    /(\b(?:then|after that|also|when|after|before|once|if|while)\b|[,;.\n]|\band\b(?=\s+(?:create|add|make|send|notify|get|list|fetch|find|search|read|update|edit|delete|remove|upload|download|save|post|schedule|move|copy|open|close|reply|comment|assign|label|invite|run|trigger|share|publish|generate)\b))/gi;
  const parts = prompt.split(splitter);
  const clauses: string[] = [];
  let prefix = "";

  for (const part of parts) {
    const text = part.trim();
    if (!text) {
      continue;
    }

    const normalized = normalizePhrase(text);
    if (!normalized) {
      continue;
    }

    const temporal =
      /^(?:when|after that|after|before|once|if|upon|while)$/.test(normalized);

    if (!temporal && /^(?:then|after that|also|when|after|before|once|if|while|and)$/.test(normalized)) {
      continue;
    }

    if (temporal) {
      prefix = `${normalized} `;
      continue;
    }

    clauses.push(`${prefix}${text}`.trim());
    prefix = "";
  }

  return clauses.length > 0 ? clauses : [prompt];
}

function detectMentions(
  index: DiscoveryIndex,
  text: string,
  clauseIndex: number
): PromptMention[] {
  const normalized = ` ${normalizePhrase(text)} `;
  const matches = new Map<string, PromptMention>();

  for (const entry of index.aliasEntries) {
    const position = normalized.indexOf(` ${entry.alias} `);
    if (position < 0) {
      continue;
    }

    const toolkit = index.bySlug.get(entry.slug);
    if (!toolkit) {
      continue;
    }

    const existing = matches.get(entry.slug);
    if (existing && existing.position <= position) {
      continue;
    }

    matches.set(entry.slug, {
      slug: entry.slug,
      name: toolkit.name,
      alias: entry.alias,
      position,
      clauseIndex,
      role: "primary",
    });
  }

  return [...matches.values()].sort((a, b) => a.position - b.position);
}

function isSourceClause(normalized: string): boolean {
  return /^(?:when|after|before|once|if|upon)\b/.test(normalized);
}

function isMoveVerb(normalized: string): boolean {
  return /\b(?:add|save|copy|upload|move|import|export|download|sync|insert)\b/.test(normalized);
}

function assignRoles(text: string, mentions: PromptMention[]): void {
  const normalized = normalizePhrase(text);
  const padded = ` ${normalized} `;
  const fromPosition = padded.indexOf(" from ");
  const toCandidates = [padded.indexOf(" to "), padded.indexOf(" into "), padded.indexOf(" onto ")]
    .filter((position) => position >= 0);
  const toPosition = toCandidates.length > 0 ? Math.min(...toCandidates) : -1;
  const sourceClause = isSourceClause(normalized);
  const moveVerb = isMoveVerb(normalized);

  for (const mention of mentions) {
    if (sourceClause) {
      mention.role = "source";
      continue;
    }

    if (toPosition >= 0) {
      if (fromPosition >= 0 && mention.position > fromPosition && mention.position < toPosition) {
        mention.role = "source";
        continue;
      }

      if (mention.position > toPosition) {
        mention.role = "destination";
        continue;
      }

      if (moveVerb && mention.position < toPosition) {
        mention.role = "source";
        continue;
      }
    }

    if (fromPosition >= 0 && toPosition < 0 && mention.position > fromPosition) {
      mention.role = "source";
    }
  }
}

function intentDataForTokens(tokens: string[]): {
  intentIds: string[];
  primaryTokens: string[];
  intentTokens: string[];
} {
  const intentIds = new Set<string>();
  const primaryTokens = new Set<string>();

  for (const token of tokens) {
    const ids = INTENT_WORD_MAP.get(token) ?? [];
    if (ids.length === 0) {
      continue;
    }

    primaryTokens.add(token);
    for (const id of ids) {
      intentIds.add(id);
    }
  }

  const intentTokens = new Set<string>();
  for (const id of intentIds) {
    for (const token of INTENT_EXPANDED_WORDS.get(id) ?? []) {
      intentTokens.add(token);
    }
  }

  return {
    intentIds: [...intentIds],
    primaryTokens: [...primaryTokens],
    intentTokens: [...intentTokens],
  };
}

function buildClauses(index: DiscoveryIndex, prompt: string): PromptClause[] {
  const rawClauses = splitClauses(prompt);
  const initial = rawClauses.length > 0 ? rawClauses : [prompt];
  const merged: string[] = [];
  let carry = "";

  for (const text of initial) {
    const mentions = detectMentions(index, text, merged.length);
    if (mentions.length > 0) {
      merged.push(`${carry} ${text}`.trim());
      carry = "";
    } else if (merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${text}`.trim();
    } else {
      carry = `${carry} ${text}`.trim();
    }
  }

  if (carry) {
    if (merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${carry}`.trim();
    } else {
      merged.push(carry);
    }
  }

  return merged.map((text, clauseIndex) => {
    const normalized = normalizePhrase(text);
    const tokens = tokenize(text);
    const mentions = detectMentions(index, text, clauseIndex);
    assignRoles(text, mentions);

    const mentionRoots = new Set<string>();
    const mentionWords = new Set<string>();

    for (const mention of mentions) {
      for (const token of tokenize(mention.alias, true)) {
        mentionRoots.add(token);
      }
      for (const word of rawTokens(mention.alias)) {
        mentionWords.add(word);
      }
    }

    const objectTokens = tokens.filter(
      (token) => !mentionRoots.has(token) && !STOP_WORDS.has(token)
    );
    const objectWords = rawTokens(text).filter(
      (word) =>
        !STOP_WORDS.has(rootToken(word)) &&
        !mentionWords.has(word) &&
        word.length > 1
    );
    const intentData = intentDataForTokens(tokens);

    return {
      index: clauseIndex,
      text,
      normalized,
      intentIds: intentData.intentIds,
      primaryTokens: intentData.primaryTokens,
      intentTokens: intentData.intentTokens,
      objectTokens: unique(objectTokens),
      objectWords: unique(objectWords),
      mentions,
    };
  });
}

export function analyzePrompt(
  index: DiscoveryIndex,
  prompt: string
): PromptAnalysis {
  const normalized = normalizePhrase(prompt);
  const clauses = buildClauses(index, prompt);
  const mentionMap = new Map<string, PromptMention>();

  for (const clause of clauses) {
    for (const mention of clause.mentions) {
      const existing = mentionMap.get(mention.slug);
      if (!existing || mention.position < existing.position) {
        mentionMap.set(mention.slug, mention);
      }
    }
  }

  const mentions = [...mentionMap.values()].sort((a, b) => {
    const clause = a.clauseIndex - b.clauseIndex;
    return clause || a.position - b.position;
  });

  return {
    prompt,
    normalized,
    clauses,
    mentions,
    intents: unique(clauses.flatMap((clause) => clause.intentIds)),
    primaryTokens: unique(clauses.flatMap((clause) => clause.primaryTokens)),
    objectTokens: unique(clauses.flatMap((clause) => clause.objectTokens)),
    objectWords: unique(clauses.flatMap((clause) => clause.objectWords)),
  };
}

function scoreAction(
  action: IndexedAction,
  primaryTokens: Set<string>,
  intentTokens: Set<string>,
  objectTokens: Set<string>,
  intentIds: Set<string>,
  role: MentionRole
): { score: number; matchedTerms: string[] } {
  let score = 0;
  const matched = new Set<string>();
  let objectMatched = 0;
  let primaryNameMatched = false;
  let primaryDescriptionMatched = false;

  for (const token of primaryTokens) {
    if (!primaryNameMatched && action.nameTokens.has(token)) {
      score += 18;
      matched.add(displayTerm(token));
      primaryNameMatched = true;
    } else if (!primaryDescriptionMatched && action.descriptionTokens.has(token)) {
      score += 3;
      matched.add(displayTerm(token));
      primaryDescriptionMatched = true;
    }
  }

  let intentNameMatched = false;
  let intentDescriptionMatched = false;

  for (const token of intentTokens) {
    if (primaryTokens.has(token)) {
      continue;
    }

    if (!intentNameMatched && action.nameTokens.has(token)) {
      score += 8;
      matched.add(displayTerm(token));
      intentNameMatched = true;
    } else if (!intentDescriptionMatched && action.descriptionTokens.has(token)) {
      score += 1;
      matched.add(displayTerm(token));
      intentDescriptionMatched = true;
    }
  }

  for (const token of objectTokens) {
    if (action.nameTokens.has(token)) {
      score += 11;
      matched.add(displayTerm(token));
      objectMatched += 1;
    } else if (action.descriptionTokens.has(token)) {
      score += 2;
      matched.add(displayTerm(token));
      objectMatched += 1;
    }
  }

  if (role === "source") {
    if (action.kind === "read") {
      score += 10;
      if (/\b(?:list|search|fetch)\b/.test(action.name.toLowerCase())) {
        score += 8;
      }
    } else if (action.kind === "delete") {
      score -= 12;
    }
  } else if (role === "destination") {
    if (action.kind === "create") {
      score += 8;
    } else if (action.kind === "update") {
      score += 4;
    } else if (action.kind === "delete") {
      score -= 12;
    }

    if (/\b(?:append|row|values?|insert|upsert)\b/.test(action.name.toLowerCase())) {
      score += 12;
    }

    if (/\bupload\b/.test(action.name.toLowerCase())) {
      score += 8;
    }

    if (
      /\bsheet\b/.test(action.name.toLowerCase()) &&
      !objectTokens.has("sheet") &&
      !objectTokens.has("spreadsheet")
    ) {
      score -= 12;
    }
  } else {
    if (
      (intentIds.has("create") || intentIds.has("send") || intentIds.has("schedule")) &&
      action.kind === "create"
    ) {
      score += 6;
    } else if (intentIds.has("read") && action.kind === "read") {
      score += 6;
    } else if (intentIds.has("update") && action.kind === "update") {
      score += 6;
    } else if (intentIds.has("delete") && action.kind === "delete") {
      score += 6;
    }
  }

  if (action.kind === "delete" && !intentIds.has("delete")) {
    score -= 16;
  }

  const actionDescription = action.description.toLowerCase();
  if (actionDescription.includes("deprecated")) {
    score -= 40;
  }
  if (action.name.toLowerCase().includes("deprecated")) {
    score -= 40;
  }

  let extraPenalty = 0;
  for (const token of action.nameTokens) {
    if (STOP_WORDS.has(token)) continue;
    if (primaryTokens.has(token) || intentTokens.has(token) || objectTokens.has(token)) continue;
    extraPenalty += HIGH_SPECIFICITY_TOKENS.has(token) ? 12 : 6;
  }
  score -= Math.min(30, extraPenalty);

  if (objectTokens.size > 0 && objectMatched === 0) {
    score -= 30;
  }

  if (matched.size === 0) {
    return { score: 0, matchedTerms: [] };
  }

  return { score, matchedTerms: [...matched] };
}

function mentionQuery(
  analysis: PromptAnalysis,
  mention: PromptMention
): {
  primaryTokens: Set<string>;
  intentTokens: Set<string>;
  objectTokens: Set<string>;
  intentIds: Set<string>;
  role: MentionRole;
} {
  const clause = analysis.clauses[mention.clauseIndex];

  if (!clause) {
    return {
      primaryTokens: new Set(analysis.primaryTokens),
      intentTokens: addExpansions(analysis.primaryTokens),
      objectTokens: new Set(analysis.objectTokens),
      intentIds: new Set(analysis.intents),
      role: mention.role,
    };
  }

  const objectTokens = addExpansions(clause.objectTokens);

  if (mention.role === "source") {
    return {
      primaryTokens: new Set(READ_PRIMARY_WORDS),
      intentTokens: new Set(READ_EXPANDED_WORDS),
      objectTokens,
      intentIds: new Set(["read"]),
      role: mention.role,
    };
  }

  return {
    primaryTokens: new Set(clause.primaryTokens),
    intentTokens: addExpansions(clause.intentTokens),
    objectTokens,
    intentIds: new Set(clause.intentIds),
    role: mention.role,
  };
}

function fallbackKind(role: MentionRole, intentIds: Set<string>): ActionKind {
  if (role === "source") {
    return "read";
  }

  if (intentIds.has("read")) {
    return "read";
  }

  if (intentIds.has("update")) {
    return "update";
  }

  if (intentIds.has("delete")) {
    return "delete";
  }

  if (intentIds.has("create") || intentIds.has("send") || intentIds.has("schedule")) {
    return "create";
  }

  return "read";
}

function reasonForCandidate(
  toolkit: ToolkitSummary,
  action: DiscoveryAction,
  matchedTerms: string[],
  explicit: boolean,
  role: MentionRole
): string {
  if (matchedTerms.length === 0) {
    return explicit
      ? `Best available ${role === "source" ? "read" : "action"} in ${toolkit.name}.`
      : `Best available action for this request.`;
  }

  const terms = matchedTerms.slice(0, 6).map((term) => `“${term}”`).join(", ");
  return explicit
    ? `Matched ${terms} in ${toolkit.name} and selected “${action.name}”.`
    : `Matched ${terms} and selected “${action.name}” from ${toolkit.name}.`;
}

function scoreToolkitActions(
  toolkit: DiscoveryToolkit,
  query: ReturnType<typeof mentionQuery>,
  limit: number,
  explicit: boolean,
  clauseIndex: number
): ActionCandidate[] {
  const scored = toolkit.actions
    .map((action) => {
      const result = scoreAction(
        action,
        query.primaryTokens,
        query.intentTokens,
        query.objectTokens,
        query.intentIds,
        query.role
      );

      return { action, ...result };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.action.name.localeCompare(b.action.name) ||
        a.action.slug.localeCompare(b.action.slug)
    );

  const useful = scored.filter((entry) => entry.score > 0).slice(0, limit);

  if (useful.length === 0 && toolkit.actions.length > 0) {
    const kind = fallbackKind(query.role, query.intentIds);
    const fallback =
      toolkit.actions.find((action) => action.kind === kind) ?? toolkit.actions[0];

    if (fallback) {
      useful.push({ action: fallback, score: 1, matchedTerms: [] });
    }
  }

  return useful.map(({ action, score, matchedTerms }) => {
    const summary = toolkitSummary(toolkit);
    return {
      toolkit: summary,
      action: {
        slug: action.slug,
        name: action.name,
        description: action.description,
        kind: action.kind,
      },
      score,
      matchedTerms,
      reason: reasonForCandidate(summary, action, matchedTerms, explicit, query.role),
      role: query.role,
      clauseIndex,
      explicit,
    };
  });
}

function scoreGlobalActions(
  index: DiscoveryIndex,
  analysis: PromptAnalysis,
  limit: number
): ActionCandidate[] {
  const primaryTokens = new Set(analysis.primaryTokens);
  const intentTokens = addExpansions(analysis.primaryTokens);
  const objectTokens = addExpansions(analysis.objectTokens);
  const intentIds = new Set(analysis.intents);
  const candidates: ActionCandidate[] = [];

  for (const toolkit of index.toolkits) {
    const metadataTokens = tokenSet(
      `${toolkit.name} ${toolkit.categories.join(" ")} ${toolkit.description}`
    );
    let metadataScore = 0;

    for (const token of objectTokens) {
      if (metadataTokens.has(token)) {
        metadataScore += 1;
      }
    }

    for (const action of toolkit.actions) {
      const result = scoreAction(
        action,
        primaryTokens,
        intentTokens,
        objectTokens,
        intentIds,
        "primary"
      );
      const score = result.score + Math.min(metadataScore, 6);

      if (score < 20) {
        continue;
      }

      if (
        objectTokens.size > 0 &&
        !result.matchedTerms.some((term) => !GENERIC_QUERY_TOKENS.has(term.toLowerCase()))
      ) {
        continue;
      }

      const summary = toolkitSummary(toolkit);
      candidates.push({
        toolkit: summary,
        action: {
          slug: action.slug,
          name: action.name,
          description: action.description,
          kind: action.kind,
        },
        score,
        matchedTerms: result.matchedTerms,
        reason: reasonForCandidate(summary, action, result.matchedTerms, false, "primary"),
        role: "primary",
        clauseIndex: -1,
        explicit: false,
      });
    }
  }

  return candidates
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.toolkit.scopeCount - b.toolkit.scopeCount ||
        a.action.name.localeCompare(b.action.name)
    )
    .slice(0, limit);
}

export async function rankActionsForPrompt(
  prompt: string,
  limit = 24
): Promise<RankedActions> {
  const index = await loadDiscoveryIndex();
  const analysis = analyzePrompt(index, prompt);
  const candidates: ActionCandidate[] = [];

  if (analysis.mentions.length > 0) {
    for (const mention of analysis.mentions) {
      const toolkit = index.bySlug.get(mention.slug);
      if (!toolkit) {
        continue;
      }

      const query = mentionQuery(analysis, mention);
      const scored = scoreToolkitActions(
        toolkit,
        query,
        4,
        true,
        mention.clauseIndex
      );

      for (const candidate of scored) {
        candidates.push({ ...candidate, score: candidate.score + 40 });
      }
    }
  } else {
    candidates.push(...scoreGlobalActions(index, analysis, limit));
  }

  const uniqueCandidates = new Map<string, ActionCandidate>();

  for (const candidate of candidates) {
    const key = candidate.action.slug;
    const existing = uniqueCandidates.get(key);
    if (!existing || candidate.score > existing.score) {
      uniqueCandidates.set(key, candidate);
    }
  }

  if (process.env.DEBUG_IDEA === "1") {
    console.log(
      JSON.stringify(
        [...uniqueCandidates.values()]
          .filter((candidate) => candidate.toolkit.slug === "github")
          .map((candidate) => ({
            slug: candidate.action.slug,
            score: candidate.score,
            matched: candidate.matchedTerms,
          })),
        null,
        2
      )
    );
  }

  return {
    analysis,
    candidates: [...uniqueCandidates.values()].sort((a, b) => {
      if (a.explicit !== b.explicit) {
        return a.explicit ? -1 : 1;
      }

      return (
        b.score - a.score ||
        a.clauseIndex - b.clauseIndex ||
        a.toolkit.name.localeCompare(b.toolkit.name)
      );
    }),
  };
}

export async function findActionBySlug(slug: string): Promise<ActionCandidate | null> {
  const index = await loadDiscoveryIndex();
  const found = index.actionBySlug.get(slug.trim());
  if (!found) {
    return null;
  }

  const toolkit = toolkitSummary(found.toolkit);
  return {
    toolkit,
    action: {
      slug: found.action.slug,
      name: found.action.name,
      description: found.action.description,
      kind: found.action.kind,
    },
    score: 100,
    matchedTerms: [],
    reason: `Selected “${found.action.name}” in ${found.toolkit.name} directly.`,
    role: "primary",
    clauseIndex: -1,
    explicit: true,
  };
}

