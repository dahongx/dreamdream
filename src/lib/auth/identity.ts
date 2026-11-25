const INTERNAL_AUTH_EMAIL_DOMAIN = "users.yearn.local";

// 用户名是展示名（非唯一，登录靠唯一 email）。Unicode Letter / Mark / Number
// 覆盖繁中、日文假名、泰文组合音标等目标语言；保留历史允许的连字符，
// 其余空格和标点仍不允许。注册与设置页必须共用这一份契约。
export const USERNAME_RE = /^[\p{L}\p{M}\p{N}_-]{2,32}$/u;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function internalAuthEmailForUsername(username: string): string {
  return `${normalizeUsername(username)}@${INTERNAL_AUTH_EMAIL_DOMAIN}`;
}

export function isEmailIdentifier(value: string): boolean {
  return EMAIL_RE.test(normalizeEmail(value));
}
