"use client";

import { useEffect, useRef } from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";

/**
 * 每日银币自动领取 + 到账提示。
 *
 * 已登录用户的页面首次加载时,静默 POST 一次 /api/currency/claim-daily,
 * 仅在「今天确实是第一次,本次实际进账」(`claimed: true`)时才弹「叮咚...」
 * dialog 提示。后端本身按 `last_daily_claim_date == today` 幂等去重,
 * 这里再用 sessionStorage 卡一层,避免同一会话内多次 page transition 都
 * 打一次空请求。
 *
 * 设计契约:
 *   - 弹窗复用 DialogProvider.confirm():暗紫底 + 衬线标题
 *   - 到账弹窗只确认结果，不在每日奖励里插入充值推销
 */

const SESSION_KEY = "nj_daily_claim_attempted_v1";

interface ClaimResponse {
  claimed: boolean;
  amount: number;
  newBalance: number;
  message: string;
}

export function DailyClaimGate() {
  const { alert } = useDialog();
  const { dict } = useI18n();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (typeof window === "undefined") return;

    // 双重检查：sessionStorage（当前会话）+ localStorage（当天已触发）
    // 使用东八区（UTC+8）日期，与后端保持一致
    const now = new Date();
    const utc8Time = new Date(now.getTime() + 8 * 60 * 60000);
    const today = utc8Time.toISOString().split("T")[0];
    const lastAttemptDate = window.localStorage.getItem(SESSION_KEY);

    // 如果今天已经触发过，直接跳过
    if (lastAttemptDate === today) return;

    // 如果当前会话已触发，直接跳过
    if (window.sessionStorage.getItem(SESSION_KEY) === "1") return;

    // 标记已触发
    window.sessionStorage.setItem(SESSION_KEY, "1");
    window.localStorage.setItem(SESSION_KEY, today);

    void (async () => {
      try {
        const res = await fetch("/api/currency/claim-daily", {
          method: "POST",
        });
        if (!res.ok) return;
        const data = (await res.json()) as ClaimResponse;
        if (!data.claimed) return;

        const t = dict.dailyClaim;
        await alert({
          title: t.title,
          body: (
            <p>
              <span className="font-mono font-semibold text-currency-silver">
                +{data.amount}
              </span>{" "}
              {t.bodyArrived}{" "}
              <span className="font-mono font-semibold text-currency-silver">
                {data.newBalance}
              </span>
              {t.bodyArrivedSuffix}
            </p>
          ),
          okLabel: dict.dialog.ok,
        });
      } catch (err) {
        console.error("daily silver claim failed:", err);
      }
    })();
  }, [alert, dict.dailyClaim, dict.dialog.ok]);

  return null;
}
