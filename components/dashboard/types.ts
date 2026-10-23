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
