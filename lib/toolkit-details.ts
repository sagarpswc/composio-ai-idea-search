import {
  ComposioToolkitNotFoundError,
  type ToolkitAuthConfigDetails,
  type ToolkitConnectionState,
} from "@composio/core";
import { getComposio } from "./composio";
import { isToolkitSlug } from "./http";
import { getSession } from "./session-store";
import {
  getCachedToolkitActions,
  getCachedToolkitOverview,
  setCachedToolkitActions,
  setCachedToolkitOverview,
} from "./composio-cache";

export type ToolkitScope = {
  name: string;
  label: string;
  description: string;
  alwaysRequested: boolean;
};

export type ToolkitAuthMethod = {
  name: string;
  mode: string;
  label: string;
  summary: string;
  scopes: ToolkitScope[];
  managedByComposio: boolean;
};

export type ToolkitActionKind = "read" | "create" | "update" | "delete" | "action";

export type ToolkitAction = {
  slug: string;
  name: string;
  description: string;
  kind: ToolkitActionKind;
};

export type ToolkitOverview = {
  slug: string;
  name: string;
  description: string;
  logo: string | null;
  websiteUrl: string | null;
  categories: string[];
  toolsCount: number;
  triggersCount: number;
  updatedAt: string | null;
  authConfigDetails: ToolkitAuthConfigDetails[];
  managedSchemes: string[];
};

export type ToolkitDetail = {
  slug: string;
  name: string;
  description: string;
  logo: string | null;
  websiteUrl: string | null;
  categories: string[];
  toolsCount: number;
  triggersCount: number;
  updatedAt: string | null;
  authMethods: ToolkitAuthMethod[];
  primaryAuthMethod: string;
  scopeCount: number;
  tools: ToolkitAction[];
  toolsError: string | null;
  isConnected: boolean;
  isNoAuth: boolean;
  connectionKnown: boolean;
  connectionStatus: string | null;
  connectedAuthMethod: string | null;
  connectedViaComposio: boolean;
};

const AUTH_MODE_LABELS: Record<string, string> = {
  API_KEY: "API key",
  BEARER_TOKEN: "Bearer token",
  COMPOSIO_LINK: "Composio Connect Link",
  NO_AUTH: "No authentication",
  OAUTH1: "OAuth 1.0",
  OAUTH2: "OAuth 2.0",
  S2S_OAUTH2: "Server-to-server OAuth",
};

const KNOWN_SCOPES: Record<
  string,
  { label?: string; description: string }
> = {
  "mail.google.com": {
    label: "Gmail (full access)",
    description:
      "Read, send, modify, and permanently delete messages and settings in your Gmail account.",
  },
  "userinfo.profile": {
    label: "Basic profile",
    description: "Read your name, photo, and basic Google profile information.",
  },
  "userinfo.email": {
    label: "Email address",
    description: "Read your Google account email address.",
  },
  "contacts.readonly": {
    label: "Contacts (read-only)",
    description: "Read the contacts saved in your Google account.",
  },
  "contacts.other.readonly": {
    label: "Other contacts (read-only)",
    description: "Read the other contacts Google has saved for your account.",
  },
  "contacts": {
    label: "Contacts",
    description: "Read and change the contacts saved in your Google account.",
  },
  "profile.language.read": {
    label: "Profile language (read-only)",
    description: "Read the language preference on your Google profile.",
  },
  "user.addresses.read": {
    label: "Addresses (read-only)",
    description: "Read addresses saved in your Google account.",
  },
  "user.birthday.read": {
    label: "Birthday (read-only)",
    description: "Read the birthday saved in your Google account.",
  },
  "user.emails.read": {
    label: "Account emails (read-only)",
    description: "Read the email addresses saved in your Google account.",
  },
  "user.phonenumbers.read": {
    label: "Phone numbers (read-only)",
    description: "Read the phone numbers saved in your Google account.",
  },
  "profile.emails.read": {
    label: "Profile emails (read-only)",
    description: "Read email addresses associated with your Google profile.",
  },
  "gmail.readonly": {
    label: "Gmail (read-only)",
    description: "Read your Gmail messages, threads, labels, and metadata.",
  },
  "gmail.send": {
    label: "Gmail (send)",
    description: "Send email messages from your Gmail account.",
  },
  "gmail.modify": {
    label: "Gmail (manage mail)",
    description:
      "Read, compose, send, and permanently delete Gmail messages, threads, and labels.",
  },
  "gmail.compose": {
    label: "Gmail (compose)",
    description: "Create, read, update, and delete drafts in your Gmail account.",
  },
  "gmail.labels": {
    label: "Gmail labels",
    description: "Read and manage the labels in your Gmail account.",
  },
  "gmail.settings.basic": {
    label: "Gmail settings",
    description: "Read and change basic settings in your Gmail account.",
  },
  "calendar": {
    label: "Google Calendar",
    description:
      "See, edit, share, and permanently delete calendars in your Google account.",
  },
  "calendar.events": {
    label: "Calendar events",
    description: "View and edit events on your Google calendars.",
  },
  "calendar.readonly": {
    label: "Calendars (read-only)",
    description: "View calendars and calendar settings in your Google account.",
  },
  "calendar.events.readonly": {
    label: "Calendar events (read-only)",
    description: "View events on your Google calendars.",
  },
  "drive": {
    label: "Google Drive",
    description:
      "See, edit, create, and delete files in your Google Drive.",
  },
  "drive.readonly": {
    label: "Google Drive (read-only)",
    description: "View files in your Google Drive.",
  },
  "drive.file": {
    label: "Google Drive files",
    description:
      "Create and manage files in Google Drive that this app creates or that you open with it.",
  },
  "spreadsheets": {
    label: "Google Sheets",
    description:
      "See, edit, create, and delete your Google Sheets spreadsheets.",
  },
  "spreadsheets.readonly": {
    label: "Google Sheets (read-only)",
    description: "View your Google Sheets spreadsheets.",
  },
  "documents": {
    label: "Google Docs",
    description:
      "See, edit, create, and delete your Google Docs documents.",
  },
  "documents.readonly": {
    label: "Google Docs (read-only)",
    description: "View your Google Docs documents.",
  },
  "presentations": {
    label: "Google Slides",
    description:
      "See, edit, create, and delete your Google Slides presentations.",
  },
  "tasks": {
    label: "Google Tasks",
    description: "Read and manage tasks in your Google account.",
  },
  "forms": {
    label: "Google Forms",
    description: "Read and manage forms in your Google account.",
  },
  "repo": {
    label: "Repositories",
    description:
      "Read and write repository code, commits, branches, issues, and pull requests.",
  },
  "public_repo": {
    label: "Public repositories",
    description: "Read and write public repositories.",
  },
  "repo:status": {
    label: "Commit statuses",
    description: "Read and write commit statuses in your repositories.",
  },
  "repo_deployment": {
    label: "Deployments",
    description: "Read and write deployment statuses in your repositories.",
  },
  "user": {
    label: "User profile",
    description: "Read and write your GitHub profile and account data.",
  },
  "read:user": {
    label: "User profile (read-only)",
    description: "Read your GitHub profile information.",
  },
  "user:email": {
    label: "Email addresses",
    description: "Read your GitHub email addresses.",
  },
  "user:follow": {
    label: "Follow users",
    description: "Follow and unfollow other GitHub users.",
  },
  "gist": {
    label: "Gists",
    description: "Create, read, and update GitHub Gists.",
  },
  "notifications": {
    label: "Notifications",
    description: "Read and manage your GitHub notifications.",
  },
  "project": {
    label: "Projects",
    description: "Read and write GitHub Projects.",
  },
  "workflow": {
    label: "Actions workflows",
    description: "Manage GitHub Actions workflows and workflow runs.",
  },
  "codespace": {
    label: "Codespaces",
    description: "Create and manage GitHub Codespaces.",
  },
  "read:org": {
    label: "Organizations (read-only)",
    description: "Read your organization membership and team information.",
  },
  "write:org": {
    label: "Organizations",
    description: "Read and write organization membership and teams.",
  },
  "admin:org": {
    label: "Organizations (admin)",
    description: "Fully manage organizations, teams, and memberships.",
  },
  "read:packages": {
    label: "Packages (read-only)",
    description: "Read packages from GitHub Packages.",
  },
  "write:packages": {
    label: "Packages",
    description: "Read and publish packages to GitHub Packages.",
  },
  "delete:packages": {
    label: "Packages (delete)",
    description: "Delete packages from GitHub Packages.",
  },
  "read:discussion": {
    label: "Discussions (read-only)",
    description: "Read GitHub Discussions.",
  },
  "write:discussion": {
    label: "Discussions",
    description: "Read and write GitHub Discussions.",
  },
  "read:audit_log": {
    label: "Audit log (read-only)",
    description: "Read your organization's audit log.",
  },
  "write:audit_log": {
    label: "Audit log",
    description: "Read and write your organization's audit log.",
  },
  "read:repo_hook": {
    label: "Repository webhooks (read-only)",
    description: "Read webhooks configured on your repositories.",
  },
  "write:repo_hook": {
    label: "Repository webhooks",
    description: "Read and write webhooks configured on your repositories.",
  },
  "admin:repo_hook": {
    label: "Repository webhooks (admin)",
    description: "Fully manage webhooks configured on your repositories.",
  },
  "channels:history": {
    label: "Channel history",
    description: "Read messages and other content in public channels.",
  },
  "channels:read": {
    label: "Channels (read-only)",
    description: "View basic information about public channels.",
  },
  "channels:write": {
    label: "Channels",
    description: "Manage public channels in your workspace.",
  },
  "chat:write": {
    label: "Send messages",
    description: "Send messages as the connected Slack app.",
  },
  "chat:write.public": {
    label: "Send messages to public channels",
    description: "Send messages to public channels the app has not joined.",
  },
  "files:read": {
    label: "Files (read-only)",
    description: "View files shared in your workspace.",
  },
  "files:write": {
    label: "Files",
    description: "Upload, edit, and delete files in your workspace.",
  },
  "groups:history": {
    label: "Private channel history",
    description: "Read messages and content in private channels.",
  },
  "groups:read": {
    label: "Private channels (read-only)",
    description: "View basic information about private channels.",
  },
  "groups:write": {
    label: "Private channels",
    description: "Manage private channels in your workspace.",
  },
  "im:history": {
    label: "Direct message history",
    description: "Read messages in your direct messages.",
  },
  "im:read": {
    label: "Direct messages (read-only)",
    description: "View basic information about direct messages.",
  },
  "im:write": {
    label: "Direct messages",
    description: "Start and manage direct messages.",
  },
  "mpim:history": {
    label: "Group message history",
    description: "Read messages in group direct messages.",
  },
  "mpim:read": {
    label: "Group messages (read-only)",
    description: "View basic information about group direct messages.",
  },
  "mpim:write": {
    label: "Group messages",
    description: "Start and manage group direct messages.",
  },
  "links:read": {
    label: "Links (read-only)",
    description: "Read links shared in your workspace.",
  },
  "links:write": {
    label: "Links",
    description: "Create and manage links shared in your workspace.",
  },
  "lists:read": {
    label: "Lists (read-only)",
    description: "View Slack Lists and their items.",
  },
  "lists:write": {
    label: "Lists",
    description: "Create and manage Slack Lists and their items.",
  },
  "pins:read": {
    label: "Pins (read-only)",
    description: "View pinned items in channels.",
  },
  "pins:write": {
    label: "Pins",
    description: "Pin and unpin items in channels.",
  },
  "reactions:read": {
    label: "Reactions (read-only)",
    description: "View emoji reactions on messages.",
  },
  "reactions:write": {
    label: "Reactions",
    description: "Add and remove emoji reactions on messages.",
  },
  "reminders:read": {
    label: "Reminders (read-only)",
    description: "View your Slack reminders.",
  },
  "reminders:write": {
    label: "Reminders",
    description: "Create and manage your Slack reminders.",
  },
  "search:read": {
    label: "Search",
    description: "Search messages and files in your workspace.",
  },
  "team:read": {
    label: "Workspace (read-only)",
    description: "View basic information about your Slack workspace.",
  },
  "usergroups:read": {
    label: "User groups (read-only)",
    description: "View user groups in your workspace.",
  },
  "usergroups:write": {
    label: "User groups",
    description: "Create and manage user groups in your workspace.",
  },
  "users:read": {
    label: "Users (read-only)",
    description: "View people in your Slack workspace.",
  },
  "users:read.email": {
    label: "User email addresses",
    description: "View email addresses of people in your workspace.",
  },
  "users.profile:read": {
    label: "Profiles (read-only)",
    description: "View profile information for people in your workspace.",
  },
  "users.profile:write": {
    label: "Profiles",
    description: "Edit profile information for your Slack account.",
  },
  "users:write": {
    label: "Users",
    description: "Manage users in your Slack workspace.",
  },
  "calls:read": {
    label: "Calls (read-only)",
    description: "View Slack call information.",
  },
  "calls:write": {
    label: "Calls",
    description: "Create and manage Slack calls.",
  },
  "dnd:read": {
    label: "Do not disturb (read-only)",
    description: "View do-not-disturb settings.",
  },
  "dnd:write": {
    label: "Do not disturb",
    description: "Manage do-not-disturb settings.",
  },
  "emoji:read": {
    label: "Emoji (read-only)",
    description: "View custom emoji in your workspace.",
  },
  "remote_files:read": {
    label: "Remote files (read-only)",
    description: "View remote files added to your workspace.",
  },
  "remote_files:share": {
    label: "Remote files",
    description: "Share remote files in your workspace.",
  },
  "identify": {
    label: "Identity",
    description: "Read your Discord username, avatar, and basic account details.",
  },
  "email": {
    label: "Email address",
    description: "Read the email address on your Discord account.",
  },
  "connections": {
    label: "Connected accounts",
    description: "View the third-party accounts linked to Discord.",
  },
  "guilds": {
    label: "Servers",
    description: "View the Discord servers you belong to.",
  },
  "guilds.join": {
    label: "Join servers",
    description: "Add you to Discord servers on your behalf.",
  },
  "guilds.members.read": {
    label: "Server members (read-only)",
    description: "Read member information in Discord servers you belong to.",
  },
  "messages.read": {
    label: "Messages (read-only)",
    description: "Read messages in channels you can access.",
  },
  "openid": {
    label: "OpenID identity",
    description: "Verify your identity with the app's OpenID Connect login.",
  },
  "offline_access": {
    label: "Offline access",
    description:
      "Keep access after you close the app so Composio can run actions later without asking you to sign in again.",
  },
  "refresh_token": {
    label: "Refresh token",
    description:
      "Renew the connection token so actions keep working without another sign-in.",
  },
  "read_write": {
    label: "Read and write",
    description: "Read and change data in your account.",
  },
  "read_only": {
    label: "Read-only",
    description: "Read data in your account without changing it.",
  },
  "full": {
    label: "Full access",
    description: "Read and change all data available through the app's API.",
  },
  "read": {
    label: "Read access",
    description: "Read data in your account.",
  },
  "write": {
    label: "Write access",
    description: "Create and change data in your account.",
  },
  "account": {
    label: "Account access",
    description: "Read and manage account-level settings.",
  },
  "admin": {
    label: "Administrative access",
    description: "Manage workspace-wide settings and members.",
  },
  "profile": {
    label: "Profile",
    description: "Read your basic profile information.",
  },
  "user.read": {
    label: "User profile (read-only)",
    description: "Read your basic Microsoft account profile.",
  },
  "user.readwrite": {
    label: "User profile",
    description: "Read and update your Microsoft account profile.",
  },
  "mail.read": {
    label: "Mail (read-only)",
    description: "Read your Microsoft mail messages.",
  },
  "mail.send": {
    label: "Send mail",
    description: "Send email from your Microsoft account.",
  },
  "mail.readwrite": {
    label: "Mail",
    description: "Read, create, and update your Microsoft mail messages.",
  },
  "calendars.read": {
    label: "Calendars (read-only)",
    description: "Read your Microsoft calendars and events.",
  },
  "calendars.readwrite": {
    label: "Calendars",
    description: "Read, create, and update your Microsoft calendars and events.",
  },
  "files.read": {
    label: "Files (read-only)",
    description: "Read files in your Microsoft account.",
  },
  "files.readwrite": {
    label: "Files",
    description: "Read, create, and update files in your Microsoft account.",
  },
  "sites.read.all": {
    label: "Sites (read-only)",
    description: "Read SharePoint sites and their content.",
  },
  "sites.readwrite.all": {
    label: "Sites",
    description: "Read and write SharePoint sites and their content.",
  },
  "chat.read": {
    label: "Chats (read-only)",
    description: "Read your Microsoft Teams chats.",
  },
  "chat.readwrite": {
    label: "Chats",
    description: "Read and send Microsoft Teams chat messages.",
  },
  "issues:create": {
    label: "Create issues",
    description: "Create new issues in Linear.",
  },
  "comments:create": {
    label: "Create comments",
    description: "Add comments to issues and projects in Linear.",
  },
  "crm.export": {
    label: "CRM export",
    description: "Export CRM records from your HubSpot account.",
  },
  "crm.import": {
    label: "CRM import",
    description: "Import CRM records into your HubSpot account.",
  },
  "timeline": {
    label: "Timeline",
    description: "Add and read timeline events on HubSpot records.",
  },
  "tickets": {
    label: "Tickets",
    description: "Read and manage support tickets in HubSpot.",
  },
  "e-commerce": {
    label: "E-commerce",
    description: "Read and manage e-commerce data in HubSpot.",
  },
  "content": {
    label: "Content",
    description: "Read and manage marketing content in HubSpot.",
  },
  "sales-email-read": {
    label: "Sales email (read-only)",
    description: "Read sales email content and engagement data.",
  },
};

function normalizeScopeKey(scope: string): string {
  let value = scope.trim();

  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    const withoutProtocol = value.replace(/^https?:\/\//i, "");
    const authIndex = withoutProtocol.indexOf("/auth/");

    if (authIndex >= 0) {
      value = withoutProtocol.slice(authIndex + 6);
    } else if (withoutProtocol.startsWith("mail.google.com")) {
      value = "mail.google.com";
    } else {
      value = withoutProtocol.split("/").filter(Boolean).pop() ?? withoutProtocol;
    }
  }

  return value.toLowerCase();
}

function scopeWords(scope: string): string {
  return scope
    .replace(/[._:/\\-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function titleCaseToken(token: string): string {
  const acronyms: Record<string, string> = {
    ai: "AI",
    api: "API",
    crm: "CRM",
    csv: "CSV",
    db: "DB",
    gpt: "GPT",
    html: "HTML",
    id: "ID",
    imap: "IMAP",
    ip: "IP",
    oauth: "OAuth",
    pdf: "PDF",
    rss: "RSS",
    smtp: "SMTP",
    sql: "SQL",
    sso: "SSO",
    ui: "UI",
    url: "URL",
  };

  return acronyms[token] ?? token.charAt(0).toUpperCase() + token.slice(1);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
}

function scopeLabel(scope: string): string {
  const key = normalizeScopeKey(scope);

  if (KNOWN_SCOPES[key]?.label) {
    return KNOWN_SCOPES[key].label as string;
  }

  if (key === "mail.google.com") {
    return "Gmail (full access)";
  }

  return titleCase(scopeWords(key)) || scope;
}

function scopeDescription(scope: string, appName: string): string {
  const key = normalizeScopeKey(scope);
  const known = KNOWN_SCOPES[key];

  if (known) {
    return known.description;
  }

  const words = scopeWords(key);
  const topic =
    words
      .replace(
        /\b(read|write|readonly|manage|admin|full|all|access|permission)\b/g,
        " "
      )
      .replace(/\s+/g, " ")
      .trim() || "app data";
  const isReadOnly =
    /(?:^|[._:-])read(?:only)?$/.test(key) ||
    key.endsWith(".read") ||
    key.endsWith("_read");
  const isWrite =
    /(?:^|[._:-])(?:write|manage|modify|admin|delete)$/.test(key) ||
    key.includes(":write") ||
    key.includes(".write");

  if (isReadOnly) {
    return `Read-only access to ${topic} in your ${appName} account.`;
  }

  if (isWrite) {
    return `Create or update ${topic} in your ${appName} account.`;
  }

  return `Allows access to ${topic} in your ${appName} account.`;
}

function authModeLabel(mode: string): string {
  const normalized = mode.toUpperCase();

  return (
    AUTH_MODE_LABELS[normalized] ??
    titleCase(scopeWords(normalized)) ??
    "Authentication"
  );
}

function authModeSummary(mode: string, appName: string): string {
  switch (mode.toUpperCase()) {
    case "OAUTH2":
      return `Sign in to ${appName} and approve the permissions below. Composio keeps the authorization inside this account's own session.`;
    case "OAUTH1":
      return `Authorize ${appName} through its OAuth 1.0 consent screen. Composio stores the resulting token for this account only.`;
    case "API_KEY":
      return `Connect with an API key or access token created in ${appName}. Composio can only do what that key is allowed to do.`;
    case "S2S_OAUTH2":
      return `Use server-to-server OAuth credentials for ${appName}. This method does not show an interactive user consent screen.`;
    case "BEARER_TOKEN":
      return `Connect with a ${appName} bearer token. The token's own permissions control what Composio can do.`;
    case "NO_AUTH":
      return `${appName} does not require an account connection. Composio can run its public actions without credentials.`;
    default:
      return `Connect ${appName} through Composio using its ${authModeLabel(mode)} authentication method.`;
  }
}

function splitScopeValues(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectScopes(authConfig: ToolkitAuthConfigDetails): ToolkitScope[] {
  const scopes = new Map<string, ToolkitScope>();

  function add(rawScope: string, alwaysRequested: boolean) {
    const name = rawScope.trim();
    const key = normalizeScopeKey(name);

    if (!key) {
      return;
    }

    const existing = scopes.get(key);

    if (existing) {
      existing.alwaysRequested ||= alwaysRequested;
      return;
    }

    scopes.set(key, {
      name,
      label: scopeLabel(name),
      description: scopeDescription(name, ""),
      alwaysRequested,
    });
  }

  for (const scope of authConfig.requiredScopes ?? []) {
    add(scope, true);
  }

  for (const group of [
    authConfig.fields.authConfigCreation.optional,
    authConfig.fields.authConfigCreation.required,
    authConfig.fields.connectedAccountInitiation.optional,
    authConfig.fields.connectedAccountInitiation.required,
  ]) {
    for (const field of group) {
      if (!field.name.toLowerCase().includes("scope")) {
        continue;
      }

      for (const scope of splitScopeValues(field.default)) {
        add(scope, false);
      }
    }
  }

  return [...scopes.values()];
}

function buildAuthMethods(
  overview: ToolkitOverview,
  appName: string,
  isNoAuth: boolean
): ToolkitAuthMethod[] {
  const methods: ToolkitAuthMethod[] = [];

  for (const authConfig of overview.authConfigDetails) {
    const mode = authConfig.mode.toUpperCase();
    const scopes = collectScopes(authConfig).map((scope) => ({
      ...scope,
      description: scopeDescription(scope.name, appName),
    }));

    methods.push({
      name: authConfig.name,
      mode,
      label: authModeLabel(mode),
      summary: authModeSummary(mode, appName),
      scopes,
      managedByComposio: overview.managedSchemes.includes(mode),
    });
  }

  if (methods.length > 0) {
    return methods;
  }

  if (isNoAuth) {
    return [
      {
        name: "no_auth",
        mode: "NO_AUTH",
        label: authModeLabel("NO_AUTH"),
        summary: authModeSummary("NO_AUTH", appName),
        scopes: [],
        managedByComposio: false,
      },
    ];
  }

  const fallbackModes =
    overview.managedSchemes.length > 0
      ? overview.managedSchemes
      : ["UNKNOWN"];

  return fallbackModes.map((mode) => ({
    name: `${mode.toLowerCase()}_managed`,
    mode: mode.toUpperCase(),
    label: authModeLabel(mode),
    summary: authModeSummary(mode, appName),
    scopes: [],
    managedByComposio: overview.managedSchemes.includes(mode.toUpperCase()),
  }));
}

function actionKind(slug: string): ToolkitActionKind {
  const action = slug.replace(/^[A-Z0-9]+_/, "");

  if (
    /(^|_)(DELETE|REMOVE|ARCHIVE|CANCEL|CLOSE|REVOKE|UNSUBSCRIBE|TRASH|CLEAR|RESET|KILL|TERMINATE|ABORT|STOP|DISABLE|DEACTIVATE|DECLINE|REJECT|LEAVE|UNFOLLOW|UNLINK|DETACH|DROP)(_|$)/.test(
      action
    )
  ) {
    return "delete";
  }

  if (
    /(^|_)(UPDATE|PATCH|MODIFY|EDIT|SET|REPLACE|MOVE|RENAME|MARK|ASSIGN|SYNC|ENABLE|ACTIVATE|APPROVE|ACCEPT|UPSERT|MERGE|ARCHIVE)(_|$)/.test(
      action
    )
  ) {
    return "update";
  }

  if (
    /(^|_)(GET|LIST|FETCH|SEARCH|FIND|RETRIEVE|READ|DESCRIBE|CHECK|VALIDATE|COUNT|DOWNLOAD|EXPORT|PREVIEW|WHO_AM_I|ME)(_|$)/.test(
      action
    )
  ) {
    return "read";
  }

  if (
    /(^|_)(CREATE|ADD|INSERT|SEND|POST|UPLOAD|PUBLISH|MAKE|GENERATE|EXECUTE|RUN|START|INVITE|REGISTER|SUBSCRIBE|TRIGGER|CALL|ATTACH|APPLY|CONFIRM|PAY|ISSUE)(_|$)/.test(
      action
    )
  ) {
    return "create";
  }

  return "action";
}

function cleanDescription(description: string | undefined): string {
  const value = description?.replace(/\s+/g, " ").trim();

  if (!value) {
    return "Runs this action with your connected account.";
  }

  if (value.length <= 360) {
    return value;
  }

  return `${value.slice(0, 357).trimEnd()}…`;
}

async function fetchToolkitActions(
  slug: string
): Promise<{ tools: ToolkitAction[]; error: string | null }> {
  const composio = getComposio();

  try {
    const cachedTools = await getCachedToolkitActions(slug);

    if (cachedTools) {
      return { tools: cachedTools, error: null };
    }

    let rawTools = await composio.tools.getRawComposioTools({
      toolkits: [slug],
      important: true,
      limit: 60,
    });

    if (rawTools.length < 12) {
      try {
        const fallbackTools = await composio.tools.getRawComposioTools({
          toolkits: [slug],
          limit: 40,
        });
        const seen = new Set(rawTools.map((tool) => tool.slug));

        rawTools = [
          ...rawTools,
          ...fallbackTools.filter((tool) => !seen.has(tool.slug)),
        ];
      } catch (error) {
        console.error("[app-detail] Could not load fallback actions", error);
      }
    }

    const tools: ToolkitAction[] = rawTools.slice(0, 60).map((tool) => ({
      slug: tool.slug,
      name: tool.name || titleCase(scopeWords(tool.slug.split("_").slice(1).join("_"))),
      description: cleanDescription(tool.description),
      kind: actionKind(tool.slug),
    }));

    await setCachedToolkitActions(slug, tools);

    return {
      tools,
      error: null,
    };
  } catch (error) {
    console.error("[app-detail] Could not load actions", error);

    return {
      tools: [],
      error: "Could not load this app's actions from Composio right now.",
    };
  }
}

type ConnectionResult = {
  state: ToolkitConnectionState | null;
  known: boolean;
};

async function getConnectionState(
  userId: string,
  slug: string
): Promise<ConnectionResult> {
  try {
    const session = await getSession(userId);
    const result = await session.toolkits({ toolkits: [slug] });
    const state =
      result.items.find((item) => item.slug.toLowerCase() === slug) ?? null;

    return { state, known: true };
  } catch (error) {
    console.error("[app-detail] Could not load connection state", error);
    return { state: null, known: false };
  }
}

export async function getToolkitOverview(
  rawSlug: string
): Promise<ToolkitOverview | null> {
    const slug = rawSlug.trim().toLowerCase();

    if (!isToolkitSlug(slug)) {
      return null;
    }

    try {
      const cachedOverview = await getCachedToolkitOverview(slug);

      if (cachedOverview) {
        return cachedOverview;
      }

      const toolkit = await getComposio().toolkits.get(slug);

      const overview: ToolkitOverview = {
        slug: toolkit.slug.toLowerCase(),
        name: toolkit.name,
        description:
          toolkit.meta.description?.trim() ||
          `${toolkit.name} is available as a Composio toolkit.`,
        logo: toolkit.meta.logo ?? null,
        websiteUrl: toolkit.meta.appUrl ?? null,
        categories:
          toolkit.meta.categories
            ?.map((category) => category.name)
            .filter(Boolean) ?? [],
        toolsCount: toolkit.meta.toolsCount ?? 0,
        triggersCount: toolkit.meta.triggersCount ?? 0,
        updatedAt: toolkit.meta.updatedAt ?? null,
        authConfigDetails: toolkit.authConfigDetails ?? [],
        managedSchemes:
          toolkit.composioManagedAuthSchemes?.map((mode) => mode.toUpperCase()) ??
          [],
      };

      await setCachedToolkitOverview(slug, overview);

      return overview;
    } catch (error) {
      if (error instanceof ComposioToolkitNotFoundError) {
        return null;
      }

      throw error;
    }
  }

export async function getToolkitDetail(
  rawSlug: string,
  userId: string
): Promise<ToolkitDetail | null> {
  const slug = rawSlug.trim().toLowerCase();

  if (!isToolkitSlug(slug)) {
    return null;
  }

  const [overview, connection, actionResult] = await Promise.all([
    getToolkitOverview(slug),
    getConnectionState(userId, slug),
    fetchToolkitActions(slug),
  ]);

  if (!overview) {
    return null;
  }

  const isNoAuth = connection.state?.isNoAuth ?? false;
  const authMethods = buildAuthMethods(overview, overview.name, isNoAuth);
  const uniqueScopes = new Set<string>();

  for (const method of authMethods) {
    for (const scope of method.scopes) {
      uniqueScopes.add(normalizeScopeKey(scope.name));
    }
  }

  const connectedAuthConfig = connection.state?.connection?.authConfig;

  return {
    slug: overview.slug,
    name: overview.name,
    description: overview.description,
    logo: overview.logo,
    websiteUrl: overview.websiteUrl,
    categories: overview.categories,
    toolsCount: Math.max(overview.toolsCount, actionResult.tools.length),
    triggersCount: overview.triggersCount,
    updatedAt: overview.updatedAt,
    authMethods,
    primaryAuthMethod:
      authMethods.find((method) => method.managedByComposio)?.label ??
      authMethods[0]?.label ??
      "Authentication",
    scopeCount: uniqueScopes.size,
    tools: actionResult.tools,
    toolsError: actionResult.error,
    isConnected: connection.state?.connection?.isActive ?? false,
    isNoAuth,
    connectionKnown: connection.known,
    connectionStatus:
      connection.state?.connection?.connectedAccount?.status ?? null,
    connectedAuthMethod: connectedAuthConfig
      ? authModeLabel(connectedAuthConfig.mode)
      : null,
    connectedViaComposio: connectedAuthConfig?.isComposioManaged ?? false,
  };
}
