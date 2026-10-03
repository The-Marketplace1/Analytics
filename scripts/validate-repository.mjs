import { existsSync, readFileSync } from "node:fs";

const requiredFiles = [
  "src/index.ts",
  "src/app/index.ts",
  "src/events/index.ts",
  "src/tracking/pipeline.ts",
  "src/schemas/event.ts",
  "src/providers/contracts.ts",
  "src/privacy/policy.ts",
  "src/consent/index.ts",
  "src/enrichment/index.ts",
  "src/reporting/summary.ts",
  "src/authorization/index.ts",
  "src/integrations/event-store.ts",
  "src/api/routes.ts",
  "src/validation/index.ts",
  "src/errors/index.ts",
  "src/types/index.ts",
  "src/telemetry/index.ts",
  "src/retention/index.ts",
  "tests/unit/privacy.test.ts",
  "tests/integration/api.test.ts",
  "tests/events/pipeline.test.ts",
  "tests/providers/memory.test.ts",
  "tests/schemas/compatibility.test.ts",
  "tests/retention/retention.test.ts",
  "tests/reporting/summary.test.ts",
  "tests/privacy/consent.test.ts",
  "tests/authorization/reporting.test.ts",
  "tests/authorization/production-boundaries.test.ts",
  "tests/e2e/health.test.ts",
  "tests/e2e/event-flow.test.ts",
  "docs/event-contract.md",
  "docs/openapi.yaml",
  "eslint.config.js",
  "src/public.ts",
  "scripts/validate-repository.mjs",
  "vitest.config.ts",
  ".github/workflows/analytics-service-ci.yml",
  "Dockerfile",
  "docker-compose.yml",
  ".env.example",
  ".gitignore",
  "README.md",
  "LICENSE",
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`Missing required files:\n${missing.join("\n")}`);
  process.exit(1);
}

const workflow = readFileSync(".github/workflows/analytics-service-ci.yml", "utf8");
if (
  !(workflow.includes("pnpm run test") || workflow.includes("pnpm test")) ||
  !workflow.includes("pnpm run security") ||
  !workflow.includes("pnpm run lint") ||
  !workflow.includes("pnpm run typecheck") ||
  !workflow.includes("pnpm run build")
) {
  console.error("CI must run the actual test and security commands.");
  process.exit(1);
}

for (const forbiddenPath of [
  "artifacts",
  "api-server",
  "pnpm-workspace.yaml",
]) {
  if (existsSync(forbiddenPath)) {
    console.error(`Repository must remain a standalone Analytics service; found ${forbiddenPath}.`);
    process.exit(1);
  }
}

const lockfile = readFileSync("pnpm-lock.yaml", "utf8");
if (/^\s{2}(?:artifacts|lib)\/[^:]+:/m.test(lockfile) || lockfile.includes("@workspace/")) {
  console.error("The pnpm lockfile must not retain starter workspace package importers.");
  process.exit(1);
}

console.log(`Repository validation passed (${requiredFiles.length} required files).`);
