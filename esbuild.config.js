const esbuild = require("esbuild");

esbuild
  .build({
    entryPoints: [
      "src/index.ts",
      "src/handlers/api/notification-api-lambda.ts",
      "src/handlers/consumers/channel-lambdas.ts",
      "src/handlers/retry/retry-worker-lambda.ts",
    ],
    outdir: "dist",
    outbase: "src",
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
  })
  .catch(() => process.exit(1));
