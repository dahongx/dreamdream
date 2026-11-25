"use client";

import { useActionState, useState } from "react";
import { btnSecondary } from "@/components/ui/button";
import { fieldCls } from "@/components/ui/field";
import { useI18n } from "@/i18n/client";
import {
  type DeleteAccountResult,
  deleteAccountAction,
} from "@/lib/account/actions";
import { LEGAL_PAGES_ENABLED } from "@/lib/legal/config";
import { sfwServiceCopy } from "@/lib/legal/sfw-service-copy";

/**
 * /settings 底部的危险区 —— 账号注销（硬删除）。
 *
 * 为什么是「就地展开的表单」而不是 DialogProvider 的 confirm 弹窗：
 *   注销要同时收两样东西（密码 + 明确勾选），还要把六条后果完整摊开让人读完。
 *   dialog.confirm 只能给一段 body 和是/否两个键，塞不下。就地展开还有个好处 ——
 *   后果清单跟提交按钮同屏，滚动读完才够得着按钮。
 *
 * 视觉遵循 DESIGN.md：--semantic-error 只走边框与文字，不做大红实心块
 * （暗紫黑底上实心红过于刺眼，也会跟 primary CTA 抢层级）。
 */
export function DeleteAccountSection() {
  const { dict, locale } = useI18n();
  const t = dict.settings;
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<
    DeleteAccountResult | null,
    FormData
  >(deleteAccountAction, null);

  if (!open) {
    return (
      <section className="glass-card flex items-center justify-between gap-[var(--space-md)] border-semantic-error/20 p-[var(--space-xl)]">
        <div>
          <p className="font-display-zh text-lg text-semantic-error">
            {t.dangerZoneTitle}
          </p>
          <p className="mt-[var(--space-xs)] text-sm text-text-muted">
            {t.deleteAccountLead}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 rounded-[var(--radius-sm)] border border-semantic-error/40 px-[var(--space-md)] py-[var(--space-sm)] text-sm text-semantic-error transition-colors hover:bg-semantic-error/10"
        >
          {t.deleteAccountOpen}
        </button>
      </section>
    );
  }

  return (
    <form
      action={formAction}
      className="glass-card flex flex-col gap-[var(--space-md)] border-semantic-error/30 p-[var(--space-xl)]"
    >
      <p className="font-display-zh text-lg text-semantic-error">
        {t.deleteAccountTitle}
      </p>
      <p className="text-sm text-text-secondary">{t.deleteAccountLead}</p>

      <ul className="flex list-disc flex-col gap-[var(--space-xs)] pl-[var(--space-lg)] text-sm text-text-muted">
        {t.deleteAccountConsequences.map((originalLine, index) => {
          const line =
            LEGAL_PAGES_ENABLED && index === 3
              ? sfwServiceCopy(locale).deletion
              : originalLine;
          return <li key={line}>{line}</li>;
        })}
      </ul>

      <div>
        <label
          className="mb-[var(--space-xs)] block text-sm text-text-secondary"
          htmlFor="deleteAccountPassword"
        >
          {t.deleteAccountPasswordLabel}
        </label>
        <input
          id="deleteAccountPassword"
          name="password"
          type="password"
          autoComplete="current-password"
          className={fieldCls}
        />
      </div>

      {/* 原生 checkbox：Radix 的 Checkbox 不传 name 就不生成隐藏 input，
          FormData 里会直接少一个字段（见 feedback）。这里不值得引入那个坑。 */}
      <label className="flex items-start gap-[var(--space-sm)] text-sm text-text-secondary">
        <input
          name="confirm"
          type="checkbox"
          className="mt-[3px] accent-[var(--semantic-error)]"
        />
        <span>{t.deleteAccountConfirmLabel}</span>
      </label>

      {state && !state.ok && (
        <p className="text-sm text-semantic-error">{state.error}</p>
      )}

      <div className="flex justify-end gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={isPending}
          className={btnSecondary}
        >
          {t.deleteAccountCancel}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-[var(--radius-sm)] border border-semantic-error/40 px-[var(--space-lg)] py-[var(--space-sm)] text-sm text-semantic-error transition-colors hover:bg-semantic-error/10 disabled:opacity-60"
        >
          {isPending ? t.deleteAccountPending : t.deleteAccountSubmit}
        </button>
      </div>
    </form>
  );
}
