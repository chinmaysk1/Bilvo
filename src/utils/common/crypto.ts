import crypto from "crypto";

const ALGO = "aes-256-gcm";
const KEY = crypto
  .createHash("sha256")
  .update(process.env.UTILITY_PASSWORD_SECRET!)
  .digest(); // 32 bytes key

export function encryptPassword(password: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);

  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encrypted: `${encrypted}:${authTag}`,
    iv: iv.toString("hex"),
  };
}

export function decryptPassword(encrypted: string, ivHex: string) {
  const [ciphertext, authTagHex] = encrypted.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export default { encryptPassword, decryptPassword };
