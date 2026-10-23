const baseUrl = process.env.APP_URL || "http://localhost:3000";
const email = process.env.SMOKE_EMAIL || "smoke@composio.local";
const password = process.env.SMOKE_PASSWORD || "smoke-password-123";

function cookiesFrom(response) {
  const values = response.headers.getSetCookie?.() || [];
  const fallback = response.headers.get("set-cookie");

  if (values.length === 0 && fallback) {
    values.push(fallback);
  }

  return values.map((value) => value.split(";")[0]).join("; ");
}

async function main() {
  const unauthorized = await fetch(`${baseUrl}/api/toolkits`);

  if (unauthorized.status !== 401) {
    throw new Error(
      `Expected signed-out catalog access to return 401, got ${unauthorized.status}.`
    );
  }

  let authResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (authResponse.status === 409) {
    authResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  }

  if (!authResponse.ok) {
    throw new Error(`Auth failed: ${await authResponse.text()}`);
  }

  const cookie = cookiesFrom(authResponse);

  if (!cookie) {
    throw new Error("Auth endpoint did not return a session cookie.");
  }

  const sessionResponse = await fetch(`${baseUrl}/api/session`, {
    headers: { cookie },
  });

  if (!sessionResponse.ok) {
    throw new Error(`Session bootstrap failed: ${await sessionResponse.text()}`);
  }

  const catalogResponse = await fetch(
    `${baseUrl}/api/toolkits?limit=1`,
    { headers: { cookie } }
  );

  if (!catalogResponse.ok) {
    throw new Error(`Catalog failed: ${await catalogResponse.text()}`);
  }

  const catalog = await catalogResponse.json();
  const executionResponse = await fetch(`${baseUrl}/api/execute`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: JSON.stringify({
      toolSlug: "HACKERNEWS_GET_USER",
      arguments: { username: "pg" },
    }),
  });

  const result = await executionResponse.json();

  if (!executionResponse.ok) {
    throw new Error(`Tool execution failed: ${result.error || "unknown error"}`);
  }

  if (result.resultType !== "completed") {
    throw new Error(`Tool did not complete: ${result.error || "unknown error"}`);
  }

  if (!result.logId) {
    throw new Error("Tool execution returned no Composio log ID.");
  }

  console.log(
    JSON.stringify(
      {
        auth: "email/password cookie",
        signedOutCatalogStatus: unauthorized.status,
        catalogPages: catalog.totalPages,
        tool: "HACKERNEWS_GET_USER",
        resultType: result.resultType,
        logId: result.logId,
        data: result.data,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
