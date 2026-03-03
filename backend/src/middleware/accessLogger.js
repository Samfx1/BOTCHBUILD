const { log } = require("../utils/logger");

function resolveClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function accessLogger(req, res, next) {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    log(level, "http.request.completed", {
      requestId: req.context?.requestId ?? null,
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      clientIp: resolveClientIp(req),
      userAgent: req.headers["user-agent"] ?? null,
      contentLength: res.getHeader("content-length") ?? null,
      actorUserId: req.auth?.sub ?? null,
    });
  });

  next();
}

module.exports = {
  accessLogger,
};
