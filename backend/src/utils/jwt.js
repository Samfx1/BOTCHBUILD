const jwt = require("jsonwebtoken");
const env = require("../config/env");

const ISSUER = "botchbuild-api";
const AUDIENCE = "botchbuild-clients";

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      tokenType: "access",
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_EXPIRES_IN,
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (payload.tokenType !== "access") {
    throw new Error("Invalid token type");
  }

  return payload;
}

function signTwoFactorToken(userId) {
  return jwt.sign(
    {
      sub: userId,
      tokenType: "2fa",
    },
    env.JWT_2FA_SECRET,
    {
      expiresIn: env.JWT_2FA_EXPIRES_IN,
      issuer: ISSUER,
      audience: AUDIENCE,
    },
  );
}

function verifyTwoFactorToken(token) {
  const payload = jwt.verify(token, env.JWT_2FA_SECRET, {
    issuer: ISSUER,
    audience: AUDIENCE,
  });

  if (payload.tokenType !== "2fa") {
    throw new Error("Invalid token type");
  }

  return payload;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signTwoFactorToken,
  verifyTwoFactorToken,
};
