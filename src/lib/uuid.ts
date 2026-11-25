/**
 * RFC 4122 v4 UUID。
 *
 * 为什么不直接 `crypto.randomUUID()`：浏览器只在 secure context（HTTPS 或
 * localhost）才挂 `crypto.randomUUID`。线上 HTTP IP 直访（如 dev / 内网 /
 * 还没装证书的临时入口）下它是 undefined，调一次整页就崩 —— useChat 的
 * generateId 配置正是这条引爆路径。
 *
 * 选 polyfill 顺序：crypto.randomUUID → crypto.getRandomValues 拼 v4
 * → Math.random 兜底（极端：node 旧 + getRandomValues 缺失，正常浏览器走
 * 不到这里）。
 */
export function safeRandomUUID(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0"));
    return `${h.slice(0, 4).join("")}-${h.slice(4, 6).join("")}-${h.slice(6, 8).join("")}-${h.slice(8, 10).join("")}-${h.slice(10, 16).join("")}`;
  }
  // 退路：非加密随机,只用于 ID 唯一性,不做安全保证
  const rnd = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${rnd()}${rnd()}-${rnd()}-4${rnd().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rnd().slice(1)}-${rnd()}${rnd()}${rnd()}`;
}
