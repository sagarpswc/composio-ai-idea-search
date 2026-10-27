import {
  rankActionsForPrompt,
  type ActionCandidate,
  type MentionRole,
  type PromptAnalysis,
} from "@/lib/composio-discovery";

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
  role: MentionRole;
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

export type IdeaSearchResult = {
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
};

const DISPLAY_INTENT_WORDS = new Set([
  "add",
  "alert",
  "archive",
  "assign",
  "check",
  "close",
  "copy",
  "create",
  "delete",
  "download",
  "edit",
  "email",
  "export",
  "fetch",
  "file",
  "find",
  "generate",
  "get",
  "insert",
  "invite",
  "label",
  "list",
  "load",
  "make",
  "mark",
  "meeting",
  "message",
  "modify",
  "move",
  "new",
  "notify",
  "open",
  "post",
  "publish",
  "read",
  "remove",
  "rename",
  "reply",
  "retrieve",
  "revoke",
  "save",
  "schedule",
  "search",
  "send",
  "set",
  "share",
  "show",
  "trash",
  "update",
  "upload",
  "view",
  "write",
]);

function trimDescription(value: string, maxLength = 220): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function lowerFirst(value: string): string {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function appRoleLabel(role: MentionRole): string {
  if (role === "source") {
    return "trigger";
  }

  if (role === "destination") {
    return "destination";
  }

  return "primary";
}

function planTitle(candidates: ActionCandidate[]): string {
  const parts = candidates.map(
    (candidate) => `${candidate.action.name} in ${candidate.toolkit.name}`
  );

  if (parts.length === 0) {
    return "Workflow plan";
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return parts
    .map((part, index) => (index === 0 ? part : lowerFirst(part)))
    .join(", then ");
}

function planSummary(candidates: ActionCandidate[], title: string): string {
  if (candidates.length === 1) {
    const [candidate] = candidates;
    return `${title}. ${candidate.toolkit.name} is the best match for this request, and “${candidate.action.name}” is the strongest action for this step.`;
  }

  const uses = candidates
    .map((candidate) => `${candidate.toolkit.name} for “${candidate.action.name}”`)
    .join(" and ");

  return `${title}. This ${candidates.length}-app workflow uses ${uses}. Each selected action covers a different part of the request, so the plan stays focused instead of adding unnecessary tools.`;
}

function planWhy(candidates: ActionCandidate[]): string {
  return candidates
    .map((candidate) => {
      const role = appRoleLabel(candidate.role);
      return `${candidate.toolkit.name} (${role}): ${candidate.reason}`;
    })
    .join(" ");
}

function planConfidence(candidates: ActionCandidate[]): "high" | "medium" | "low" {
  const scores = candidates.map((candidate) =>
    Math.max(0, candidate.score - (candidate.explicit ? 40 : 0))
  );
  const minimum = scores.length > 0 ? Math.min(...scores) : 0;

  if (minimum >= 25) {
    return "high";
  }

  if (minimum >= 10) {
    return "medium";
  }

  return "low";
}

function stepInstruction(candidate: ActionCandidate): string {
  const description = trimDescription(candidate.action.description);

  if (candidate.role === "source") {
    return description
      ? `Read the trigger from ${candidate.toolkit.name} with “${candidate.action.name}”. ${description}`
      : `Read the trigger from ${candidate.toolkit.name} with “${candidate.action.name}”.`;
  }

  if (candidate.role === "destination") {
    return description
      ? `Send the result to ${candidate.toolkit.name} with “${candidate.action.name}”. ${description}`
      : `Send the result to ${candidate.toolkit.name} with “${candidate.action.name}”.`;
  }

  return description
    ? `Use “${candidate.action.name}” in ${candidate.toolkit.name}. ${description}`
    : `Use “${candidate.action.name}” in ${candidate.toolkit.name}.`;
}

function buildPlan(
  candidates: ActionCandidate[],
  analysis: PromptAnalysis
): IdeaPlan {
  const ordered = [...candidates].sort((a, b) => {
    const roleRank: Record<MentionRole, number> = {
      source: 0,
      primary: 1,
      destination: 2,
    };
    const role = roleRank[a.role] - roleRank[b.role];
    if (role !== 0) {
      return role;
    }

    const clause = a.clauseIndex - b.clauseIndex;
    return clause || a.toolkit.name.localeCompare(b.toolkit.name);
  });

  const title = planTitle(ordered);
  const totalScopes = ordered.reduce(
    (sum, candidate) => sum + candidate.toolkit.scopeCount,
    0
  );
  const score =
    ordered.reduce((sum, candidate) => sum + candidate.score, 0) +
    ordered.length * 12 -
    totalScopes * 0.01;

  const apps: IdeaApp[] = ordered.map((candidate) => ({
    slug: candidate.toolkit.slug,
    name: candidate.toolkit.name,
    logo: candidate.toolkit.logo,
    description: candidate.toolkit.description,
    categories: candidate.toolkit.categories,
    scopes: candidate.toolkit.scopes,
    scopeCount: candidate.toolkit.scopeCount,
    isNoAuth: candidate.toolkit.isNoAuth,
    toolsCount: candidate.toolkit.toolsCount,
    role: candidate.role,
    action: {
      slug: candidate.action.slug,
      name: candidate.action.name,
      description: candidate.action.description,
      kind: candidate.action.kind,
      score: candidate.score,
      matchedTerms: candidate.matchedTerms,
      reason: candidate.reason,
    },
  }));

  const steps: IdeaStep[] = ordered.map((candidate, index) => ({
    order: index + 1,
    appSlug: candidate.toolkit.slug,
    appName: candidate.toolkit.name,
    actionSlug: candidate.action.slug,
    actionName: candidate.action.name,
    instruction: stepInstruction(candidate),
    description: trimDescription(candidate.action.description, 320),
    matchedTerms: candidate.matchedTerms,
  }));

  const planText = ordered
    .map(
      (candidate) =>
        `${candidate.toolkit.name} ${candidate.action.name} ${candidate.action.description}`
    )
    .join(" ")
    .toLowerCase();
  const unmatchedTerms = analysis.objectWords
    .filter((word) => word.length > 3)
    .filter((word) => !DISPLAY_INTENT_WORDS.has(word))
    .filter((word) => !planText.includes(word))
    .slice(0, 4);

  return {
    id: ordered.map((candidate) => candidate.action.slug).join("+"),
    rank: 0,
    title,
    summary: planSummary(ordered, title),
    why: planWhy(ordered),
    confidence: planConfidence(ordered),
    score: Math.round(score * 100) / 100,
    totalScopes,
    apps,
    steps,
    unmatchedTerms,
  };
}

function planSignature(plan: IdeaPlan): string {
  return plan.apps
    .map((app) => `${app.slug}:${app.action.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}`)
    .join("|");
}

function groupCandidates(candidates: ActionCandidate[]): Map<string, ActionCandidate[]> {
  const grouped = new Map<string, ActionCandidate[]>();

  for (const candidate of candidates) {
    const list = grouped.get(candidate.toolkit.slug) ?? [];
    list.push(candidate);
    grouped.set(candidate.toolkit.slug, list);
  }

  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        b.score - a.score ||
        a.clauseIndex - b.clauseIndex ||
        a.action.name.localeCompare(b.action.name)
    );
  }

  return grouped;
}

export async function searchComposioIdeas(
  requirement: string,
  limit = 8
): Promise<IdeaSearchResult> {
  const prompt = requirement.trim();

  if (!prompt) {
    return {
      requirement,
      interpretation: { apps: [], intents: [], objects: [], clauses: [] },
      best: null,
      alternatives: [],
      note: "Describe the outcome you want. Add app names when you already know which tools should be involved.",
    };
  }

  const { analysis, candidates } = await rankActionsForPrompt(prompt, 36);

  if (candidates.length === 0) {
    return {
      requirement: prompt,
      interpretation: {
        apps: analysis.mentions.map((mention) => mention.name),
        intents: analysis.intents,
        objects: analysis.objectWords
          .filter((word) => !DISPLAY_INTENT_WORDS.has(word))
          .slice(0, 6),
        clauses: analysis.clauses.map((clause) => clause.text),
      },
      best: null,
      alternatives: [],
      note: "No strong action match was found. Try naming the app you want to use, or describe the trigger and the result separately.",
    };
  }

  const grouped = groupCandidates(candidates);
  const mentionSlugs = [...new Set(analysis.mentions.map((mention) => mention.slug))];
  const plans: IdeaPlan[] = [];
  const seen = new Set<string>();
  const seenSignatures = new Set<string>();

  const addPlan = (plan: IdeaPlan) => {
    if (seen.has(plan.id)) {
      return;
    }

    const signature = planSignature(plan);
    if (seenSignatures.has(signature)) {
      return;
    }

    seen.add(plan.id);
    seenSignatures.add(signature);
    plans.push(plan);
  };

  if (mentionSlugs.length > 0) {
    const primaryCandidates = mentionSlugs
      .map((slug) => grouped.get(slug)?.[0])
      .filter((candidate): candidate is ActionCandidate => Boolean(candidate));

    if (primaryCandidates.length > 0) {
      addPlan(buildPlan(primaryCandidates, analysis));

      for (let index = 0; index < primaryCandidates.length; index += 1) {
        const alternatives = grouped.get(primaryCandidates[index].toolkit.slug) ?? [];

        for (const alternative of alternatives.slice(1, 3)) {
          const swapped = [...primaryCandidates];
          swapped[index] = alternative;
          addPlan(buildPlan(swapped, analysis));
        }
      }
    }
  } else {
    const seenToolkits = new Set<string>();

    for (const candidate of candidates) {
      if (seenToolkits.has(candidate.toolkit.slug)) {
        continue;
      }

      seenToolkits.add(candidate.toolkit.slug);
      addPlan(buildPlan([candidate], analysis));

      if (seenToolkits.size >= 4) {
        break;
      }
    }
  }

  plans.sort(
    (a, b) =>
      b.score - a.score ||
      b.apps.length - a.apps.length ||
      a.totalScopes - b.totalScopes
  );

  const maxPlans = Math.max(1, Math.min(4, Math.trunc(limit) || 4));
  const ranked = plans.slice(0, maxPlans).map((plan, index) => ({
    ...plan,
    rank: index + 1,
  }));

  return {
    requirement: prompt,
    interpretation: {
      apps: [
        ...new Set(
          (mentionSlugs.length > 0
            ? analysis.mentions.map((mention) => mention.name)
            : ranked[0]?.apps.map((app) => app.name) ?? []
          ).filter(Boolean)
        ),
      ],
      intents: analysis.intents,
      objects: [
        ...new Set(
          analysis.objectWords
            .filter((word) => !DISPLAY_INTENT_WORDS.has(word))
            .filter((word) => word.length > 2)
            .slice(0, 8)
        ),
      ],
      clauses: analysis.clauses.map((clause) => clause.text),
    },
    best: ranked[0] ?? null,
    alternatives: ranked.slice(1),
    note:
      ranked.length > 0
        ? "Steps only — no code is returned. Connect any required app, then open a step in the playground to generate its JSON arguments."
        : "No workflow plan could be built from the current catalog.",
  };
}
