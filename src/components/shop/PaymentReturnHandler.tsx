"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BreathingDots } from "@/components/ai/BreathingDots";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";

/**
 * 处理支付渠道的付款回跳。渲染 null，只跑副作用。
 *
 * - `?pay=cancel`            → 提示已取消（未扣款），清理 URL。
 * - `?pay=success&session_id|order_id` → 轮询对应渠道的状态接口直到 webhook 把订单
 *   翻成 paid（履约是异步的，跳回瞬间多半还是 pending），到账后 router.refresh()
 *   让会员状态/银币余额刷新，再提示成功；超时则保持「正在确认」语义。
 *
 * 为什么轮询而非直接信任回跳：支付渠道是异步重定向型，唯一可信的发货
 * 信号是 webhook。回跳只代表用户跳回来了，
 * 不代表钱到了。
 */
export function PaymentReturnHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const { alert: showAlert } = useDialog();
  const { dict } = useI18n();
  const t = dict.shop;
  const handled = useRef(false);
  // 轮询期间给用户可见反馈 —— 付完钱回来最长 ~18s 的静默是全站最不能
  // 沉默的 18 秒（之前这段时间页面毫无动静）。
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const pay = params.get("pay");
    if (!pay || handled.current) return;
    handled.current = true;

    const cleanUrl = () => router.replace("/shop", { scroll: false });
    const ok = t.paymentDialogOk;

    if (pay === "cancel") {
      void (async () => {
        await showAlert({
          title: t.payCancelTitle,
          body: t.payCancelBody,
          okLabel: ok,
        });
        cleanUrl();
      })();
      return;
    }

    if (pay === "success") {
      const stripeSessionId = params.get("session_id");
      const payprooOrderId = params.get("order_id");
      const statusUrl = stripeSessionId
        ? `/api/stripe/order-status?session_id=${encodeURIComponent(stripeSessionId)}`
        : payprooOrderId
          ? `/api/payproo/order-status?order_id=${encodeURIComponent(payprooOrderId)}`
          : null;
      void (async () => {
        setConfirming(true);
        let status = "pending";
        let purchasedTier: string | null | undefined;
        if (statusUrl) {
          // 最多轮 ~18s（12 × 1.5s），等待支付平台异步通知完成履约。
          for (let i = 0; i < 12; i++) {
            try {
              const res = await fetch(statusUrl);
              if (res.ok) {
                const data = (await res.json()) as {
                  status?: string;
                  tier?: string | null;
                };
                status = data.status ?? "pending";
                purchasedTier = data.tier;
                if (status === "paid" || status === "failed") break;
              }
            } catch {
              // 单次轮询失败忽略，继续重试
            }
            await new Promise((r) => setTimeout(r, 1500));
          }
        }

        setConfirming(false);

        if (status === "paid") {
          router.refresh();
          await showAlert({
            title: t.paySuccessTitle,
            body:
              purchasedTier === null ? t.payGoldSuccessBody : t.paySuccessBody,
            okLabel: ok,
          });
        } else if (status === "failed") {
          await showAlert({
            title: t.payFailedTitle,
            body: t.payFailedBody,
            okLabel: ok,
          });
        } else {
          // 仍 pending（webhook 慢或本地没起 listen）—— 提示稍后刷新。
          await showAlert({
            title: t.payProcessingTitle,
            body: t.payProcessingBody,
            okLabel: ok,
          });
          router.refresh();
        }
        cleanUrl();
      })();
    }
  }, [params, router, showAlert, t]);

  if (!confirming) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--topbar-height)+var(--space-md))] z-[90] flex justify-center">
      <output
        aria-live="polite"
        className="glass-card flex items-center gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-secondary"
      >
        <BreathingDots size={6} />
        {t.payConfirming}
      </output>
    </div>
  );
}
