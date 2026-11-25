import { createSign, createVerify } from "node:crypto";
import { readFileSync } from "node:fs";

const TEST_BASE_URL = "https://api.payproo.tech";
const PRODUCTION_BASE_URL = "https://api.payproo.com";

export interface PayProoConfig {
  appId: number;
  region: "hk" | "tw";
  currency: "HKD" | "TWD";
  collectApplyPath: string;
  merchantSecretKey: string;
  merchantPrivateKey: string;
  platformPublicKey: string;
  baseUrl: string;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 未配置`);
  return value;
}

function normalizePem(
  value: string,
  type: "PRIVATE KEY" | "PUBLIC KEY",
): string {
  const normalized = value.replace(/\\n/g, "\n").trim();
  if (normalized.includes("-----BEGIN ")) return normalized;
  const compact = normalized.replace(/\s+/g, "");
  return `-----BEGIN ${type}-----\n${compact}\n-----END ${type}-----`;
}

function merchantPrivateKey(): string {
  const filePath = process.env.PAYPROO_MERCHANT_PRIVATE_KEY_FILE?.trim();
  if (filePath) {
    try {
      return readFileSync(filePath, "utf8");
    } catch (error) {
      throw new Error(
        `PAYPROO_MERCHANT_PRIVATE_KEY_FILE 无法读取: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
  return requiredEnv("PAYPROO_MERCHANT_PRIVATE_KEY");
}

export function getPayProoConfig(): PayProoConfig {
  const appId = Number.parseInt(requiredEnv("PAYPROO_APP_ID"), 10);
  if (!Number.isSafeInteger(appId) || appId <= 0) {
    throw new Error("PAYPROO_APP_ID 必须是正整数");
  }

  const environment = process.env.PAYPROO_ENVIRONMENT?.trim() ?? "test";
  if (environment !== "test" && environment !== "production") {
    throw new Error("PAYPROO_ENVIRONMENT 必须是 test 或 production");
  }
  const region = process.env.PAYPROO_REGION?.trim().toLowerCase() ?? "hk";
  if (region !== "hk" && region !== "tw") {
    throw new Error("PAYPROO_REGION 必须是 hk 或 tw");
  }
  const baseUrl =
    process.env.PAYPROO_BASE_URL?.trim() ||
    (environment === "production" ? PRODUCTION_BASE_URL : TEST_BASE_URL);

  return {
    appId,
    region,
    currency: region === "tw" ? "TWD" : "HKD",
    collectApplyPath:
      region === "tw" ? "/twd/collect/apply" : "/hkd/collect/apply",
    merchantSecretKey: requiredEnv("PAYPROO_MERCHANT_SECRET_KEY"),
    merchantPrivateKey: normalizePem(merchantPrivateKey(), "PRIVATE KEY"),
    platformPublicKey: normalizePem(
      requiredEnv("PAYPROO_PLATFORM_PUBLIC_KEY"),
      "PUBLIC KEY",
    ),
    baseUrl: baseUrl.replace(/\/+$/, ""),
  };
}

type SignableValue = string | number | boolean | null | undefined;

function isNonEmpty(value: SignableValue): boolean {
  return value !== null && value !== undefined && value !== "";
}

export function canonicalize(
  payload: Record<string, SignableValue>,
  secretKey: string,
): string {
  const entries = Object.entries(payload)
    .filter(
      ([key, value]) =>
        key !== "sign" && key !== "sign_type" && isNonEmpty(value),
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `${entries
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&")}&key=${secretKey}`;
}

export function signPayload(
  payload: Record<string, SignableValue>,
  config: PayProoConfig,
): string {
  const signer = createSign("RSA-SHA256");
  signer.update(canonicalize(payload, config.merchantSecretKey), "utf8");
  signer.end();
  return signer.sign(config.merchantPrivateKey, "base64");
}

export function verifyPayload(
  payload: Record<string, SignableValue>,
  signature: string,
  config: PayProoConfig,
): boolean {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(canonicalize(payload, config.merchantSecretKey), "utf8");
  verifier.end();
  return verifier.verify(config.platformPublicKey, signature, "base64");
}

export async function postPayProo<T>(
  path: string,
  payload: Record<string, SignableValue>,
  config: PayProoConfig,
): Promise<T> {
  const signedPayload = { ...payload, sign: signPayload(payload, config) };
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(signedPayload),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`PayProo HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}
