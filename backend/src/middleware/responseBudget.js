const env = require("../config/env");
const { log } = require("../utils/logger");

function responseBudget(req, res, next) {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    let bytes = 0;
    try {
      bytes = Buffer.byteLength(JSON.stringify(payload), "utf-8");
    } catch (_error) {
      bytes = 0;
    }

    const budget = env.API_RESPONSE_BUDGET_BYTES;
    const exceeded = bytes > budget;
    res.setHeader("x-response-bytes", String(bytes));
    res.setHeader("x-response-budget", String(budget));
    res.setHeader("x-response-budget-exceeded", String(exceeded));

    if (exceeded) {
      log("warn", "response.budget.exceeded", {
        requestId: req.context?.requestId ?? null,
        method: req.method,
        path: req.originalUrl || req.url,
        bytes,
        budget,
      });
    }

    return originalJson(payload);
  };

  next();
}

module.exports = {
  responseBudget,
};
