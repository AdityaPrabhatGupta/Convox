const args = process.argv.slice(2);

function readArg(flag, fallback = "") {
  const index = args.indexOf(flag);
  if (index === -1) return fallback;
  return args[index + 1] || fallback;
}

const backendHealthUrl =
  readArg("--backend", process.env.BACKEND_HEALTH_URL || "http://localhost:5000/api/health");
const frontendUrl =
  readArg("--frontend", process.env.FRONTEND_URL || "");

async function checkUrl(url, label, expectsJson = false) {
  const response = await fetch(url, {
    headers: expectsJson ? { Accept: "application/json" } : {},
  });

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}`);
  }

  if (!expectsJson) {
    return { ok: true, status: response.status };
  }

  const payload = await response.json();
  if (payload?.status !== "ok") {
    throw new Error(`${label} payload did not report ok status`);
  }

  return payload;
}

async function main() {
  console.log(`Checking backend health: ${backendHealthUrl}`);
  const backend = await checkUrl(backendHealthUrl, "Backend health", true);
  console.log(
    JSON.stringify(
      {
        backend: {
          status: backend.status,
          environment: backend.environment,
          database: backend.database,
          redis: backend.redis,
        },
      },
      null,
      2,
    ),
  );

  if (frontendUrl) {
    console.log(`Checking frontend: ${frontendUrl}`);
    const frontend = await checkUrl(frontendUrl, "Frontend");
    console.log(JSON.stringify({ frontend }, null, 2));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
