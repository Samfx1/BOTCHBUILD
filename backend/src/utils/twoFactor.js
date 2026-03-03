const QRCode = require("qrcode");
const speakeasy = require("speakeasy");

async function generateTwoFactorSetup(email) {
  const generated = speakeasy.generateSecret({
    name: `Botch Build (${email})`,
    issuer: "Botch Build",
    length: 20,
  });

  const qrCodeDataUrl = await QRCode.toDataURL(generated.otpauth_url);

  return {
    secret: generated.base32,
    manualEntryKey: generated.base32,
    qrCodeDataUrl,
  };
}

function verifyTotpToken(secret, token) {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token: token.replace(/\s+/g, ""),
    window: 1,
  });
}

module.exports = {
  generateTwoFactorSetup,
  verifyTotpToken,
};
