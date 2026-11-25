/**
 * Stripe 服务端单例。
 *
 * 只在 server（route handler / server action）里 import —— 跑在 webpack 打包的
 * Node worker 上（非 Bun runtime，见 [[feedback_next_server_context_not_bun]]），
 * Stripe SDK 是纯 Node，OK。
 *
 * apiVersion 不手动 pin：用 SDK v22 自带的默认版本，避免 TS literal 类型漂移；
 * 升级 SDK 时随之走最新稳定版。
 *
 * 代理注意：本机 dev 走 HTTPS_PROXY（.env.local）。Node 默认 https 不读该 env，
 * 若 checkout/webpack 调 api.stripe.com 卡住，再给这里配 https-proxy-agent。
 * 生产环境直连，无需代理。
 */

import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

let cached: Stripe | null = null;

/**
 * 拿 Stripe 实例。缺 STRIPE_SECRET_KEY 时抛清晰错误（而不是构造出半残实例
 * 在调用时报含糊的鉴权失败）。调用方都在 server，错误会被 route/action 捕获。
 */
export function getStripe(): Stripe {
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY 未配置 —— 请在 .env.local 填入 sk_test_... / sk_live_...",
    );
  }
  if (!cached) {
    cached = new Stripe(secretKey, {
      // 标注一下集成来源，方便在 Stripe Dashboard 的请求日志里识别。
      appInfo: { name: "dearm", url: "https://dearm.ai" },
    });
  }
  return cached;
}
