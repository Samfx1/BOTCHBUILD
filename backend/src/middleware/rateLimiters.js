const rateLimit = require("express-rate-limit");
const env = require("../config/env");

function createLimiter({ windowMs, max, message, standardHeaders = "draft-8" }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders,
    legacyHeaders: false,
    message: {
      error: "TooManyRequests",
      message,
    },
  });
}

const globalLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: env.RATE_LIMIT_GLOBAL_MAX,
  message: "Too many requests. Please try again later.",
});

const authSensitiveLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: env.RATE_LIMIT_AUTH_MAX,
  message: "Too many authentication attempts. Please wait and retry.",
});

const writeActionLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: env.RATE_LIMIT_WRITE_MAX,
  message: "Write rate limit exceeded. Please slow down.",
});

const webhookLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: env.RATE_LIMIT_WEBHOOK_MAX,
  message: "Webhook rate limit exceeded.",
});

const opsLimiter = createLimiter({
  windowMs: 5 * 60 * 1000,
  max: env.RATE_LIMIT_OPS_MAX,
  message: "Operations endpoint rate limit exceeded.",
});

module.exports = {
  globalLimiter,
  authSensitiveLimiter,
  writeActionLimiter,
  webhookLimiter,
  opsLimiter,
};
