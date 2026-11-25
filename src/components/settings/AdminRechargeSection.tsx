"use client";

import {
  type FormEvent,
  useActionState,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";
import { useDialog } from "@/components/ui/DialogProvider";
import { useI18n } from "@/i18n/client";
import type { Locale } from "@/i18n/config";
import {
  getUserRechargeView,
  type LedgerScenario,
  type RechargeLedgerEntry,
  type RechargeResult,
  rechargeGoldAction,
  searchUsersForRecharge,
  type UserRechargeView,
  type UserSearchResult,
} from "@/lib/admin/recharge";

// 场景中文展示。新增场景在 LedgerScenario 类型加，TS 会提示这里缺 case。
const SCENARIO_LABEL: Record<LedgerScenario, string> = {
  chat: "聊天",
  continue: "续写",
  embellish: "美化包",
  image: "图片生成",
  refund: "退款",
  recharge: "充值",
  daily_claim: "签到",
  other: "其他",
};

function formatDateTime(iso: string, locale: Locale): string {
  return new Date(iso).toLocaleString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 与其他 admin 组件统一口径：1 CNY = 100_000 millicents。
function formatCny(cnyMillicents: number | null): string {
  if (cnyMillicents == null) return "—";
  return `¥${(cnyMillicents / 100_000).toFixed(4)}`;
}

function roleLabel(role: string): string {
  if (role === "admin") return "管理员";
  if (role === "beta_tester") return "内测人员";
  return "普通用户";
}

function renderQuota(view: UserRechargeView): string {
  const { quota } = view;
  if (!Number.isFinite(quota.dailyLimit)) {
    return `不限（已用 ${quota.usedToday}）`;
  }
  return `${quota.remaining} / ${quota.dailyLimit}（已用 ${quota.usedToday}）`;
}

export function AdminRechargeSection() {
  const { dict } = useI18n();

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [view, setView] = useState<UserRechargeView | null>(null);
  const [loadingView, startLoadView] = useTransition();

  // debounced search：用户每输入一次触发 setTimeout，输入 300ms 没新内容才发请求。
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setSearchResults([]);
      return;
    }
    const handle = setTimeout(() => {
      startSearch(async () => {
        const rows = await searchUsersForRecharge(trimmed);
        setSearchResults(rows);
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [query]);

  function selectUser(userId: string) {
    startLoadView(async () => {
      const next = await getUserRechargeView(userId);
      setView(next);
    });
  }

  // useCallback：传给 RechargeForm 的 useEffect 依赖列表。无 useCallback 则父
  // 组件每次渲染都给子拿到新引用，触发不必要的 effect 重跑。
  const refetchCurrent = useCallback(async () => {
    const currentId = view?.user.id;
    if (!currentId) return;
    const next = await getUserRechargeView(currentId);
    setView(next);
  }, [view?.user.id]);

  return (
    <div className="space-y-[var(--space-xl)]">
      {/* ─── 搜索栏 ─── */}
      <section className="space-y-[var(--space-md)]">
        <h2 className="font-display-zh text-lg text-text-primary">查找用户</h2>

        <div className="flex flex-col gap-[var(--space-sm)]">
          <input
            type="text"
            value={query}
            placeholder="邮箱 / 用户名 / 昵称"
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
          />

          {query.trim().length > 0 && (
            <div className="rounded-[var(--radius-md)] border border-border-subtle">
              {searching ? (
                <p className="px-[var(--space-md)] py-[var(--space-sm)] text-xs text-text-muted">
                  查询中…
                </p>
              ) : searchResults.length === 0 ? (
                <p className="px-[var(--space-md)] py-[var(--space-sm)] text-xs text-text-muted">
                  没有匹配的用户。
                </p>
              ) : (
                <ul className="divide-y divide-border-subtle/50">
                  {searchResults.map((r) => {
                    const active = view?.user.id === r.id;
                    return (
                      <li key={r.id}>
                        <button
                          type="button"
                          onClick={() => selectUser(r.id)}
                          className={`flex w-full items-center justify-between gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-sm)] text-left text-sm transition-colors hover:bg-surface-glass ${
                            active
                              ? "bg-surface-glass text-text-primary"
                              : "text-text-secondary"
                          }`}
                        >
                          <span className="flex flex-col gap-[2px]">
                            <span className="font-medium">{r.username}</span>
                            <span className="text-xs text-text-muted">
                              {r.email ?? "—"} · {roleLabel(r.role)}
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-[2px] font-mono text-xs">
                            <span className="text-amber-500">
                              金 {r.goldBalance}
                            </span>
                            <span className="text-slate-400">
                              银 {r.silverBalance}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── 用户详情 ─── */}
      {loadingView && (
        <p className="text-sm text-text-muted">加载用户信息中…</p>
      )}

      {!loadingView && view && (
        <>
          <SelectedUserCard view={view} />
          <RechargeForm view={view} onSuccess={refetchCurrent} />
          <LedgerTable
            ledger={view.ledger}
            emptyText={dict.admin.rechargeLedgerEmpty}
            goldBalance={view.user.goldBalance}
            silverBalance={view.user.silverBalance}
          />
        </>
      )}
    </div>
  );
}

function SelectedUserCard({ view }: { view: UserRechargeView }) {
  const { user, quota } = view;
  return (
    <section className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]">
      <header className="flex flex-wrap items-baseline justify-between gap-[var(--space-sm)]">
        <div className="flex flex-col gap-[2px]">
          <h2 className="font-display-zh text-xl text-text-primary">
            {user.username}
          </h2>
          <p className="text-xs text-text-muted">
            {user.email ?? "—"} · {roleLabel(user.role)}
          </p>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.15em] text-text-secondary">
          id: {user.id}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-[var(--space-md)] sm:grid-cols-3">
        <Stat
          label="金币余额"
          value={user.goldBalance.toString()}
          tone="gold"
        />
        <Stat
          label="银币余额"
          value={user.silverBalance.toString()}
          tone="silver"
        />
        <Stat
          label={
            quota.role === "beta_tester"
              ? "当日剩余次数（内测）"
              : quota.role === "admin"
                ? "当日剩余次数（管理员）"
                : "当日剩余次数"
          }
          value={renderQuota(view)}
          tone="neutral"
        />
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gold" | "silver" | "neutral";
}) {
  const color =
    tone === "gold"
      ? "text-amber-500"
      : tone === "silver"
        ? "text-slate-400"
        : "text-text-primary";
  return (
    <div className="flex flex-col gap-[var(--space-xs)] rounded-[var(--radius-md)] border border-border-subtle bg-surface-glass/40 p-[var(--space-md)]">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`font-mono text-2xl font-semibold ${color}`}>
        {value}
      </span>
    </div>
  );
}

function RechargeForm({
  view,
  onSuccess,
}: {
  view: UserRechargeView;
  onSuccess: () => void | Promise<void>;
}) {
  const { confirm } = useDialog();
  const [state, formAction, pending] = useActionState<
    RechargeResult | null,
    FormData
  >(rechargeGoldAction, null);
  const [, startSubmit] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const amount = Number(formData.get("amount"));
    const approved = await confirm({
      title: "确认发放金币",
      body: `向 ${view.user.username} 发放 ${amount} 金币？提交后立即到账并写入流水。`,
      confirmLabel: "确认发放",
    });
    if (!approved) return;

    startSubmit(() => {
      formAction(formData);
    });
  }

  // 成功后刷新视图（余额 / 流水）。onSuccess 在父组件用 useCallback 稳定引用，
  // 加进 deps 不会触发多余的 effect。
  useEffect(() => {
    if (state?.ok) {
      void onSuccess();
    }
  }, [state, onSuccess]);

  return (
    <section className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]">
      <header className="space-y-[var(--space-xs)]">
        <h2 className="font-display-zh text-lg text-text-primary">发放金币</h2>
        <p className="text-xs text-text-muted">
          提交后金币立即到账，并记录在流水中。
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex flex-wrap items-end gap-[var(--space-md)]"
      >
        <input type="hidden" name="userId" value={view.user.id} />
        <label className="flex flex-col gap-[var(--space-xs)]">
          <span className="text-xs text-text-muted">金币数量</span>
          <input
            type="number"
            name="amount"
            min={1}
            max={10_000_000}
            step={1}
            required
            disabled={pending}
            placeholder="例如 100"
            className="w-40 rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none disabled:opacity-50"
          />
        </label>
        <label className="flex flex-1 flex-col gap-[var(--space-xs)]">
          <span className="text-xs text-text-muted">备注（可选）</span>
          <input
            type="text"
            name="note"
            maxLength={200}
            disabled={pending}
            placeholder="例如「商务赠送」「补偿」"
            className="w-full rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass px-[var(--space-sm)] py-[var(--space-xs)] text-sm text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none disabled:opacity-50"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-pill)] border border-accent-primary bg-accent-primary px-[var(--space-md)] py-[var(--space-xs)] text-sm font-medium text-text-on-accent transition-colors hover:bg-accent-primary-hover disabled:opacity-50"
        >
          {pending ? "发放中…" : "确认发放"}
        </button>
      </form>

      {state && !state.ok && (
        <p className="text-sm text-semantic-error">
          {state.error}
          {state.fieldErrors?.amount?.length
            ? ` · ${state.fieldErrors.amount.join("，")}`
            : ""}
        </p>
      )}
      {state?.ok && (
        <p className="text-sm text-semantic-success">
          已向 {view.user.username} 发放 {state.amount} 金币，当前余额{" "}
          {state.newGoldBalance}。
        </p>
      )}
    </section>
  );
}

// 列宽统一定义在这里 —— 表头 / 数据行 / 总计行三处都引用，避免不同处宽度
// 漂移。布局参考 /me 钱包 tab：
//   时间 (1.3fr) · 场景 (0.7fr) · 事项 (2fr) · 模型/渠道 (1.4fr) · 金币 / 银币 (0.7fr) · 成本 (0.9fr)
const LEDGER_GRID =
  "grid grid-cols-[1.3fr_0.7fr_2fr_1.4fr_0.7fr_0.7fr_0.9fr] gap-[var(--space-sm)]";

function LedgerTable({
  ledger,
  emptyText,
  goldBalance,
  silverBalance,
}: {
  ledger: RechargeLedgerEntry[];
  emptyText: string;
  // 用来在总计行同步用户当前余额（和 /me 钱包 tab 同样的「当前余额」尾行）。
  goldBalance: number;
  silverBalance: number;
}) {
  const { locale } = useI18n();
  // 总计：金 / 银 总变动量，给 admin 一眼看出这位用户在最近 200 条里的净流向。
  // 注意：这是「最近 200 条窗口的合计」，不是历史全量，避免误以为是终生净额。
  const totals = ledger.reduce(
    (acc, row) => {
      acc.gold += row.goldAmount;
      acc.silver += row.silverAmount;
      acc.cost += row.costCnyMillicents ?? 0;
      return acc;
    },
    { gold: 0, silver: 0, cost: 0 },
  );

  return (
    <section className="glass-card flex flex-col gap-[var(--space-md)] p-[var(--space-lg)]">
      <header className="space-y-[var(--space-xs)]">
        <h2 className="font-display-zh text-lg text-text-primary">货币记录</h2>
        <p className="text-xs text-text-muted">
          展示最近 200 条记录，包含场景、来源和实际模型成本。
        </p>
      </header>

      {ledger.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-[var(--space-sm)] py-[var(--space-2xl)] text-center">
          <p className="text-sm text-text-muted">{emptyText}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-[var(--space-xs)]">
          {/* 表头 —— 与 /me 钱包 tab 同样的「无 border / 一行 muted 字」风格 */}
          <div
            className={`${LEDGER_GRID} border-b border-border-subtle pb-[var(--space-xs)] text-xs font-medium text-text-muted`}
          >
            <span>时间</span>
            <span>场景</span>
            <span>事项</span>
            <span>模型 / 渠道</span>
            <span className="text-right text-amber-500">金币</span>
            <span className="text-right text-slate-400">银币</span>
            <span className="text-right">成本</span>
          </div>

          {/* 数据行 —— max-h + overflow-y 与 /me 同尺寸 */}
          <div className="flex max-h-[420px] flex-col gap-[var(--space-xs)] overflow-y-auto">
            {ledger.map((row) => {
              // 模型 / 渠道列优先序：
              //   model_usage → 模型 display_name（无价格表退回 model_id）
              //   recharge    → admin 邮箱（buildLedger 已 fallback）
              //   daily_claim → 「每日登录」（buildLedger 已塞 operatorEmail）
              const modelOrChannel = row.model ?? row.operatorEmail ?? "—";
              return (
                <div
                  key={row.id}
                  className={`${LEDGER_GRID} py-[var(--space-xs)] text-xs text-text-secondary`}
                >
                  <span className="truncate" title={row.createdAt}>
                    {formatDateTime(row.createdAt, locale)}
                  </span>
                  <span className="truncate">
                    {SCENARIO_LABEL[row.scenario]}
                  </span>
                  <span className="truncate" title={row.description}>
                    {row.description}
                  </span>
                  <span
                    className="truncate text-text-muted"
                    title={modelOrChannel}
                  >
                    {modelOrChannel}
                  </span>
                  <span className="text-right font-mono text-amber-500 tabular-nums">
                    {row.goldAmount === 0
                      ? "—"
                      : row.goldAmount > 0
                        ? `+${row.goldAmount}`
                        : row.goldAmount}
                  </span>
                  <span className="text-right font-mono text-slate-400 tabular-nums">
                    {row.silverAmount === 0
                      ? "—"
                      : row.silverAmount > 0
                        ? `+${row.silverAmount}`
                        : row.silverAmount}
                  </span>
                  <span className="text-right font-mono text-text-secondary tabular-nums">
                    {formatCny(row.costCnyMillicents)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 窗口净额 —— 最近 200 条范围内的金 / 银流向与累计成本 */}
          <div
            className={`${LEDGER_GRID} mt-[var(--space-xs)] border-t border-border-subtle pt-[var(--space-sm)] text-xs`}
          >
            <span className="col-span-4 font-medium text-text-primary">
              本视图净额（最近 {ledger.length} 条）
            </span>
            <span
              className={`text-right font-mono font-semibold tabular-nums ${
                totals.gold > 0
                  ? "text-amber-500"
                  : totals.gold < 0
                    ? "text-amber-500/70"
                    : "text-text-muted"
              }`}
            >
              {totals.gold > 0 ? `+${totals.gold}` : totals.gold}
            </span>
            <span
              className={`text-right font-mono font-semibold tabular-nums ${
                totals.silver > 0
                  ? "text-slate-400"
                  : totals.silver < 0
                    ? "text-slate-400/70"
                    : "text-text-muted"
              }`}
            >
              {totals.silver > 0 ? `+${totals.silver}` : totals.silver}
            </span>
            <span className="text-right font-mono font-semibold text-accent-amber tabular-nums">
              {formatCny(totals.cost)}
            </span>
          </div>

          {/* 当前余额 —— 与 /me 同样的尾行视觉契约 */}
          <div
            className={`${LEDGER_GRID} border-t border-border-subtle/60 pt-[var(--space-sm)] text-sm`}
          >
            <span className="col-span-4 font-medium text-text-primary">
              当前余额
            </span>
            <span className="text-right font-mono font-semibold text-amber-500 tabular-nums">
              {goldBalance}
            </span>
            <span className="text-right font-mono font-semibold text-slate-400 tabular-nums">
              {silverBalance}
            </span>
            <span className="text-right text-text-muted">—</span>
          </div>
        </div>
      )}
    </section>
  );
}
