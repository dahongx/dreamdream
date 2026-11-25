import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import {
  canonicalize,
  type PayProoConfig,
  signPayload,
  verifyPayload,
} from "@/lib/payproo/client";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const config: PayProoConfig = {
  appId: 1000,
  region: "tw",
  currency: "TWD",
  collectApplyPath: "/twd/collect/apply",
  merchantSecretKey: "merchant-secret",
  merchantPrivateKey: privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString(),
  platformPublicKey: publicKey
    .export({ type: "spki", format: "pem" })
    .toString(),
  baseUrl: "https://api.payproo.tech",
};

describe("PayProo signature", () => {
  test("canonicalizes non-empty fields in ASCII order and excludes sign fields", () => {
    expect(
      canonicalize(
        {
          z: "last",
          a: "first",
          empty: "",
          nullable: null,
          sign: "old",
          sign_type: "RSA",
        },
        "merchant-secret",
      ),
    ).toBe("a=first&z=last&key=merchant-secret");
  });

  test("round-trips SHA256WithRSA signatures", () => {
    const payload = {
      appId: 1000,
      orderId: "dearm-order-1",
      amount: "30.00",
      payModel: "ALIPAY",
    };
    const signature = signPayload(payload, config);

    expect(verifyPayload(payload, signature, config)).toBe(true);
    expect(
      verifyPayload({ ...payload, amount: "68.00" }, signature, config),
    ).toBe(false);
  });
});
