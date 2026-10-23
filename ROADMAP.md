# Roadmap

## Vision

Composio AI Idea Search helps developers and teams discover the smallest safe set of Composio tools for a workflow, then turn that discovery into implementation steps and least-privilege connection plans.

## Current release

- Multi-user email/password accounts with isolated Composio sessions
- Live Composio toolkit catalog with pagination and search
- App detail pages with scopes, actions, and connection state
- Local Composio cache for apps, scopes, and actions
- Weekly Saturday cache refresh
- AI idea search with ranked combinations and steps only
- Optional local-model refinement through Ollama
- Docker Compose and one-command setup

## B2B-focused next steps

1. **Saved idea searches and reports**
   - Save requirement searches per account.
   - Export ranked combinations as Markdown or JSON.
   - Track which workflows were implemented.

2. **Workflow templates**
   - Ship reusable workflow templates such as “GitHub issue to Slack alert”.
   - Let teams fork and customize templates.

3. **Audit and usage analytics**
   - Record tool executions, connection changes, and idea-search usage.
   - Add per-account and per-workspace usage summaries.
   - Surface scope and permission review history.

4. **Team collaboration**
   - Add organizations, invitations, and shared workflow libraries.
   - Keep Composio sessions isolated per user while allowing shared templates.

5. **Enterprise readiness**
   - Add rate limiting, CSRF protection, and request-size limits.
   - Replace local JSON stores with a production database.
   - Add SSO-ready authentication boundaries without changing Composio session isolation.

6. **Advanced Composio coverage**
   - Add trigger and webhook management.
   - Add batch tool execution and multi-account connection selection.
   - Add cost and latency estimates for suggested combinations.

7. **Open-source growth**
   - Publish screenshots and a short demo video.
   - Add integration tests and a live demo.
   - Create good-first-issue tasks for new connectors and ranking improvements.