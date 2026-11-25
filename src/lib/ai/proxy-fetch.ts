import { type Dispatcher, ProxyAgent } from "undici";

/**
 * 代理感知 fetch —— Node 的全局 `fetch`（undici）**不读** HTTP_PROXY/HTTPS_PROXY
 * 环境变量（跟 curl / axios 不一样），所以国内出口直连 zhengmi / modelverse
 * 会吃 Cloudflare 403。这里读 *_PROXY env 构造 undici ProxyAgent，挂到 init.dispatcher
 * 上——undici fetch 认这个非标字段。
 *
 * 只给 LLM provider 用（见 provider.ts）：这些 endpoint 永远是外网，全程走代理即可，
 * 不需要 NO_PROXY 逻辑。Supabase / 本地 docker 的 fetch 不经过这里，保持直连。
 *
 * 没配代理时退化成全局 fetch，零开销零行为变化。
 */

const proxyUrl =
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy;

// 进程内单例：一个 ProxyAgent 复用连接池，别每次请求新建。
const dispatcher: Dispatcher | undefined = proxyUrl
  ? new ProxyAgent(proxyUrl)
  : undefined;

type FetchInitWithDispatcher = RequestInit & { dispatcher?: Dispatcher };

// AI SDK 的 `fetch` option 要求完整的 `typeof fetch`（含 `preconnect`），
// 包装函数只实现调用签名，用一次精确 cast 补齐契约——比伪造 preconnect 干净。
export const proxyFetch: typeof globalThis.fetch = dispatcher
  ? (((input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, {
        ...init,
        dispatcher,
      } as FetchInitWithDispatcher)) as typeof globalThis.fetch)
  : globalThis.fetch;
