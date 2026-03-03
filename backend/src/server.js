const env = require("./config/env");
const { pool } = require("./db");
const { createApp } = require("./app");
const { log, serializeError } = require("./utils/logger");

const app = createApp();
const server = app.listen(env.PORT, () => {
  log("info", "server.started", {
    port: env.PORT,
    environment: env.NODE_ENV,
  });
});

async function shutdown(signal) {
  log("info", "server.shutdown.requested", { signal });
  server.close(async () => {
    await pool.end();
    log("info", "server.shutdown.completed", { signal });
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  log("error", "server.uncaught_exception", {
    error: serializeError(error),
  });
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  log("error", "server.unhandled_rejection", {
    reason: String(reason),
  });
});
