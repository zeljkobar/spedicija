import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["--test", "test/application.integration.test.js"], {
  stdio: "inherit",
  env: { ...process.env, RUN_DATABASE_TESTS: "1" }
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
