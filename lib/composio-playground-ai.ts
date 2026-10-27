import { getComposio } from "@/lib/composio";
import {
  findActionBySlug,
  rankActionsForPrompt,
  type ActionCandidate,
  type DiscoveryAction,
  type ToolkitSummary,
} from "@/lib/composio-discovery";
import { generateLlmText } from "@/lib/llm-settings";
import { getSession } from "@/lib/session-store";

type JsonSchema = {
  type?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  default?: unknown;
  examples?: unknown[];
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  definitions?: Record<string, JsonSchema>;
  [key: string]: unknown;
};

export type PlaygroundField = {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue: unknown;
  examples: unknown[];
};

export type PlaygroundConnection = {
  known: boolean;
  connected: boolean;
  isNoAuth: boolean;
  status: string | null;
};

export type PlaygroundAlternative = {
  slug: string;
  name: string;
  toolkitSlug: string;
  toolkitName: string;
  score: number;
};

export type PlaygroundSetup = {
  prompt: string;
  toolSlug: string;
  toolName: string;
  description: string;
  toolkit: ToolkitSummary;
  arguments: Record<string, unknown>;
  json: string;
  requiredFields: PlaygroundField[];
  optionalFields: PlaygroundField[];
  connection: PlaygroundConnection;
  source: "ai" | "template";
  model: string | null;
  reasoning: string;
  warning: string | null;
  alternatives: PlaygroundAlternative[];
};

const CONTENT_FIELD_NAMES = new Set([
  "body",
  "content",
  "description",
  "markdown_text",
  "message",
  "note",
  "text",
  "value",
]);

const IDENTIFIER_FIELD_NAMES = new Set([
  "account_id",
  "channel_id",
  "calendar_id",
  "file_id",
  "folder_id",
  "id",
  "message_id",
  "spreadsheet_id",
  "thread_id",
  "user_id",
]);

const COMMON_FIELD_NAMES = [
  "channel",
  "markdown_text",
  "text",
  "message",
  "body",
  "title",
  "owner",
  "repo",
  "repository",
  "query",
  "user_id",
  "max_results",
  "subject",
  "to",
  "email",
  "url",
  "content",
  "name",
  "description",
  "file",
  "path",
  "spreadsheet_id",
  "range",
  "values",
  "calendar_id",
  "event",
  "start",
  "end",
  "start_time",
  "end_time",
];

function trim(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function resolveSchema(
  schema: JsonSchema | null | undefined,
  root: JsonSchema,
  depth = 0
): JsonSchema | undefined {
  if (!schema || depth > 5) {
    return schema ?? undefined;
  }

  if (schema.$ref?.startsWith("#/")) {
    const path = schema.$ref.slice(2).split("/");
    let current: unknown = root;
    for (const part of path) {
      if (!current || typeof current !== "object") {
        return schema;
      }
      current = (current as Record<string, unknown>)[part];
    }
    if (current && typeof current === "object") {
      return resolveSchema(current as JsonSchema, root, depth + 1);
    }
  }

  if (schema.allOf?.length) {
    const merged: JsonSchema = { ...schema };
    const properties = { ...(schema.properties ?? {}) };
    const required = new Set(schema.required ?? []);

    for (const part of schema.allOf) {
      const resolved = resolveSchema(part, root, depth + 1);
      if (!resolved) continue;
      Object.assign(properties, resolved.properties ?? {});
      for (const key of resolved.required ?? []) required.add(key);
    }

    return {
      ...merged,
      properties,
      required: [...required],
    };
  }

  return schema;
}

function schemaType(schema: JsonSchema | undefined, root: JsonSchema): string {
  const resolved = resolveSchema(schema, root);
  if (!resolved) {
    return "unknown";
  }

  if (resolved.type) {
    return resolved.type;
  }

  for (const key of ["anyOf", "oneOf"] as const) {
    const options = resolved[key];
    if (!options?.length) continue;
    const nonNull = options.find((option) => resolveSchema(option, root)?.type !== "null");
    const type = resolveSchema(nonNull ?? options[0], root)?.type;
    if (type) {
      return type;
    }
  }

  if (resolved.properties) {
    return "object";
  }

  return "unknown";
}

function objectSchema(
  schema: JsonSchema | null | undefined,
  root: JsonSchema,
  depth = 0
): JsonSchema | null {
  const resolved = resolveSchema(schema, root);
  if (!resolved || depth > 5) {
    return null;
  }

  if (resolved.properties) {
    return resolved;
  }

  for (const key of ["anyOf", "oneOf", "allOf"] as const) {
    for (const option of resolved[key] ?? []) {
      const child = objectSchema(option, root, depth + 1);
      if (child) {
        return child;
      }
    }
  }

  return null;
}

function fieldEntries(
  schema: JsonSchema | null,
  root: JsonSchema
): { requiredFields: PlaygroundField[]; optionalFields: PlaygroundField[] } {
  if (!schema?.properties) {
    return { requiredFields: [], optionalFields: [] };
  }

  const required = new Set(schema.required ?? []);
  const requiredFields: PlaygroundField[] = [];
  const optionalFields: PlaygroundField[] = [];

  for (const [name, rawField] of Object.entries(schema.properties)) {
    const field = resolveSchema(rawField, root) ?? rawField;
    const entry: PlaygroundField = {
      name,
      type: schemaType(field, root),
      required: required.has(name),
      description: trim(String(field.description ?? ""), 260),
      defaultValue: field.default ?? null,
      examples: Array.isArray(field.examples) ? field.examples.slice(0, 2) : [],
    };

    if (entry.required) {
      requiredFields.push(entry);
    } else {
      optionalFields.push(entry);
    }
  }

  return { requiredFields, optionalFields };
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function extractFirstMatch(prompt: string, pattern: RegExp): string | null {
  const match = prompt.match(pattern);
  return match?.[1]?.trim() || null;
}

function inferQuery(prompt: string): string {
  const parts: string[] = [];
  const lower = prompt.toLowerCase();

  if (/\bunread\b/.test(lower)) parts.push("is:unread");
  if (/\binbox\b/.test(lower)) parts.push("in:inbox");
  if (/\bstarred\b/.test(lower)) parts.push("is:starred");
  if (/\bimportant\b/.test(lower)) parts.push("is:important");

  const from = prompt.match(/\bfrom\s+([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/i)?.[1];
  if (from) parts.push(`from:${from}`);

  const subject = prompt.match(/\bsubject\s+["“]?([^"”\n]+)["”]?/i)?.[1]?.trim();
  if (subject) parts.push(`subject:"${subject}"`);

  const lastDays = prompt.match(/\blast\s+(\d+)\s+days?\b/i)?.[1];
  if (lastDays) parts.push(`newer_than:${lastDays}d`);

  return parts.join(" ");
}

function inferRepo(prompt: string): { owner: string; repo: string } | null {
  const match = prompt.match(/\b([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\b/);
  if (!match) {
    return null;
  }

  return { owner: match[1], repo: match[2] };
}

function extractMessage(prompt: string): string | null {
  const quoted = [...prompt.matchAll(/["“”'`]([^"“”'`\n]{1,500})["“”'`]/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  const afterSaying = prompt.match(
    /\b(?:saying|that says|with (?:the )?(?:message|text)|message:?|text:?)\s+(.+)$/i
  )?.[1]?.trim();

  return afterSaying || quoted.at(-1) || null;
}

function extractTitle(prompt: string): string | null {
  return (
    extractFirstMatch(prompt, /\btitled?\s+["“]?([^"”\n,.]{2,160})["”]?/i) ||
    extractFirstMatch(prompt, /\btitle:?\s+["“]?([^"”\n,.]{2,160})["”]?/i)
  );
}

function extractSubject(prompt: string): string | null {
  return extractFirstMatch(prompt, /\bsubject:?\s+["“]?([^"”\n,.]{2,160})["”]?/i);
}

function extractEmail(prompt: string): string | null {
  return extractFirstMatch(prompt, /\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
}

function extractUrl(prompt: string): string | null {
  return extractFirstMatch(prompt, /\b(https?:\/\/[^\s<>"']+)\b/i);
}

function placeholderFor(name: string, type: string, description: string): unknown {
  const key = name.toLowerCase();
  const text = `${name} ${description}`.toLowerCase();

  if (type === "boolean") return false;
  if (type === "number" || type === "integer") return 0;
  if (type === "array") return [];
  if (type === "object") return {};

  if (key === "channel") return "general";
  if (key === "owner") return "owner";
  if (key === "repo" || key === "repository") return "repository";
  if (key === "query") return "";
  if (key === "user_id") return "me";
  if (key === "calendar_id") return "primary";
  if (key === "spreadsheet_id") return "spreadsheet-id";
  if (key === "range") return "Sheet1!A1";
  if (key === "max_results" || key === "limit" || key === "count") return 10;
  if (key === "to" || key === "email" || key === "recipient") return "recipient@example.com";
  if (key === "subject") return "Hello from Composio";
  if (key === "title") return "New item";
  if (key === "url" || key === "link") return "https://example.com";
  if (key === "path" || key === "file_path") return "/path/to/file";
  if (key === "start" || key === "start_time" || key === "start_date") return "2026-01-01T10:00:00Z";
  if (key === "end" || key === "end_time" || key === "end_date") return "2026-01-01T11:00:00Z";
  if (CONTENT_FIELD_NAMES.has(key) || /\b(?:message|body|content|text|description)\b/.test(text)) {
    return "Your message here";
  }
  if (IDENTIFIER_FIELD_NAMES.has(key) || /\b(?:id|identifier|slug)\b/.test(text)) {
    return "";
  }

  return "";
}

function inferFieldValue(
  field: PlaygroundField,
  prompt: string,
  toolkit: ToolkitSummary
): { found: boolean; value: unknown } {
  const key = field.name.toLowerCase();
  const description = field.description.toLowerCase();
  const type = field.type;

  const repo = inferRepo(prompt);
  const message = extractMessage(prompt);
  const title = extractTitle(prompt);
  const subject = extractSubject(prompt);
  const email = extractEmail(prompt);
  const url = extractUrl(prompt);
  const channel =
    prompt.match(/#([A-Za-z0-9_-]{1,80})\b/)?.[1] ??
    prompt.match(/\bchannel\s+["“]?([A-Za-z0-9_-]{2,80})["”]?/i)?.[1] ??
    null;

  if (type === "string" || type === "unknown") {
    if (key === "channel" && channel) {
      return { found: true, value: channel };
    }

    if (["owner"].includes(key) && repo) {
      return { found: true, value: repo.owner };
    }

    if (["repo", "repository"].includes(key) && repo) {
      return { found: true, value: repo.repo };
    }

    if (key === "repository" && repo) {
      return { found: true, value: `${repo.owner}/${repo.repo}` };
    }

    if (["title"].includes(key) && title) {
      return { found: true, value: title };
    }

    if (["subject"].includes(key) && subject) {
      return { found: true, value: subject };
    }

    if (["to", "email", "recipient"].includes(key) && email) {
      return { found: true, value: email };
    }

    if (["url", "link"].includes(key) && url) {
      return { found: true, value: url };
    }

    if (key === "query" && (description.includes("query") || toolkit.slug === "gmail")) {
      const query = inferQuery(prompt);
      return query ? { found: true, value: query } : { found: false, value: "" };
    }

    if ((CONTENT_FIELD_NAMES.has(key) || key === "markdown_text") && message) {
      return { found: true, value: message };
    }

    if (key === "user_id" && /gmail|user/i.test(`${toolkit.slug} ${description}`)) {
      return { found: true, value: "me" };
    }

    if (["name", "display_name"].includes(key) && title) {
      return { found: true, value: title };
    }

    if (key === "description" && message) {
      return { found: true, value: message };
    }

    if (key === "calendar_id" && /\bprimary\b/i.test(prompt)) {
      return { found: true, value: "primary" };
    }

    if (key === "start" || key === "start_time") {
      const date = prompt.match(/\b(20\d{2}-\d{2}-\d{2}(?:[T ][0-9:+-]+)?)\b/)?.[1];
      if (date) return { found: true, value: date };
    }

    if (key === "end" || key === "end_time") {
      const date = prompt.match(/\b(20\d{2}-\d{2}-\d{2}(?:[T ][0-9:+-]+)?)\b/)?.[1];
      if (date) return { found: true, value: date };
    }
  }

  if (type === "number" || type === "integer") {
    if (["max_results", "limit", "count"].includes(key)) {
      const number = prompt.match(/\b(\d{1,3})\s+(?:emails|messages|results|items|records|rows)\b/i)?.[1];
      return { found: Boolean(number), value: number ? Number(number) : 10 };
    }
  }

  if (type === "boolean") {
    if (/\b(include|enable|with)\b/i.test(prompt)) {
      return { found: false, value: false };
    }
  }

  return { found: false, value: placeholderFor(field.name, type, field.description) };
}

function buildTemplateArguments(
  fields: PlaygroundField[],
  requiredNames: Set<string>,
  prompt: string,
  toolkit: ToolkitSummary
): Record<string, unknown> {
  const args: Record<string, unknown> = {};

  for (const field of fields) {
    const inferred = inferFieldValue(field, prompt, toolkit);
    const resolveDefault = () => {
      if (field.defaultValue !== null && field.defaultValue !== undefined) {
        return field.defaultValue;
      }

      if (field.examples.length > 0 && field.type === "string") {
        return null;
      }

      return placeholderFor(field.name, field.type, field.description);
    };

    if (inferred.found) {
      args[field.name] = inferred.value;
    } else if (requiredNames.has(field.name)) {
      args[field.name] = resolveDefault();
    }
  }

  return args;
}

function sanitizeArguments(
  candidate: unknown,
  fields: PlaygroundField[],
  requiredNames: Set<string>,
  template: Record<string, unknown>
): Record<string, unknown> {
  const fieldMap = new Map(fields.map((field) => [field.name, field]));
  let raw = candidate;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    if (
      !fieldMap.has("arguments") &&
      record.arguments &&
      typeof record.arguments === "object" &&
      !Array.isArray(record.arguments)
    ) {
      raw = record.arguments;
    }
  }

  const clean: Record<string, unknown> = {};

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return clean;
  }

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const field = fieldMap.get(key);
    if (!field) {
      continue;
    }

    if (!requiredNames.has(key) && !COMMON_FIELD_NAMES.includes(key)) {
      continue;
    }

    if (value === null || value === undefined) {
      continue;
    }

    if (field.type === "string" && typeof value !== "string") {
      continue;
    }

    if (field.type === "number" && typeof value !== "number") {
      continue;
    }

    if (field.type === "integer" && (!Number.isInteger(value) || typeof value !== "number")) {
      continue;
    }

    if (field.type === "boolean" && typeof value !== "boolean") {
      continue;
    }

    if (field.type === "array" && !Array.isArray(value)) {
      continue;
    }

    if (field.type === "object" && (typeof value !== "object" || Array.isArray(value) || value === null)) {
      continue;
    }

    clean[key] = value;
  }

  const merged: Record<string, unknown> = { ...template, ...clean };

  for (const name of requiredNames) {
    const value = merged[name];
    if (value === undefined || value === null || value === "") {
      merged[name] = template[name] ?? "";
    }
  }

  if (typeof merged.repo === "string" && merged.repo.includes("/")) {
    const [owner, repo] = merged.repo.split("/", 2);
    if (owner && repo) {
      merged.owner = owner;
      merged.repo = repo;
    }
  }

  if (
    typeof merged.repository === "string" &&
    merged.repository.includes("/") &&
    (merged.owner === undefined || merged.owner === null || merged.owner === "")
  ) {
    const [owner, repo] = merged.repository.split("/", 2);
    if (owner && repo) {
      merged.owner = owner;
      merged.repo = repo;
      merged.repository = `${owner}/${repo}`;
    }
  }

  return merged;
}

function parseJsonObject(value: string): Record<string, unknown> | null {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? value;
  const direct = fenced.trim();

  try {
    const parsed: unknown = JSON.parse(direct);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to balanced-brace extraction.
  }

  const start = fenced.indexOf("{");
  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < fenced.length; index += 1) {
    const character = fenced[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(fenced.slice(start, index + 1));
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
          }
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function selectPromptFields(
  fields: PlaygroundField[],
  requiredNames: Set<string>
): PlaygroundField[] {
  const selected: PlaygroundField[] = [];
  const seen = new Set<string>();

  for (const field of fields) {
    if (requiredNames.has(field.name)) {
      selected.push(field);
      seen.add(field.name);
    }
  }

  for (const name of COMMON_FIELD_NAMES) {
    const field = fields.find((candidate) => candidate.name === name);
    if (field && !seen.has(field.name)) {
      selected.push(field);
      seen.add(field.name);
    }
  }

  for (const field of fields) {
    if (selected.length >= 28) break;
    if (!seen.has(field.name) && field.type !== "object" && field.type !== "array") {
      selected.push(field);
      seen.add(field.name);
    }
  }

  return selected.slice(0, 28);
}

function schemaForModel(fields: PlaygroundField[], requiredNames: Set<string>): string {
  return JSON.stringify(
    fields.map((field) => ({
      name: field.name,
      type: field.type,
      required: requiredNames.has(field.name),
      description: trim(field.description, 180),
      ...(field.defaultValue !== null && field.defaultValue !== undefined
        ? { default: field.defaultValue }
        : {}),
    })),
    null,
    2
  );
}

async function getConnection(
  userId: string,
  toolkit: ToolkitSummary,
  toolIsNoAuth: boolean | null
): Promise<PlaygroundConnection> {
  const fallbackNoAuth = toolkit.isNoAuth || Boolean(toolIsNoAuth);

  try {
    const session = await getSession(userId);
    const result = await session.toolkits({ toolkits: [toolkit.slug] });
    const item = result.items.find(
      (candidate) => candidate.slug.toLowerCase() === toolkit.slug.toLowerCase()
    );

    if (!item) {
      return {
        known: true,
        connected: fallbackNoAuth,
        isNoAuth: fallbackNoAuth,
        status: null,
      };
    }

    const isNoAuth = Boolean(item.isNoAuth || fallbackNoAuth);
    return {
      known: true,
      connected: isNoAuth || Boolean(item.connection?.isActive),
      isNoAuth,
      status: item.connection?.connectedAccount?.status ?? null,
    };
  } catch {
    return {
      known: false,
      connected: fallbackNoAuth,
      isNoAuth: fallbackNoAuth,
      status: null,
    };
  }
}

function chooseCandidate(
  candidates: ActionCandidate[],
  requested: ActionCandidate | null
): ActionCandidate | null {
  if (requested) {
    return requested;
  }

  return candidates[0] ?? null;
}

export async function buildPlaygroundSetup(
  userId: string,
  requirement: string,
  requestedToolSlug?: string
): Promise<PlaygroundSetup> {
  const prompt = requirement.trim();
  if (!prompt) {
    throw new Error("Describe the tool call you want to build.");
  }

  const ranked = await rankActionsForPrompt(prompt, 18);
  const requested = requestedToolSlug?.trim()
    ? await findActionBySlug(requestedToolSlug)
    : null;
  const selected = chooseCandidate(ranked.candidates, requested);

  if (!selected) {
    throw new Error(
      "No Composio action matched this prompt. Try naming the app and the action you want to perform."
    );
  }

  let rawTool: Awaited<ReturnType<ReturnType<typeof getComposio>["tools"]["getRawComposioToolBySlug"]>> | null = null;
  let schemaWarning: string | null = null;

  try {
    rawTool = await getComposio().tools.getRawComposioToolBySlug(selected.action.slug);
  } catch {
    schemaWarning =
      "The live input schema could not be loaded. The JSON below is a minimal template — review it before running.";
  }

  const schema = (rawTool?.inputParameters ?? null) as JsonSchema | null;
  const root = schema ?? {};
  const object = objectSchema(schema, root) ?? schema;
  const { requiredFields, optionalFields } = fieldEntries(object, root);
  const allFields = [...requiredFields, ...optionalFields];
  const requiredNames = new Set(requiredFields.map((field) => field.name));
  const template = buildTemplateArguments(allFields, requiredNames, prompt, selected.toolkit);

  const toolName = rawTool?.name?.trim() || selected.action.name;
  const description =
    rawTool?.description?.trim() || selected.action.description || selected.action.name;
  const fieldsForModel = selectPromptFields(allFields, requiredNames);
  let generated: Record<string, unknown> | null = null;
  let model: string | null = null;
  let usedAi = false;

  if (fieldsForModel.length > 0) {
    const modelPrompt = [
      "You generate the arguments object for one Composio tool call.",
      "Return one valid JSON object only. Do not use markdown fences and do not add explanations.",
      "Use only the fields listed in the schema below. Include every required field.",
      "Infer values from the user request. Use short, sensible placeholders for required values that are not present in the request.",
      "Do not invent unrelated fields or nested structures.",
      "",
      `Tool: ${selected.action.slug}`,
      `Tool name: ${toolName}`,
      `App: ${selected.toolkit.name}`,
      `User request: ${prompt}`,
      "Fields:",
      schemaForModel(fieldsForModel, requiredNames),
      "",
      "JSON object:",
    ].join("\n");

    const text = await generateLlmText(userId, modelPrompt, {
      maxTokens: 900,
      timeoutMs: 30000,
      temperature: 0,
    });

    if (text) {
      generated = parseJsonObject(text.text);
      if (generated) {
        const clean = sanitizeArguments(generated, allFields, requiredNames, template);
        generated = clean;
        usedAi = Object.keys(clean).length > 0;
        model = text.model;
      }
    }
  }

  const args = generated ?? template;
  const connection = await getConnection(
    userId,
    selected.toolkit,
    typeof rawTool?.isNoAuth === "boolean" ? rawTool.isNoAuth : null
  );

  const alternatives: PlaygroundAlternative[] = [];
  const seenToolkits = new Set<string>([selected.toolkit.slug]);

  for (const candidate of ranked.candidates) {
    if (candidate.action.slug === selected.action.slug) {
      continue;
    }

    if (seenToolkits.has(candidate.toolkit.slug)) {
      continue;
    }

    seenToolkits.add(candidate.toolkit.slug);
    alternatives.push({
      slug: candidate.action.slug,
      name: candidate.action.name,
      toolkitSlug: candidate.toolkit.slug,
      toolkitName: candidate.toolkit.name,
      score: candidate.score,
    });

    if (alternatives.length >= 4) {
      break;
    }
  }

  const reasoning = usedAi
    ? `${selected.reason} ${model ?? "The configured model"} filled the schema-backed arguments from your prompt. Review the values, then run the tool.`
    : `${selected.reason} The JSON was generated from the tool's input schema. Replace any placeholder values before running.`;

  const warning =
    schemaWarning ??
    (!connection.known
      ? "Connection status could not be checked. The tool may ask you to connect the app when it runs."
      : null);

  return {
    prompt,
    toolSlug: selected.action.slug,
    toolName,
    description,
    toolkit: selected.toolkit,
    arguments: args,
    json: JSON.stringify(args, null, 2),
    requiredFields,
    optionalFields,
    connection,
    source: usedAi ? "ai" : "template",
    model: usedAi ? model : null,
    reasoning,
    warning,
    alternatives,
  };
}
