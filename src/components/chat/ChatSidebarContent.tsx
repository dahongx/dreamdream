"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import { useI18n } from "@/i18n/client";
import type { RecentSessionListItem } from "@/lib/sessions/queries";
import { firstChar } from "@/lib/util/first-char";
import { previewSnippet } from "@/lib/util/preview-text";
import { formatRelativeShort } from "@/lib/util/relative-time";

interface Props {
  sessions: RecentSessionListItem[];
  activeCharacterId: string;
  titleText: string;
  emptyText: string;
  /** 角色已不可访问(作者改私密/下架)时,行点击的提示文案。 */
  unavailableText: string;
  /** Called when a row is tapped — drawer parents use this to close themselves
   *  after navigation kicks off. Desktop sidebar omits. */
  onItemClick?: () => void;
}

/**
 * 聊过的角色列表（标题 header + 搜索 + 滚动列表）。
 * 一个角色 = 一段持续对话，所以一行直接代表一个角色，点进去看完整历史。
 *
 * 每行 = 头像 / 角色名 + 相对时间 / 最新消息单行预览 —— 之前只有头像 +
 * 名字，信息密度与对标产品差距最大的一块。搜索是纯客户端按名字过滤
 * （列表本来就全量在内存里）。
 *
 * 不带外层 aside / 抽屉 chrome —— 桌面 `ChatSidebar` 包一层
 * `<aside hidden md:flex>`，手机 `ChatSessionsDrawer` 包一层 fixed 抽屉。
 * 两边像素级一致就靠这一份渲染。
 *
 * 标题/空态文案仍走 props（桌面侧栏在 server 端取 dict 后传入，抽屉同源），
 * 搜索 placeholder 与「你：」前缀走 useI18n（本组件已是 client）。
 */
export function ChatSidebarContent({
  sessions,
  activeCharacterId,
  titleText,
  emptyText,
  unavailableText,
  onItemClick,
}: Props) {
  const { dict, locale } = useI18n();
  const [query, setQuery] = useState("");

  // 角色卡随创作者注销一起被删的会话(孤儿):角色名整行为 null。占位名与提示
  // 走 dict —— 本组件已是 client,不必再从 server 端串 prop 下来。
  const deletedName = dict.sessions.deletedCharacterName;
  const deletedHint = dict.sessions.deletedCharacterHint;
  const nameOf = (s: RecentSessionListItem) => s.characterName ?? deletedName;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) =>
      (s.characterName ?? deletedName).toLowerCase().includes(q),
    );
  }, [sessions, query, deletedName]);

  return (
    <div id="nj_chat_sidebar" className="flex h-full min-h-0 flex-col">
      <header className="flex flex-col gap-[var(--space-sm)] border-b border-border-subtle px-[var(--space-md)] py-[var(--space-md)]">
        <h2 className="font-display-zh text-lg text-text-primary">
          {titleText}
        </h2>
        {sessions.length > 0 && (
          <label className="flex items-center gap-[var(--space-xs)] rounded-[var(--radius-sm)] border border-border-subtle bg-surface-glass/60 px-[var(--space-sm)] py-[var(--space-xs)] transition-colors focus-within:border-border-strong">
            <Search
              size={14}
              strokeWidth={1.5}
              className="shrink-0 text-text-muted"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.chat.sidebarSearchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted/60"
            />
          </label>
        )}
      </header>

      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="p-[var(--space-md)] text-sm text-text-muted">
            {sessions.length === 0 ? emptyText : dict.chat.sidebarNoMatch}
          </p>
        ) : (
          <ul className="flex flex-col">
            {filtered.map((s) => {
              const active =
                s.characterId !== null && s.characterId === activeCharacterId;
              const name = nameOf(s);
              const rowHint = s.characterDeleted
                ? deletedHint
                : unavailableText;
              const preview = previewSnippet(s.previewContent, 42);
              const previewLine =
                preview &&
                (s.previewRole === "user"
                  ? `${dict.chat.sidebarPreviewYouPrefix}${preview}`
                  : preview);
              const when = s.previewCreatedAt ?? s.lastMessageAt;
              const avatar = (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-solid">
                  {s.characterAvatarUrl ? (
                    <ImageWithFallback
                      src={s.characterAvatarUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                      fallback={
                        <span className="font-display-zh text-base text-text-muted">
                          {firstChar(name)}
                        </span>
                      }
                    />
                  ) : (
                    <span className="font-display-zh text-base text-text-muted">
                      {firstChar(name)}
                    </span>
                  )}
                </span>
              );
              return (
                <li
                  // key 用 session id 而非 characterId —— 孤儿会话的
                  // characterId 全是 null,拿它当 key 会整片撞在一起。
                  key={s.id}
                  className="flex items-center border-b border-border-subtle/40"
                >
                  {s.accessible ? (
                    <Link
                      href={`/chat/${s.characterId}`}
                      onClick={onItemClick}
                      data-active={active || undefined}
                      className="nj_chat_sidebar_item flex min-w-0 flex-1 items-center gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-sm)] text-sm text-text-secondary transition-colors hover:bg-surface-glass/40 data-[active]:bg-surface-glass data-[active]:text-text-primary"
                    >
                      {avatar}
                      <span className="flex min-w-0 flex-1 flex-col gap-[2px] overflow-hidden">
                        <span className="flex items-baseline justify-between gap-[var(--space-xs)]">
                          <span className="truncate font-display-zh text-text-primary">
                            {name}
                          </span>
                          {when && (
                            <span className="shrink-0 font-mono text-[10px] text-text-muted">
                              {formatRelativeShort(new Date(when), locale)}
                            </span>
                          )}
                        </span>
                        {previewLine && (
                          <span className="truncate text-xs text-text-muted">
                            {previewLine}
                          </span>
                        )}
                      </span>
                    </Link>
                  ) : (
                    // 角色已被作者改私密/下架,或已随创作者注销被删:标灰、
                    // 不可点,title 悬停提示原因。记录本身还在库里,只是没有
                    // 角色卡就没法继续对话(system prompt / 正则 / 开场全依赖它)。
                    <div
                      title={rowHint}
                      aria-disabled="true"
                      className="nj_chat_sidebar_item flex min-w-0 flex-1 cursor-not-allowed items-center gap-[var(--space-sm)] px-[var(--space-md)] py-[var(--space-sm)] text-sm opacity-50"
                    >
                      <span className="grayscale">{avatar}</span>
                      <span className="flex min-w-0 flex-1 flex-col gap-[2px] overflow-hidden">
                        <span className="truncate font-display-zh text-text-muted line-through">
                          {name}
                        </span>
                        <span className="truncate text-[10px] text-text-muted">
                          {rowHint}
                        </span>
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
