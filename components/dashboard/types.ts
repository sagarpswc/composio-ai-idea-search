export type DashboardApp = {
  slug: string;
  name: string;
  logo: string | null;
  isNoAuth: boolean;
  isConnected: boolean;
  status: string | null;
};

export type CatalogResponse = {
  items: DashboardApp[];
  nextCursor: string | null;
  totalPages: number;
  pageSize: number;
  error?: string;
};

export type ConnectionsResponse = {
  items: DashboardApp[];
  error?: string;
};

export type ToolSearchItem = {
  slug: string;
  toolkit: string;
  description: string | null;
};

export type ToolSearchResponse = {
  success?: boolean;
  error?: string | null;
  tools?: ToolSearchItem[];
};

export type ExecutionResult = {
  resultType: "completed" | "failed";
  error: string | null;
  logId: string;
  data: Record<string, unknown>;
};

export type IdeaAction = {
  slug: string;
  name: string;
  description: string;
  kind: "read" | "create" | "update" | "delete" | "action";
  score: number;
  matchedTerms: string[];
  reason: string;
};

export type IdeaApp = {
  slug: string;
  name: string;
  logo: string | null;
  description: string;
  categories: string[];
  scopes: string[];
  scopeCount: number;
  isNoAuth: boolean;
  toolsCount: number;
  role: "primary" | "source" | "destination";
  action: IdeaAction;
};

export type IdeaStep = {
  order: number;
  appSlug: string;
  appName: string;
  actionSlug: string;
  actionName: string;
  instruction: string;
  description: string;
  matchedTerms: string[];
};

export type IdeaPlan = {
  id: string;
  rank: number;
  title: string;
  summary: string;
  why: string;
  confidence: "high" | "medium" | "low";
  score: number;
  totalScopes: number;
  apps: IdeaApp[];
  steps: IdeaStep[];
  unmatchedTerms: string[];
};

export type IdeaConnectionInfo = {
  known: boolean;
  connected: boolean;
  isNoAuth: boolean;
  status: string | null;
};

export type IdeaSearchResponse = {
  requirement: string;
  interpretation: {
    apps: string[];
    intents: string[];
    objects: string[];
    clauses: string[];
  };
  best: IdeaPlan | null;
  alternatives: IdeaPlan[];
  note: string;
  connections?: Record<string, IdeaConnectionInfo>;
  error?: string;
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

export type PlaygroundSetup = {
  prompt: string;
  toolSlug: string;
  toolName: string;
  description: string;
  toolkit: {
    slug: string;
    name: string;
    description: string;
    logo: string | null;
    categories: string[];
    scopes: string[];
    scopeCount: number;
    isNoAuth: boolean;
    toolsCount: number;
  };
  arguments: Record<string, unknown>;
  json: string;
  requiredFields: PlaygroundField[];
  optionalFields: PlaygroundField[];
  connection: PlaygroundConnection;
  source: "ai" | "template";
  model: string | null;
  reasoning: string;
  warning: string | null;
  alternatives: {
    slug: string;
    name: string;
    toolkitSlug: string;
    toolkitName: string;
    score: number;
  }[];
};

export type PlaygroundSeed = {
  toolSlug: string;
  prompt: string;
  autoBuild?: boolean;
  nonce: number;
};
