# 忘记密码 / 重设密码（技术交接）

> 配套产品思考：[../insights/password-reset.md](../insights/password-reset.md)
> 相关：Supabase 认证 [supabase-auth.md](./supabase-auth.md) · 云端对接 [supabase-cloud-migration.md](./supabase-cloud-migration.md)

## 为什么有这个

切到 Supabase Auth（email + 密码）后，老用户从自托管库迁到云端。若迁移没带上可用的
`auth.users.encrypted_password`，用户就登不进来 —— 而 app 此前**完全没有找回密码入口**。
本功能补齐这条自救链路，也是新用户日常忘记密码的标准出口。

## 链路（复用现有 Supabase + callback，不改登录/注册/回调逻辑）

```
/forgot-password  (填邮箱)
  → POST /api/auth/forgot-password
  → supabase.auth.resetPasswordForEmail(email, { redirectTo: /auth/callback?next=/reset-password })
  → Supabase 经 Resend SMTP 发重置信
用户点信里链接
  → Supabase /auth/v1/verify → 回跳 /auth/callback?code=…（现成路由）
  → exchangeCodeForSession 建立「恢复会话」→ redirect 到 next=/reset-password
/reset-password  (填新密码 ×2)
  → 页面先 getUser() 校验恢复会话，无会话打回 /forgot-password
  → POST /api/auth/reset-password
  → supabase.auth.updateUser({ password })（靠恢复会话授权）
  → signOut() → /signin?message=passwordReset
```

PKCE 说明：`resetPasswordForEmail` 在 Route Handler 里由 server client 调用，`code_verifier`
写进 cookie（同浏览器）。用户点邮件链接回到 callback 时 cookie 仍在，`exchangeCodeForSession`
即可换取会话。这与注册确认信的 `emailRedirectTo` 走同一套机制。

## 文件

| 文件 | 作用 |
|------|------|
| `src/app/(auth)/forgot-password/page.tsx` + `ForgotPasswordForm.tsx` | 填邮箱页 |
| `src/app/api/auth/forgot-password/route.ts` | 发重置信；**防枚举** |
| `src/app/(auth)/reset-password/page.tsx` + `ResetPasswordForm.tsx` | 填新密码页；页面层校验恢复会话 |
| `src/app/api/auth/reset-password/route.ts` | `updateUser({password})`，校验长度≥6 + 两次一致 |
| `src/lib/supabase/proxy.ts` | `PUBLIC_PREFIXES` 加 `/forgot-password` `/reset-password` |
| `src/app/(auth)/signin/SignInForm.tsx` + `page.tsx` | 「忘记密码?」链接 + `passwordReset` 提示 |
| `src/i18n/{types,zh,en}.ts` | 新增 `auth.*` 文案 + `forgot`/`reset` 页面段 |

## 几个刻意的决定

- **防枚举**：`/api/auth/forgot-password` 无论邮箱是否存在、格式是否合法，一律回
  `?message=resetSent`，文案是条件式措辞（「如果这个邮箱已注册…」）。`resetPasswordForEmail`
  本身对不存在的邮箱也不报错，双保险不泄露注册状态。发信失败（限流等）同样不外露。
- **改密后 signOut**：重设成功后登出恢复会话，让用户用新密码在 `/signin` 干净重登一次。
- **`/reset-password` 双重守卫**：加进 `PUBLIC_PREFIXES`（proxy 不拦），改由页面 `getUser()`
  自己判断 —— 有恢复会话才显示表单，否则打回忘记密码页，给出更准的错误。
- **密码下限 6 位**，与注册页一致（client `minLength` + 服务端再校验）。

## 前置依赖（运维侧）

- Supabase Dashboard → **SMTP 已配**（本项目用 Resend，`noreply@dearm.ai`），否则重置信发不出。
- Supabase Dashboard → Authentication → **URL Configuration** 的 Redirect URLs 需包含
  `https://dearm.ai/auth/callback`（及本地开发地址），否则回跳被拒。

## 手测

1. `/signin` 点「忘记密码?」→ 填邮箱 → 见 resetSent 提示。
2. 收信（含垃圾箱）→ 点链接 → 落到 `/reset-password`。
3. 填新密码 ×2 → 成功跳 `/signin` 并显示「密码已重设」。
4. 用新密码登录成功。
5. 反例：直接访问 `/reset-password`（无恢复会话）→ 打回 `/forgot-password`。
