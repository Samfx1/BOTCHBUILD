const env = require("./config/env");
const { pool } = require("./db");
const { createApp } = require("./app");

const app = createApp();
const server = app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend API listening on port ${env.PORT}`);
});

async function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`Received ${signal}, shutting down gracefully...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
