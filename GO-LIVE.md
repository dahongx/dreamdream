# 上线前检查清单（Go-Live）

> 真实支付（Stripe）已接入主干，**代码侧完成**。但「收真钱」前还有几项只能在
> Stripe 后台 / 生产环境完成的配置。这份清单是单一事实来源。
>
> 技术细节 → [docs/handover/stripe-payments.md](./docs/handover/stripe-payments.md)
> 产品决策 → [docs/insights/stripe-payments.md](./docs/insights/stripe-payments.md)

---

## 💳 支付（Stripe）—— 收真钱前必做

代码侧已完成并验证：卡 / 支付宝 / 微信、月卡 HK$30 / 68 / 128 一次性买断、
webhook 幂等履约、删除了「点一下免费发卡」的漏洞。剩下全在 Stripe 后台 / 生产环境：

- [ ] **关闭 Adaptive Pricing**（Dashboard → Settings → Payments）。
  否则收银台按访客地理位置自动切币种，非 HKD/CNY 访客（如美国 IP）**看不到微信、只剩卡**。
  关掉后强制用我们传的 HKD。（或确认大陆访客会被分到 CNY —— 也支持支付宝/微信，但不如关掉确定。）
- [ ] **启用 Alipay + WeChat Pay**（Dashboard → Settings → Payment methods），test 和 live 都要开。
- [ ] **补齐商户资料**让 `charges_enabled=true`（当前 `false` —— test 能跑，live 收款不行）。
- [ ] **配置生产 webhook endpoint**：`https://dearm.ai/api/stripe/webhook`，
  监听 `checkout.session.completed` / `checkout.session.async_payment_succeeded` /
  `checkout.session.async_payment_failed` / `checkout.session.expired`，拿到 live 的 `whsec_...`。
- [ ] **生产环境变量**：
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`（上一步 live endpoint 的密钥，不是本地 `stripe listen` 的）
  - `NEXT_PUBLIC_APP_URL=https://dearm.ai`
- [ ] **切 live 后真实验一笔**：小额买一档 → 确认到账 → Dashboard 退款一次，确认对账正常。

### ⚠️ 关键事实（改之前先看，别改错）

- **计价币种 HKD**：账号是香港主体，微信只接受 hkd / cny，**USD 用不了微信**。三档 HK$30 / 68 / 128。
  改币种只动 `src/lib/membership/constants.ts` 的 `CURRENCY` + `priceHkd`。
- **月卡是一次性买断 30 天，不是自动续费** —— 支付宝/微信在 Stripe 下不支持订阅。真订阅得另起卡专属链路。
- **履约唯一可信信号是 webhook**，前端 `?pay=success` 只是即时反馈，绝不拿它发货（支付宝/微信是异步重定向型）。
- **普通用户开通唯一通路是 Stripe 付款**；旧的免费 `subscribeToTier` 已删，别复活。

---

## 后置（非上线阻塞）

- 退款链路（webhook `charge.refunded` → 反扣会员 / 银两）
- 订阅到期 cron 提醒
- 「直购」（按需买银两）—— 当前占位
- 真订阅 / 自动续费（若未来上银行卡专属续费档）
