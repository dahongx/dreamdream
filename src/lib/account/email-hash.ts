/**
 * 已注销邮箱的单向指纹。
 *
 * 用途只有一个：同一邮箱注销后重新注册时，不再发新人币（users 表列默认值
 * gold 100 / silver 200，不挡的话「注销→重注册」可以无限刷）。
 *
 * 为什么是 HMAC 而不是裸 SHA256：
 *   邮箱的取值空间小到可以字典枚举 —— 拿到 deactivated_email_hashes 表的人
 *   只要把常见邮箱挨个哈希一遍就能反查出「谁注销过」。加一个只存在服务端 env
 *   的 pepper，离线枚举就失效了。
 *
 * pepper 缺失时**抛错而不是降级**：静默退回裸哈希会让一张本该无法反查的表
 * 悄悄变成可反查，正是那种「上线半年后才发现」的事故。宁可注销流程当场失败。
 */

import { createHmac } from "node:crypto";
import { normalizeEmail } from "@/lib/auth/identity";

export const EMAIL_PEPPER_ENV = "ACCOUNT_DELETION_EMAIL_PEPPER";

export function hashDeactivatedEmail(email: string, pepper: string): string {
  if (!pepper) {
    throw new Error(
      `[account] ${EMAIL_PEPPER_ENV} 未设置 —— 拒绝用无 pepper 的裸哈希写入 deactivated_email_hashes`,
    );
  }
  return createHmac("sha256", pepper)
    .update(normalizeEmail(email))
    .digest("hex");
}

export function hashDeactivatedEmailFromEnv(email: string): string {
  return hashDeactivatedEmail(email, process.env[EMAIL_PEPPER_ENV] ?? "");
}
