import { Calendar, MessageSquare } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Locale } from "@/i18n/config";
import type { RecentSessionListItem } from "@/lib/sessions/queries";
import { firstChar } from "@/lib/util/first-char";
import { previewSnippet } from "@/lib/util/preview-text";

/**
 * 「最近会话」列表 —— 参考 /tmp/page/10.jpg:
 *   - 按月份分组(今年内用「M月D日」最近若干天,稍早用「M月」)
 *   - 每条卡片:头像 / 角色名 / 角色 tags(右上)/ 最新消息预览(下方)
 *   - 点击直接跳 /chat/<characterId> 进入该角色的当前临时对话
 *
 * 这是 server component —— 数据已由 page 拉好,这里只负责渲染分组。
 */

interface Props {
  items: RecentSessionListItem[];
  emptyTitle: string;
  emptyCta: string;
  previewUnavailable: string;
  inaccessibleHint: string;
  /** 角色卡随创作者注销一起删掉后的占位名与提示（孤儿会话） */
  deletedCharacterName: string;
  deletedCharacterHint: string;
  /** 形如「{month}月」的格式字符串 */
  monthLabelFmt: string;
  /** 形如「{month}月{day}日」的格式字符串 */
  monthDayLabelFmt: string;
  locale: Locale;
}

export function SessionsRecentList({
  items,
  emptyTitle,
  emptyCta,
  previewUnavailable,
  inaccessibleHint,
  deletedCharacterName,
  deletedCharacterHint,
  monthLabelFmt,
  monthDayLabelFmt,
  locale,
}: Props) {
  if (items.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        ctaHref="/explore"
        ctaLabel={emptyCta}
        Icon={MessageSquare}
      />
    );
  }

  const groups = groupByMonthBucket(items, {
    monthLabelFmt,
    monthDayLabelFmt,
    locale,
  });

  return (
    <div className="flex flex-col gap-[var(--space-lg)]">
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-[var(--space-sm)]">
          <header className="flex items-center justify-between text-text-muted">
            <span className="font-mono text-sm uppercase tracking-wider">
              {g.label}
            </span>
            <Calendar size={14} aria-hidden="true" />
          </header>
          <div className="flex flex-col gap-[var(--space-sm)]">
            {g.items.map((s) => (
              <RecentRow
                key={s.id}
                session={s}
                previewUnavailable={previewUnavailable}
                inaccessibleHint={inaccessibleHint}
                deletedCharacterName={deletedCharacterName}
                deletedCharacterHint={deletedCharacterHint}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RecentRow({
  session,
  previewUnavailable,
  inaccessibleHint,
  deletedCharacterName,
  deletedCharacterHint,
}: {
  session: RecentSessionListItem;
  previewUnavailable: string;
  inaccessibleHint: string;
  deletedCharacterName: string;
  deletedCharacterHint: string;
}) {
  const preview = previewSnippet(session.previewContent, 60);
  // 角色被删(创作者注销)→ 角色名整行为 null,拿占位名顶上;提示也换一套 ——
  // 「暂不可用」暗示会回来,而这是永久的。
  const name = session.characterDeleted
    ? deletedCharacterName
    : (session.characterName ?? deletedCharacterName);
  const hint = session.characterDeleted
    ? deletedCharacterHint
    : inaccessibleHint;
  const inner = (
    <div
      className={`nj_sessions_recent_item flex items-start gap-[var(--space-md)] rounded-[var(--radius-md)] border bg-surface-glass/40 p-[var(--space-md)] transition-colors ${
        session.accessible
          ? "border-border-subtle hover:border-border-strong hover:bg-surface-glass"
          : "border-border-subtle opacity-60"
      }`}
    >
      <Avatar url={session.characterAvatarUrl} fallback={firstChar(name)} />
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-xs)]">
        <div className="flex items-start justify-between gap-[var(--space-md)]">
          <span className="font-display-zh text-base text-text-primary">
            {name}
          </span>
          {!session.accessible && (
            <span className="rounded-[var(--radius-pill)] bg-accent-amber/15 px-[var(--space-sm)] py-[2px] text-[10px] text-accent-amber">
              {hint}
            </span>
          )}
        </div>
        <p className="line-clamp-2 break-words font-body-zh text-sm text-text-secondary">
          {preview ?? (
            <span className="italic text-text-muted">{previewUnavailable}</span>
          )}
        </p>
      </div>
    </div>
  );

  if (!session.accessible) {
    // 角色被作者改私密,或角色已随创作者注销被删;不给链接,只展示。
    return <div>{inner}</div>;
  }

  return (
    <Link
      href={`/chat/${session.characterId}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/60"
    >
      {inner}
    </Link>
  );
}

function Avatar({ url, fallback }: { url: string | null; fallback: string }) {
  if (url) {
    return (
      // biome-ignore lint/performance/noImgElement: external URLs
      <img
        src={url}
        alt=""
        className="h-12 w-12 shrink-0 rounded-full border border-border-subtle object-cover"
      />
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-surface-solid font-display-zh text-base text-text-muted">
      {fallback}
    </span>
  );
}

/* ───────── 分组逻辑 ───────── */

interface MonthGroup {
  key: string;
  label: string;
  items: RecentSessionListItem[];
}

/**
 * 参考图 10:近 30 天内的项目按「M月D日」单日分组,更早的按「M月」(同月聚合),
 * 跨年再加上「YYYY年M月」。排序保留原 items 的倒序(已按 lastMessageAt desc)。
 *
 * 注:用 Asia/Shanghai 时区,server-rendered,跟 character detail updatedAt 一致。
 */
function groupByMonthBucket(
  items: RecentSessionListItem[],
  fmt: {
    monthLabelFmt: string;
    monthDayLabelFmt: string;
    locale: Locale;
  },
): MonthGroup[] {
  const now = new Date();
  const oneMonthAgo = new Date(now);
  oneMonthAgo.setDate(now.getDate() - 30);

  const groups = new Map<string, MonthGroup>();
  for (const item of items) {
    const t = item.previewCreatedAt ?? item.lastMessageAt;
    // 跳过没有任何消息的 session（理论上不应该出现在列表里，防御性处理）
    if (!t || !(t instanceof Date) || !Number.isFinite(t.getTime())) continue;
    const recent = t >= oneMonthAgo;
    const parts = dateParts(t, fmt.locale);
    const sameYear = parts.year === dateParts(now, fmt.locale).year;
    const key = recent
      ? `${parts.year}-${parts.month}-${parts.day}`
      : `${parts.year}-${parts.month}`;
    let label: string;
    if (recent) {
      label = formatToken(fmt.monthDayLabelFmt, {
        month: String(Number(parts.month)),
        day: String(Number(parts.day)),
      });
    } else if (sameYear) {
      label = formatToken(fmt.monthLabelFmt, {
        month: String(Number(parts.month)),
      });
    } else {
      label = new Intl.DateTimeFormat(fmt.locale, {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "long",
      }).format(t);
    }
    let group = groups.get(key);
    if (!group) {
      group = { key, label, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return Array.from(groups.values());
}

function dateParts(
  d: Date,
  locale: Locale,
): { year: string; month: string; day: string } {
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day") };
}

function formatToken(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
