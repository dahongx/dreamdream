// 密码策略单一来源。必须与 Supabase 后台 Auth 的密码策略保持一致：
//   · 最少长度 8 位（后台 minimum_password_length = 8）
//   · 同时包含字母与数字（后台 password_requirements = letters_digits）
//
// Supabase 服务端才是最终裁判；这里做前置校验只为在提交前给用户即时、可读的
// 中文提示，避免落到后端后返回一句生硬的英文报错。改后台策略时记得同步改这里
// 和 i18n 文案（passwordPlaceholder / passwordTooShort / passwordWeak）。

export const PASSWORD_MIN_LENGTH = 8;

// 字母含中日韩等 Unicode 字母（\p{L}）——与 Supabase 的 letters 定义一致地宽松。
const HAS_LETTER = /\p{L}/u;
const HAS_DIGIT = /\d/;

/**
 * 校验密码是否满足策略。
 * @returns 违规时返回对应 i18n 错误 key，合规返回 null。
 */
export function validatePassword(
  password: string,
): "passwordTooShort" | "passwordWeak" | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "passwordTooShort";
  if (!HAS_LETTER.test(password) || !HAS_DIGIT.test(password)) {
    return "passwordWeak";
  }
  return null;
}
