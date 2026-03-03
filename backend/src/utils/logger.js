const env = require("../config/env");

const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug");
const minimumPriority = LEVEL_PRIORITY[configuredLevel] ?? LEVEL_PRIORITY.info;

function shouldLog(level) {
  return (LEVEL_PRIORITY[level] ?? LEVEL_PRIORITY.info) >= minimumPriority;
}

function serializeError(error) {
  if (!error) {
    return undefined;
  }

  return {
    name: error.name,
    message: error.message,
    stack: env.NODE_ENV === "production" ? undefined : error.stack,
  };
}

function log(level, message, metadata = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "botchbuild-api",
    message,
    ...metadata,
  };

  const output = JSON.stringify(payload);
  if (level === "error") {
    // eslint-disable-next-line no-console
    console.error(output);
    return;
  }

  if (level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(output);
    return;
  }

  // eslint-disable-next-line no-console
  console.log(output);
}

function createRequestLogger(requestId) {
  return {
    debug: (message, metadata) => log("debug", message, { requestId, ...metadata }),
    info: (message, metadata) => log("info", message, { requestId, ...metadata }),
    warn: (message, metadata) => log("warn", message, { requestId, ...metadata }),
    error: (message, metadata) => log("error", message, { requestId, ...metadata }),
  };
}

module.exports = {
  log,
  createRequestLogger,
  serializeError,
};
